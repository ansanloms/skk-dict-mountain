/**
 * 国土地理院「日本の主な山岳一覧（1003山）」の GeoJSON を
 * RFC 7946 準拠の GeoJSON に変換する。
 *
 * - crs プロパティを除去（RFC 7946 では CRS は WGS84 固定）
 * - プロパティ名を英語化
 * - 山名の（）＜＞を分解して親子構造にする
 */

import { ensureDir } from "@std/fs/ensure-dir";
import JSZip from "jszip";

const ZIP_PATH = new URL("./dist/1003zan.zip", import.meta.url);
const OUT_PATH = new URL("./data/1003.geojson", import.meta.url);

interface SourceProperties {
  連番: number;
  索引番号: string;
  "山名＜山頂名＞": string;
  "山名よみ＜山頂名よみ＞": string;
  "標高値(m)": number;
  種別: string;
  都道府県: string;
  緯度: number;
  経度: number;
}

interface SourceFeature {
  type: "Feature";
  geometry: { type: "Point"; coordinates: [number, number] };
  properties: SourceProperties;
}

interface SourceGeoJson {
  type: "FeatureCollection";
  features: SourceFeature[];
}

export interface Alias {
  name: string;
  reading: string;
}

export interface ParsedEntry {
  base: string;
  baseReading: string;
  aliases: Alias[];
  summit: string | undefined;
  summitReading: string | undefined;
  summitAliases: Alias[];
}

/**
 * 山名と読みをペアで解析し、（）＜＞を分解する。
 * 名前と読みで（）の有無が異なるケースにも対応する。
 *
 * 例:
 *   名前: 蔵王山＜不忘山（御前岳）＞
 *   読み: ざおうざん（ざおうさん）＜ふぼうさん（おまえだけ）＞
 *
 * → base: 蔵王山 / ざおうざん
 *   alias: ざおうさん（名前側に（）がなくても読み側から取得）
 *   summit: 不忘山 / ふぼうさん
 *   summitAlias: 御前岳 / おまえだけ
 */
export function parseEntry(name: string, reading: string): ParsedEntry {
  let n = name;
  let r = reading;

  let summit: string | undefined;
  let summitReading: string | undefined;
  const summitAliases: Alias[] = [];
  const aliases: Alias[] = [];

  // ＜＞を先に抽出（中に（）が含まれうる）
  const nSummitMatch = n.match(/＜(.+?)＞/);
  const rSummitMatch = r.match(/＜(.+?)＞/);
  if (nSummitMatch) {
    let summitRaw = nSummitMatch[1];
    let summitReadingRaw = rSummitMatch ? rSummitMatch[1] : "";
    n = n.replace(/＜.+?＞/, "").trim();
    r = r.replace(/＜.+?＞/, "").trim();

    // summit 内の（）
    const nInner = summitRaw.match(/（(.+?)）/);
    const rInner = summitReadingRaw.match(/（(.+?)）/);
    if (nInner || rInner) {
      const aliasName = nInner ? nInner[1] : "";
      const aliasReading = rInner ? rInner[1] : "";
      summitAliases.push({ name: aliasName, reading: aliasReading });
      if (nInner) {
        summitRaw = summitRaw.replace(/（.+?）/, "").trim();
      }
      if (rInner) {
        summitReadingRaw = summitReadingRaw.replace(/（.+?）/, "").trim();
      }
    }

    summit = summitRaw;
    summitReading = summitReadingRaw || undefined;
  }

  // 本体の（）を抽出（名前側と読み側を独立に処理）
  const nAlias = n.match(/（(.+?)）/);
  const rAlias = r.match(/（(.+?)）/);
  if (nAlias || rAlias) {
    const aliasName = nAlias ? nAlias[1] : "";
    const aliasReading = rAlias ? rAlias[1] : "";
    aliases.push({ name: aliasName, reading: aliasReading });
    if (nAlias) {
      n = n.replace(/（.+?）/, "").trim();
    }
    if (rAlias) {
      r = r.replace(/（.+?）/, "").trim();
    }
  }

  return {
    base: n,
    baseReading: r,
    aliases,
    summit,
    summitReading,
    summitAliases,
  };
}

interface OutputFeature {
  type: "Feature";
  geometry: { type: "Point"; coordinates: [number, number] } | null;
  properties: Record<string, unknown>;
}

/** スペース区切りの都道府県文字列を配列に分割する。 */
function splitPrefectures(s: string | undefined): string[] | undefined {
  if (!s) {
    return undefined;
  }
  const parts = s.split(/\s+/).filter((p) => p !== "");
  return parts.length > 0 ? parts : undefined;
}

async function extractGeoJson(zipData: Uint8Array): Promise<SourceGeoJson> {
  const zip = await JSZip.loadAsync(zipData);
  const entry = Object.values(zip.files).find((f) =>
    f.name.endsWith(".geojson")
  );
  if (!entry) {
    throw new Error("GeoJSON file not found in ZIP");
  }
  const text = await entry.async("text");
  return JSON.parse(text);
}

async function main() {
  console.log(`Reading ${ZIP_PATH.pathname} ...`);
  const zipData = await Deno.readFile(ZIP_PATH);
  const source = await extractGeoJson(zipData);

  console.log(`Source features: ${source.features.length}`);

  // 1. 全エントリを parseEntry で解析
  const parsed = source.features.map((f) =>
    parseEntry(
      f.properties["山名＜山頂名＞"],
      f.properties["山名よみ＜山頂名よみ＞"],
    )
  );

  // 2. ＜＞を持つエントリから親名を収集し、親 Feature の情報を集める
  interface ParentInfo {
    aliases: Alias[];
    geometry: { type: "Point"; coordinates: [number, number] } | null;
    elevation: number | undefined;
    elevationType: string | undefined;
    prefectures: string[] | undefined;
  }
  const parentMap = new Map<string, ParentInfo>();

  for (let i = 0; i < source.features.length; i++) {
    const p = parsed[i];
    if (!p.summit) {
      continue;
    }

    if (!parentMap.has(p.base)) {
      parentMap.set(p.base, {
        aliases: [...p.aliases],
        geometry: null,
        elevation: undefined,
        elevationType: undefined,
        prefectures: undefined,
      });
    }
  }

  // 本体エントリ（summit なし）で親名と一致するものがあれば座標を親に割り当てる
  for (let i = 0; i < source.features.length; i++) {
    const p = parsed[i];
    if (p.summit) {
      continue;
    }

    const parent = parentMap.get(p.base);
    if (parent && parent.geometry === null) {
      const f = source.features[i];
      parent.geometry = f.geometry;
      parent.elevation = f.properties["標高値(m)"];
      parent.elevationType = f.properties["種別"];
      parent.prefectures = splitPrefectures(f.properties["都道府県"]);
      if (p.aliases.length > 0 && parent.aliases.length === 0) {
        parent.aliases = [...p.aliases];
      }
    }
  }

  // 本体エントリがない親には最初の子エントリからデータを補完する
  for (let i = 0; i < source.features.length; i++) {
    const p = parsed[i];
    if (!p.summit) {
      continue;
    }

    const parent = parentMap.get(p.base);
    if (parent && parent.elevation === undefined) {
      const f = source.features[i];
      parent.elevation = f.properties["標高値(m)"];
      parent.elevationType = f.properties["種別"];
      parent.prefectures = splitPrefectures(f.properties["都道府県"]);
    }
  }

  // 3. Feature を生成
  const features: OutputFeature[] = [];
  const parentNames = new Set(parentMap.keys());
  const emittedParents = new Set<string>();

  /** 親 Feature を出力する（未出力の場合のみ） */
  function emitParent(p: ParsedEntry): void {
    if (emittedParents.has(p.base)) {
      return;
    }

    const parent = parentMap.get(p.base)!;
    const props: Record<string, unknown> = {
      name: p.base,
      reading: p.baseReading,
    };
    if (parent.aliases.length > 0) {
      props.aliases = parent.aliases;
    }
    if (parent.elevation !== undefined) {
      props.elevation = parent.elevation;
    }
    if (parent.elevationType) {
      props.elevationType = parent.elevationType;
    }
    if (parent.prefectures) {
      props.prefectures = parent.prefectures;
    }

    features.push({
      type: "Feature",
      geometry: parent.geometry,
      properties: props,
    });
    emittedParents.add(p.base);
  }

  for (let i = 0; i < source.features.length; i++) {
    const f = source.features[i];
    const p = parsed[i];

    if (p.summit) {
      // 山頂エントリ → 親を出力してから子を出力
      emitParent(p);

      const props: Record<string, unknown> = {
        name: p.summit,
        reading: p.summitReading,
        parent: p.base,
        elevation: f.properties["標高値(m)"],
        elevationType: f.properties["種別"],
        prefectures: splitPrefectures(f.properties["都道府県"]),
      };
      if (p.summitAliases.length > 0) {
        props.aliases = p.summitAliases;
      }

      features.push({
        type: "Feature",
        geometry: f.geometry,
        properties: props,
      });
    } else if (parentNames.has(p.base)) {
      // 本体エントリだが親として使われるもの
      emitParent(p);

      // 本体自身も山頂として子 Feature にする
      features.push({
        type: "Feature",
        geometry: f.geometry,
        properties: {
          name: p.base,
          reading: p.baseReading,
          parent: p.base,
          elevation: f.properties["標高値(m)"],
          elevationType: f.properties["種別"],
          prefectures: splitPrefectures(f.properties["都道府県"]),
        },
      });
    } else {
      // 通常の山
      const props: Record<string, unknown> = {
        name: p.base,
        reading: p.baseReading,
        elevation: f.properties["標高値(m)"],
        elevationType: f.properties["種別"],
        prefectures: splitPrefectures(f.properties["都道府県"]),
      };
      if (p.aliases.length > 0) {
        props.aliases = p.aliases;
      }

      features.push({
        type: "Feature",
        geometry: f.geometry,
        properties: props,
      });
    }
  }

  const output = {
    type: "FeatureCollection" as const,
    features,
  };

  const outDir = new URL(".", OUT_PATH);
  await ensureDir(outDir);
  await Deno.writeTextFile(OUT_PATH, JSON.stringify(output, null, 2) + "\n");

  // 統計
  const parents = features.filter(
    (f) =>
      f.properties.parent === undefined && features.some(
        (c) => c.properties.parent === f.properties.name,
      ),
  );
  const children = features.filter((f) => f.properties.parent !== undefined);
  const standalone = features.length - parents.length - children.length;

  console.log(`Output: ${features.length} features`);
  console.log(`  Parent (mountain group): ${parents.length}`);
  console.log(`  Summit (child): ${children.length}`);
  console.log(`  Standalone: ${standalone}`);
  console.log(`Wrote to ${OUT_PATH.pathname}`);
}

if (import.meta.main) {
  main();
}
