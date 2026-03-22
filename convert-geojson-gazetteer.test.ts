import { assertEquals, assertThrows } from "@std/assert";
import {
  katakanaToHiragana,
  parseDegreeMinute,
  parsePageText,
  splitAlias,
} from "./convert-geojson-gazetteer.ts";

// --- katakanaToHiragana ---

Deno.test("katakanaToHiragana: 全カタカナ", () => {
  assertEquals(katakanaToHiragana("アトサヌプリ"), "あとさぬぷり");
});

Deno.test("katakanaToHiragana: カタカナ+ひらがな混在", () => {
  assertEquals(katakanaToHiragana("アポイだけ"), "あぽいだけ");
});

Deno.test("katakanaToHiragana: ひらがなのみはそのまま", () => {
  assertEquals(katakanaToHiragana("ふじさん"), "ふじさん");
});

Deno.test("katakanaToHiragana: 漢字混在はカタカナ部分のみ変換", () => {
  assertEquals(katakanaToHiragana("みなみアルプスし"), "みなみあるぷすし");
});

// --- splitAlias ---

Deno.test("splitAlias: 末尾（）を分解", () => {
  const result = splitAlias(
    "烏帽子岳（乳頭山）",
    "えぼしだけ（にゅうとうざん）",
  );
  assertEquals(result, {
    name: "烏帽子岳",
    reading: "えぼしだけ",
    aliases: [{ name: "乳頭山", reading: "にゅうとうざん" }],
  });
});

Deno.test("splitAlias: 途中の（）は分解しない", () => {
  const result = splitAlias(
    "火山（硫黄）列島",
    "かざん（いおう）れっとう",
  );
  assertEquals(result, {
    name: "火山（硫黄）列島",
    reading: "かざん（いおう）れっとう",
    aliases: [],
  });
});

Deno.test("splitAlias: 読みだけに（）がある場合", () => {
  const result = splitAlias("蔵王山", "ざおうざん（ざおうさん）");
  assertEquals(result, {
    name: "蔵王山",
    reading: "ざおうざん",
    aliases: [{ name: "", reading: "ざおうさん" }],
  });
});

Deno.test("splitAlias: （）なし", () => {
  const result = splitAlias("富士山", "ふじさん");
  assertEquals(result, { name: "富士山", reading: "ふじさん", aliases: [] });
});

Deno.test("splitAlias: 名前に（）あるが読みにない", () => {
  const result = splitAlias("冠着山（姨捨山）", "かむりきやま");
  assertEquals(result, {
    name: "冠着山",
    reading: "かむりきやま",
    aliases: [{ name: "姨捨山", reading: "" }],
  });
});

// --- parseDegreeMinute ---

Deno.test("parseDegreeMinute: 整数度と整数分", () => {
  // 44°01' = 44 + 1/60 = 44.016666...
  const result = parseDegreeMinute("44°01'");
  assertEquals(Math.round(result * 1_000_000) / 1_000_000, 44.016667);
});

Deno.test("parseDegreeMinute: 3桁度数", () => {
  // 144°17' = 144 + 17/60 = 144.283333...
  const result = parseDegreeMinute("144°17'");
  assertEquals(Math.round(result * 1_000_000) / 1_000_000, 144.283333);
});

Deno.test("parseDegreeMinute: 分が0", () => {
  const result = parseDegreeMinute("35°00'");
  assertEquals(result, 35);
});

Deno.test("parseDegreeMinute: 右シングルクォート", () => {
  const result = parseDegreeMinute("35°30'");
  assertEquals(result, 35.5);
});

Deno.test("parseDegreeMinute: プライム記号", () => {
  const result = parseDegreeMinute("35°30′");
  assertEquals(result, 35.5);
});

Deno.test("parseDegreeMinute: 分記号なし", () => {
  const result = parseDegreeMinute("35°30");
  assertEquals(result, 35.5);
});

Deno.test("parseDegreeMinute: 不正入力で例外", () => {
  assertThrows(
    () => parseDegreeMinute("invalid"),
    Error,
    'Failed to parse degree-minute: "invalid"',
  );
});

Deno.test("parseDegreeMinute: 空文字で例外", () => {
  assertThrows(
    () => parseDegreeMinute(""),
    Error,
  );
});

// --- parsePageText ---

Deno.test("parsePageText: 正常な1エントリ", () => {
  const text = [
    "1",
    "6644",
    "網走川",
    "あばしりがわ",
    "Abashiri Gawa",
    "44°01'",
    "144°17'",
    "River",
  ].join("\n");

  const entries = parsePageText(text);
  assertEquals(entries.length, 1);
  assertEquals(entries[0].meshCode, "6644");
  assertEquals(entries[0].name, "網走川");
  assertEquals(entries[0].reading, "あばしりがわ");
  assertEquals(entries[0].aliases, []);
  assertEquals(entries[0].romanized, "Abashiri Gawa");
  assertEquals(entries[0].classification, "River");
  assertEquals(
    Math.round(entries[0].latitude * 1_000_000) / 1_000_000,
    44.016667,
  );
  assertEquals(
    Math.round(entries[0].longitude * 1_000_000) / 1_000_000,
    144.283333,
  );
});

Deno.test("parsePageText: 複数エントリ", () => {
  const text = [
    "1",
    "5030",
    "足立山",
    "あだちやま",
    "Adachi Yama",
    "33°52'",
    "130°55'",
    "Mountain",
    "2",
    "5640",
    "安達太良山",
    "あだたらやま",
    "Adatara Yama",
    "37°37'",
    "140°17'",
    "Mountain",
  ].join("\n");

  const entries = parsePageText(text);
  assertEquals(entries.length, 2);
  assertEquals(entries[0].name, "足立山");
  assertEquals(entries[0].classification, "Mountain");
  assertEquals(entries[1].name, "安達太良山");
  assertEquals(entries[1].classification, "Mountain");
});

Deno.test("parsePageText: 連番以外の行をスキップ", () => {
  const text = [
    "2021", // ヘッダ的な行（4桁だが連番直後のメッシュコードと区別される）
    "Grid",
    "Japanese(Kanji)",
    "1",
    "5030",
    "足立山",
    "あだちやま",
    "Adachi Yama",
    "33°52'",
    "130°55'",
    "Mountain",
  ].join("\n");

  const entries = parsePageText(text);
  assertEquals(entries.length, 1);
  assertEquals(entries[0].name, "足立山");
});

Deno.test("parsePageText: メッシュコードが4桁でない場合スキップ", () => {
  const text = [
    "1",
    "12345", // 5桁 → スキップ
    "名前",
    "なまえ",
    "Name",
    "35°00'",
    "135°00'",
    "Mountain",
    "2",
    "5030",
    "足立山",
    "あだちやま",
    "Adachi Yama",
    "33°52'",
    "130°55'",
    "Mountain",
  ].join("\n");

  const entries = parsePageText(text);
  assertEquals(entries.length, 1);
  assertEquals(entries[0].name, "足立山");
});

Deno.test("parsePageText: 緯度経度が度分形式でない場合スキップ", () => {
  const text = [
    "1",
    "5030",
    "壊れたデータ",
    "こわれたでーた",
    "Broken Data",
    "not-a-lat",
    "not-a-lon",
    "Mountain",
    "2",
    "5030",
    "足立山",
    "あだちやま",
    "Adachi Yama",
    "33°52'",
    "130°55'",
    "Mountain",
  ].join("\n");

  const entries = parsePageText(text);
  assertEquals(entries.length, 1);
  assertEquals(entries[0].name, "足立山");
});

Deno.test("parsePageText: （）付きエントリの alias 分解", () => {
  const text = [
    "1",
    "5539",
    "烏帽子岳（乳頭山）",
    "えぼしだけ（にゅうとうざん）",
    "Eboshi Dake",
    "39°51'",
    "140°47'",
    "Mountain",
  ].join("\n");

  const entries = parsePageText(text);
  assertEquals(entries.length, 1);
  assertEquals(entries[0].name, "烏帽子岳");
  assertEquals(entries[0].reading, "えぼしだけ");
  assertEquals(entries[0].aliases, [
    { name: "乳頭山", reading: "にゅうとうざん" },
  ]);
});

Deno.test("parsePageText: カタカナ reading がひらがなに変換される", () => {
  const text = [
    "1",
    "6544",
    "アトサヌプリ",
    "アトサヌプリ",
    "Atosa Nupuri",
    "43°37'",
    "144°27'",
    "Mountain",
  ].join("\n");

  const entries = parsePageText(text);
  assertEquals(entries.length, 1);
  assertEquals(entries[0].name, "アトサヌプリ");
  assertEquals(entries[0].reading, "あとさぬぷり");
});

Deno.test("parsePageText: カタカナ混在 reading の変換", () => {
  const text = [
    "1",
    "6544",
    "アポイ岳",
    "アポイだけ",
    "Apoi Dake",
    "42°06'",
    "143°01'",
    "Mountain",
  ].join("\n");

  const entries = parsePageText(text);
  assertEquals(entries.length, 1);
  assertEquals(entries[0].reading, "あぽいだけ");
});

Deno.test("parsePageText: 空テキスト", () => {
  const entries = parsePageText("");
  assertEquals(entries.length, 0);
});

Deno.test("parsePageText: データが8行に満たない場合", () => {
  const text = [
    "1",
    "5030",
    "足立山",
  ].join("\n");

  const entries = parsePageText(text);
  assertEquals(entries.length, 0);
});
