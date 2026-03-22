/**
 * 国土地理院「地名集日本」PDF をダウンロードする。
 */

import { ensureDir } from "@std/fs/ensure-dir";

const SOURCE_URL = "https://www.gsi.go.jp/common/000238259.pdf";
const DIST_DIR = new URL("./dist/", import.meta.url);
const DEST = new URL("gazetteer.pdf", DIST_DIR);

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
