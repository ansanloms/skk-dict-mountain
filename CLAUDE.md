# CLAUDE.md

日本の山を網羅した SKK 辞書を生成するプロジェクト。

## データソース

- **1003山**: 国土地理院「日本の主な山岳一覧」GeoJSON (ZIP)
- **地名集日本**: 国土地理院「地名集日本」PDF

## ディレクトリ構成

```
dist/           ダウンロードした元データ（git 管理外）
data/           変換済み GeoJSON（git 管理外）
```

## タスク

```sh
deno task build                      # download → GeoJSON 変換 → SKK 辞書生成
deno task download                   # 全データソースを dist/ にダウンロード
deno task download:1003              # 1003山 ZIP をダウンロード
deno task download:gazetteer         # 地名集日本 PDF をダウンロード
deno task convert-geojson            # 全 GeoJSON 変換
deno task convert-geojson:1003       # 1003山 → data/1003.geojson
deno task convert-geojson:gazetteer  # 地名集日本 → data/gazetteer.geojson
deno task convert-skk-dict           # GeoJSON → SKK 辞書 (data/SKK-JISYO.mountain)
deno task lint                       # lint + fmt check
deno task fix                        # lint fix + fmt
deno task check                      # 型チェック
deno task test                       # テスト実行
```

## 開発フロー

1. `deno task download` でデータ取得
2. `deno task convert-geojson` で GeoJSON 変換
3. `deno task convert-skk-dict` で SKK 辞書生成
4. `deno task test` でテスト

## スクリプト構成

- `download-1003.ts`: 1003山 ZIP のダウンロード。
- `download-gazetteer.ts`: 地名集日本 PDF のダウンロード。
- `convert-geojson-1003.ts`: 1003山 ZIP → RFC 7946 GeoJSON。山名の（）＜＞を分解して親子構造にする。
- `convert-geojson-gazetteer.ts`: 地名集日本 PDF → RFC 7946 GeoJSON。mupdf でテキスト抽出し全エントリ出力。末尾（）は alias に分解。カタカナ読みはひらがなに変換。
- `convert-skk-dict.ts`: 1003山 + 地名集日本の GeoJSON を統合し SKK 辞書を生成。Mountain 系のみフィルタ。annotation に標高・都道府県を付与。

## テスト

テストファイルは `*.test.ts`。パースロジックの純粋関数テストのみで、ネットワークや外部ファイルに依存しない。
