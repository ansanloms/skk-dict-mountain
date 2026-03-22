/**
 * data/1003.geojson と data/gazetteer.geojson を統合し、
 * SKK 辞書ファイル data/SKK-JISYO.mountain を生成する。
 */

import { ensureDir } from "@std/fs/ensure-dir";

const GEOJSON_1003 = new URL("./data/1003.geojson", import.meta.url);
const GEOJSON_GAZETTEER = new URL("./data/gazetteer.geojson", import.meta.url);
const OUT_PATH = new URL("./data/SKK-JISYO.mountain", import.meta.url);

interface Feature {
  type: "Feature";
  geometry: unknown;
  properties: Record<string, unknown>;
}

interface FeatureCollection {
  type: "FeatureCollection";
  features: Feature[];
}

interface DictCandidate {
  kanji: string;
  annotation: string | undefined;
}

/** Mountain 系の Classification */
const MOUNTAIN_CLASSIFICATIONS = new Set([
  "Mountain",
  "Mountain, Hill",
  "Mountains",
  "Volcano",
  "Peak",
]);

/**
 * 数値を 3 桁区切りにフォーマットする。
 * 例: 1131 → "1,131"
 */
export function formatNumber(n: number): string {
  return n.toLocaleString("en-US");
}

/**
 * annotation 文字列を生成する。
 * 標高と都道府県があれば "{標高}m {都道府県1},{都道府県2}" 形式。
 */
export function buildAnnotation(
  elevation: number | undefined,
  prefectures: string[] | undefined,
  parent: string | undefined,
): string | undefined {
  const parts: string[] = [];
  if (elevation !== undefined) {
    parts.push(`${formatNumber(elevation)}m`);
  }
  if (prefectures && prefectures.length > 0) {
    parts.push(prefectures.join(","));
  }
  if (parent) {
    parts.push(`${parent}の一座`);
  }
  if (parts.length === 0) {
    return undefined;
  }
  return parts.join(" ");
}

/**
 * 読み→候補リストの Map にエントリを追加する。
 * 同一読み・同一漢字・同一 annotation の完全一致のみ重複として扱う。
 * 同一漢字でも annotation が異なれば別候補として追加する（駒ヶ岳等）。
 * annotation なしのエントリは、同一漢字で annotation ありが既にあれば追加しない。
 */
export function addEntry(
  dict: Map<string, DictCandidate[]>,
  reading: string,
  kanji: string,
  annotation: string | undefined,
): void {
  if (!reading || !kanji) {
    return;
  }

  let candidates = dict.get(reading);
  if (!candidates) {
    candidates = [];
    dict.set(reading, candidates);
  }

  // 完全一致（漢字 + annotation）の重複チェック
  const exact = candidates.find(
    (c) => c.kanji === kanji && c.annotation === annotation,
  );
  if (exact) {
    return;
  }

  // annotation なしの場合、同一漢字で annotation ありが既にあればスキップ
  if (!annotation) {
    const hasAnnotated = candidates.some(
      (c) => c.kanji === kanji && c.annotation,
    );
    if (hasAnnotated) {
      return;
    }
  }

  // annotation ありの場合、同一漢字で annotation なしのものがあれば除去
  if (annotation) {
    const noAnnotIdx = candidates.findIndex(
      (c) => c.kanji === kanji && !c.annotation,
    );
    if (noAnnotIdx !== -1) {
      candidates.splice(noAnnotIdx, 1);
    }
  }

  candidates.push({ kanji, annotation });
}

/**
 * SKK 辞書形式の行を生成する。
 */
export function formatDictLine(
  reading: string,
  candidates: DictCandidate[],
): string {
  const entries = candidates.map((c) =>
    c.annotation ? `${c.kanji};${c.annotation}` : c.kanji
  );
  return `${reading} /${entries.join("/")}/`;
}

async function main() {
  const data1003: FeatureCollection = JSON.parse(
    await Deno.readTextFile(GEOJSON_1003),
  );
  const dataGazetteer: FeatureCollection = JSON.parse(
    await Deno.readTextFile(GEOJSON_GAZETTEER),
  );

  console.log(`1003山: ${data1003.features.length} features`);
  console.log(`地名集日本: ${dataGazetteer.features.length} features`);

  const dict = new Map<string, DictCandidate[]>();

  // 1003山（annotation あり）を先に処理
  for (const f of data1003.features) {
    const p = f.properties;
    const name = p.name as string;
    const reading = p.reading as string;
    const elevation = p.elevation as number | undefined;
    const prefectures = p.prefectures as string[] | undefined;
    const parent = p.parent as string | undefined;
    const aliases = (p.aliases ?? []) as { name: string; reading: string }[];

    const annotation = buildAnnotation(
      elevation,
      prefectures,
      parent !== name ? parent : undefined,
    );

    // メインエントリ
    addEntry(dict, reading, name, annotation);

    // alias エントリ
    const aliasAnnotationParts = [
      buildAnnotation(elevation, prefectures, undefined),
      `${name}の別名`,
    ].filter(Boolean).join(" ");
    for (const a of aliases) {
      if (a.name && a.reading) {
        // 漢字も読みもある別名
        addEntry(dict, a.reading, a.name, aliasAnnotationParts);
      } else if (!a.name && a.reading) {
        // 読みだけの別称（例: 蔵王山 ざおうさん）
        addEntry(dict, a.reading, name, annotation);
      } else if (a.name && !a.reading) {
        // 漢字だけの別名（読み不明なのでスキップ）
      }
    }
  }

  // 地名集日本（Mountain 系のみ、annotation なし）
  const gazetteerMountains = dataGazetteer.features.filter((f) =>
    MOUNTAIN_CLASSIFICATIONS.has(f.properties.classification as string)
  );
  console.log(`地名集日本 (Mountain): ${gazetteerMountains.length} features`);

  for (const f of gazetteerMountains) {
    const p = f.properties;
    const name = p.name as string;
    const reading = p.reading as string;
    const aliases = (p.aliases ?? []) as { name: string; reading: string }[];

    addEntry(dict, reading, name, undefined);

    for (const a of aliases) {
      if (a.name && a.reading) {
        addEntry(dict, a.reading, a.name, `${name}の別名`);
      } else if (!a.name && a.reading) {
        addEntry(dict, a.reading, name, undefined);
      }
    }
  }

  // 読みの辞書順でソート
  const sortedKeys = [...dict.keys()].sort();

  const lines: string[] = [
    ";; SKK-JISYO.mountain - 日本の山岳辞書",
    ";; Generated from GSI (Geospatial Information Authority of Japan) data",
    ";; - 日本の主な山岳一覧（1003山）",
    ";; - 地名集日本",
    ";; okuri-nasi entries.",
  ];

  for (const key of sortedKeys) {
    lines.push(formatDictLine(key, dict.get(key)!));
  }

  lines.push(""); // 末尾改行

  const outDir = new URL(".", OUT_PATH);
  await ensureDir(outDir);
  await Deno.writeTextFile(OUT_PATH, lines.join("\n"));

  // 統計
  let totalCandidates = 0;
  for (const candidates of dict.values()) {
    totalCandidates += candidates.length;
  }

  console.log(
    `Output: ${sortedKeys.length} readings, ${totalCandidates} candidates`,
  );
  console.log(`Wrote to ${OUT_PATH.pathname}`);
}

if (import.meta.main) {
  main();
}
