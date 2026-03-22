import { assertEquals } from "@std/assert";
import {
  addEntry,
  buildAnnotation,
  formatDictLine,
  formatNumber,
} from "./convert-skk-dict.ts";

// --- formatNumber ---

Deno.test("formatNumber: 4桁以上はカンマ区切り", () => {
  assertEquals(formatNumber(1131), "1,131");
});

Deno.test("formatNumber: 3桁以下はそのまま", () => {
  assertEquals(formatNumber(999), "999");
});

Deno.test("formatNumber: 0", () => {
  assertEquals(formatNumber(0), "0");
});

// --- buildAnnotation ---

Deno.test("buildAnnotation: 標高と都道府県の両方", () => {
  assertEquals(
    buildAnnotation(3776, ["静岡県", "山梨県"], undefined),
    "3,776m 静岡県,山梨県",
  );
});

Deno.test("buildAnnotation: 標高のみ", () => {
  assertEquals(buildAnnotation(1131, undefined, undefined), "1,131m");
});

Deno.test("buildAnnotation: 都道府県のみ", () => {
  assertEquals(buildAnnotation(undefined, ["北海道"], undefined), "北海道");
});

Deno.test("buildAnnotation: 都道府県3県", () => {
  assertEquals(
    buildAnnotation(2899, ["埼玉県", "山梨県", "長野県"], undefined),
    "2,899m 埼玉県,山梨県,長野県",
  );
});

Deno.test("buildAnnotation: 両方なし → undefined", () => {
  assertEquals(buildAnnotation(undefined, undefined, undefined), undefined);
});

Deno.test("buildAnnotation: 空配列 → 標高のみ", () => {
  assertEquals(buildAnnotation(100, [], undefined), "100m");
});

Deno.test("buildAnnotation: parent あり", () => {
  assertEquals(
    buildAnnotation(1841, ["山形県", "宮城県"], "蔵王山"),
    "1,841m 山形県,宮城県 蔵王山の一座",
  );
});

Deno.test("buildAnnotation: parent のみ", () => {
  assertEquals(
    buildAnnotation(undefined, undefined, "蔵王山"),
    "蔵王山の一座",
  );
});

// --- addEntry ---

Deno.test("addEntry: 基本追加", () => {
  const dict = new Map<
    string,
    { kanji: string; annotation: string | undefined }[]
  >();
  addEntry(dict, "ふじさん", "富士山", "3,776m");
  assertEquals(dict.get("ふじさん"), [{
    kanji: "富士山",
    annotation: "3,776m",
  }]);
});

Deno.test("addEntry: 同一漢字の重複は追加しない", () => {
  const dict = new Map<
    string,
    { kanji: string; annotation: string | undefined }[]
  >();
  addEntry(dict, "ふじさん", "富士山", "3,776m");
  addEntry(dict, "ふじさん", "富士山", undefined);
  assertEquals(dict.get("ふじさん")!.length, 1);
});

Deno.test("addEntry: annotation なし → あり で置き換え", () => {
  const dict = new Map<
    string,
    { kanji: string; annotation: string | undefined }[]
  >();
  addEntry(dict, "ふじさん", "富士山", undefined);
  addEntry(dict, "ふじさん", "富士山", "3,776m");
  assertEquals(dict.get("ふじさん")!.length, 1);
  assertEquals(dict.get("ふじさん")![0].annotation, "3,776m");
});

Deno.test("addEntry: 空文字の読みは無視", () => {
  const dict = new Map<
    string,
    { kanji: string; annotation: string | undefined }[]
  >();
  addEntry(dict, "", "富士山", undefined);
  assertEquals(dict.size, 0);
});

Deno.test("addEntry: 空文字の漢字は無視", () => {
  const dict = new Map<
    string,
    { kanji: string; annotation: string | undefined }[]
  >();
  addEntry(dict, "ふじさん", "", undefined);
  assertEquals(dict.size, 0);
});

Deno.test("addEntry: 同一漢字でも annotation が違えば別候補", () => {
  const dict = new Map<
    string,
    { kanji: string; annotation: string | undefined }[]
  >();
  addEntry(dict, "こまがたけ", "駒ヶ岳", "1,158m 秋田県");
  addEntry(dict, "こまがたけ", "駒ヶ岳", "2,956m 長野県");
  addEntry(dict, "こまがたけ", "駒ヶ岳", "2,967m 山梨県,長野県");
  assertEquals(dict.get("こまがたけ")!.length, 3);
  assertEquals(dict.get("こまがたけ")![0].annotation, "1,158m 秋田県");
  assertEquals(dict.get("こまがたけ")![1].annotation, "2,956m 長野県");
  assertEquals(dict.get("こまがたけ")![2].annotation, "2,967m 山梨県,長野県");
});

Deno.test("addEntry: 完全一致（漢字+annotation）は重複追加しない", () => {
  const dict = new Map<
    string,
    { kanji: string; annotation: string | undefined }[]
  >();
  addEntry(dict, "こまがたけ", "駒ヶ岳", "1,158m 秋田県");
  addEntry(dict, "こまがたけ", "駒ヶ岳", "1,158m 秋田県");
  assertEquals(dict.get("こまがたけ")!.length, 1);
});

Deno.test("addEntry: 同一読みに異なる漢字を追加", () => {
  const dict = new Map<
    string,
    { kanji: string; annotation: string | undefined }[]
  >();
  addEntry(dict, "こまがたけ", "駒ヶ岳", "1,131m 北海道");
  addEntry(dict, "こまがたけ", "駒ケ岳", "1,500m 秋田県");
  assertEquals(dict.get("こまがたけ")!.length, 2);
});

// --- formatDictLine ---

Deno.test("formatDictLine: annotation あり", () => {
  const line = formatDictLine("ふじさん", [
    { kanji: "富士山", annotation: "3,776m 静岡県,山梨県" },
  ]);
  assertEquals(line, "ふじさん /富士山;3,776m 静岡県,山梨県/");
});

Deno.test("formatDictLine: annotation なし", () => {
  const line = formatDictLine("たかおさん", [
    { kanji: "高尾山", annotation: undefined },
  ]);
  assertEquals(line, "たかおさん /高尾山/");
});

Deno.test("formatDictLine: 複数候補", () => {
  const line = formatDictLine("こまがたけ", [
    { kanji: "駒ヶ岳", annotation: "1,131m 北海道" },
    { kanji: "駒ケ岳", annotation: "1,500m 秋田県" },
  ]);
  assertEquals(line, "こまがたけ /駒ヶ岳;1,131m 北海道/駒ケ岳;1,500m 秋田県/");
});
