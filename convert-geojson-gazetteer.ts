/**
 * 国土地理院「地名集日本」PDF から全エントリを抽出し、
 * RFC 7946 準拠の GeoJSON に変換する。
 *
 * - PDF のテキストを mupdf で抽出
 * - 名前の末尾（）を alias として分解
 * - カタカナの読みをひらがなに変換
 * - 緯度経度を度分形式から十進数に変換
 */

import * as mupdf from "mupdf";
import { ensureDir } from "@std/fs/ensure-dir";

const PDF_PATH = new URL("./dist/gazetteer.pdf", import.meta.url);
const OUT_PATH = new URL("./data/gazetteer.geojson", import.meta.url);

/** データ開始ページ（0-indexed: ページ8 = index 7） */
const DATA_START_PAGE = 7;

export interface Alias {
  name: string;
  reading: string;
}

export interface GazetteerEntry {
  meshCode: string;
  name: string;
  reading: string;
  aliases: Alias[];
  romanized: string;
  latitude: number;
  longitude: number;
  classification: string;
}

/**
 * カタカナをひらがなに変換する。
 * U+30A1〜U+30F6 → U+3041〜U+3096 にシフト。
 */
export function katakanaToHiragana(s: string): string {
  return s.replace(
    /[\u30A1-\u30F6]/g,
    (ch) => String.fromCharCode(ch.charCodeAt(0) - 0x60),
  );
}

/**
 * 名前から末尾の（）を分解する。
 * 末尾が「（...）」の場合のみ alias として分離する。
 * 途中に「（）」がある場合（例: 火山（硫黄）列島）は分解しない。
 */
export function splitAlias(
  name: string,
  reading: string,
): { name: string; reading: string; aliases: Alias[] } {
  const nameMatch = name.match(/^(.+)（(.+)）$/);
  if (!nameMatch) {
    // 名前に（）がなくても読みに（）がある場合（例: ざおうざん（ざおうさん））
    const readingMatch = reading.match(/^(.+)（(.+)）$/);
    if (readingMatch) {
      return {
        name,
        reading: readingMatch[1],
        aliases: [{ name: "", reading: readingMatch[2] }],
      };
    }
    return { name, reading, aliases: [] };
  }

  const readingMatch = reading.match(/^(.+)（(.+)）$/);
  if (readingMatch) {
    return {
      name: nameMatch[1],
      reading: readingMatch[1],
      aliases: [{ name: nameMatch[2], reading: readingMatch[2] }],
    };
  }

  return {
    name: nameMatch[1],
    reading,
    aliases: [{ name: nameMatch[2], reading: "" }],
  };
}

/**
 * 度分形式（例: "44°01'" や "144°17'"）を十進数に変換する。
 */
export function parseDegreeMinute(s: string): number {
  const m = s.match(/^(\d+)°(\d+(?:\.\d+)?)[''′]?$/);
  if (!m) {
    throw new Error(`Failed to parse degree-minute: "${s}"`);
  }
  const deg = parseInt(m[1], 10);
  const min = parseFloat(m[2]);
  return deg + min / 60;
}

/**
 * ページのプレーンテキストからエントリを抽出する。
 *
 * 各エントリは以下の構造（改行区切り）:
 *   連番, メッシュコード, 漢字名, かな, ローマ字, 緯度, 経度, Classification
 */
export function parsePageText(text: string): GazetteerEntry[] {
  const lines = text.split("\n").map((l) => l.trim()).filter((l) => l !== "");
  const entries: GazetteerEntry[] = [];

  let i = 0;
  while (i < lines.length) {
    // 連番（数字）を探す
    if (!/^\d+$/.test(lines[i])) {
      i++;
      continue;
    }

    // 連番の次にメッシュコード（4桁数字）があるか確認
    if (i + 7 > lines.length) {
      break;
    }

    const meshCode = lines[i + 1];
    if (!/^\d{4}$/.test(meshCode)) {
      i++;
      continue;
    }

    const name = lines[i + 2];
    const reading = lines[i + 3];
    const romanized = lines[i + 4];
    const latStr = lines[i + 5];
    const lonStr = lines[i + 6];
    const classification = lines[i + 7];

    // 緯度経度の形式チェック
    if (!/^\d+°/.test(latStr) || !/^\d+°/.test(lonStr)) {
      i++;
      continue;
    }

    try {
      const split = splitAlias(name, katakanaToHiragana(reading));
      entries.push({
        meshCode,
        name: split.name,
        reading: split.reading,
        aliases: split.aliases,
        romanized,
        latitude: parseDegreeMinute(latStr),
        longitude: parseDegreeMinute(lonStr),
        classification,
      });
    } catch {
      // パース失敗はスキップ
      console.warn(`Skip: failed to parse entry at line ${i}: ${name}`);
    }

    i += 8;
  }

  return entries;
}

async function main() {
  console.log(`Reading ${PDF_PATH.pathname} ...`);
  const pdfData = await Deno.readFile(PDF_PATH);
  const doc = mupdf.Document.openDocument(pdfData, "application/pdf");

  const totalPages = doc.countPages();
  console.log(`Total pages: ${totalPages}`);

  const allEntries: GazetteerEntry[] = [];

  for (let i = DATA_START_PAGE; i < totalPages; i++) {
    const page = doc.loadPage(i);
    const text = page.toStructuredText("preserve-whitespace").asText();
    const entries = parsePageText(text);
    allEntries.push(...entries);
  }

  console.log(`Total entries: ${allEntries.length}`);

  const features = allEntries.map((e) => ({
    type: "Feature" as const,
    geometry: {
      type: "Point" as const,
      coordinates: [
        Math.round(e.longitude * 1_000_000) / 1_000_000,
        Math.round(e.latitude * 1_000_000) / 1_000_000,
      ],
    },
    properties: {
      name: e.name,
      reading: e.reading,
      ...(e.aliases.length > 0 ? { aliases: e.aliases } : {}),
      romanized: e.romanized,
      meshCode: e.meshCode,
      classification: e.classification,
    },
  }));

  const output = {
    type: "FeatureCollection" as const,
    features,
  };

  const outDir = new URL(".", OUT_PATH);
  await ensureDir(outDir);
  await Deno.writeTextFile(OUT_PATH, JSON.stringify(output, null, 2) + "\n");

  console.log(`Wrote ${features.length} features to ${OUT_PATH.pathname}`);
}

if (import.meta.main) {
  main();
}
