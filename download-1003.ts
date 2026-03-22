/**
 * 国土地理院「日本の主な山岳一覧（1003山）」の GeoJSON (ZIP) をダウンロードする。
 */

import { ensureDir } from "@std/fs/ensure-dir";

const SOURCE_URL =
  "https://www.gsi.go.jp/KOKUJYOHO/MOUNTAIN/1003zan20260130.zip";
const DIST_DIR = new URL("./dist/", import.meta.url);
const DEST = new URL("1003zan.zip", DIST_DIR);

async function main() {
  await ensureDir(DIST_DIR);

  console.log(`Downloading ${SOURCE_URL} ...`);
  const res = await fetch(SOURCE_URL);
  if (!res.ok) {
    throw new Error(`${res.status} ${res.statusText}: ${SOURCE_URL}`);
  }
  const data = new Uint8Array(await res.arrayBuffer());
  await Deno.writeFile(DEST, data);
  console.log(
    `  -> ${DEST.pathname} (${(data.byteLength / 1024).toFixed(0)} KB)`,
  );
}

if (import.meta.main) {
  main();
}
