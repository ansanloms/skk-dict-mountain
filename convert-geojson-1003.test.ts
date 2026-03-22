import { assertEquals } from "@std/assert";
import { parseEntry } from "./convert-geojson-1003.ts";

Deno.test("parseEntry: 装飾なしの山", () => {
  const result = parseEntry("富士山", "ふじさん");
  assertEquals(result, {
    base: "富士山",
    baseReading: "ふじさん",
    aliases: [],
    summit: undefined,
    summitReading: undefined,
    summitAliases: [],
  });
});

Deno.test("parseEntry: （）別称のみ", () => {
  const result = parseEntry("利尻山（利尻富士）", "りしりざん（りしりふじ）");
  assertEquals(result, {
    base: "利尻山",
    baseReading: "りしりざん",
    aliases: [{ name: "利尻富士", reading: "りしりふじ" }],
    summit: undefined,
    summitReading: undefined,
    summitAliases: [],
  });
});

Deno.test("parseEntry: ＜＞山頂名のみ", () => {
  const result = parseEntry("八甲田山＜大岳＞", "はっこうださん＜おおだけ＞");
  assertEquals(result, {
    base: "八甲田山",
    baseReading: "はっこうださん",
    aliases: [],
    summit: "大岳",
    summitReading: "おおだけ",
    summitAliases: [],
  });
});

Deno.test("parseEntry: （）＋＜＞の組み合わせ", () => {
  const result = parseEntry(
    "大雪山（ヌタプカウシペ）＜旭岳＞",
    "たいせつざん（ぬたぷかうしぺ）＜あさひだけ＞",
  );
  assertEquals(result, {
    base: "大雪山",
    baseReading: "たいせつざん",
    aliases: [{ name: "ヌタプカウシペ", reading: "ぬたぷかうしぺ" }],
    summit: "旭岳",
    summitReading: "あさひだけ",
    summitAliases: [],
  });
});

Deno.test("parseEntry: summit 内の alias（蔵王山＜不忘山（御前岳）＞）", () => {
  const result = parseEntry(
    "蔵王山＜不忘山（御前岳）＞",
    "ざおうざん（ざおうさん）＜ふぼうさん（おまえだけ）＞",
  );
  assertEquals(result, {
    base: "蔵王山",
    baseReading: "ざおうざん",
    aliases: [{ name: "", reading: "ざおうさん" }],
    summit: "不忘山",
    summitReading: "ふぼうさん",
    summitAliases: [{ name: "御前岳", reading: "おまえだけ" }],
  });
});

Deno.test("parseEntry: 読みだけに（）がある（蔵王山＜熊野岳＞）", () => {
  const result = parseEntry(
    "蔵王山＜熊野岳＞",
    "ざおうざん（ざおうさん）＜くまのだけ＞",
  );
  assertEquals(result, {
    base: "蔵王山",
    baseReading: "ざおうざん",
    aliases: [{ name: "", reading: "ざおうさん" }],
    summit: "熊野岳",
    summitReading: "くまのだけ",
    summitAliases: [],
  });
});

Deno.test("parseEntry: 本体エントリ（＜＞なし、（）なし）", () => {
  const result = parseEntry("雌阿寒岳", "めあかんだけ");
  assertEquals(result, {
    base: "雌阿寒岳",
    baseReading: "めあかんだけ",
    aliases: [],
    summit: undefined,
    summitReading: undefined,
    summitAliases: [],
  });
});

Deno.test("parseEntry: ＜＞の山頂エントリ", () => {
  const result = parseEntry(
    "雌阿寒岳＜阿寒富士＞",
    "めあかんだけ＜あかんふじ＞",
  );
  assertEquals(result, {
    base: "雌阿寒岳",
    baseReading: "めあかんだけ",
    aliases: [],
    summit: "阿寒富士",
    summitReading: "あかんふじ",
    summitAliases: [],
  });
});
