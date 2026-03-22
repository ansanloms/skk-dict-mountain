# skk-dict-mountain

日本の山岳名を収録した [SKK](https://skk-dev.github.io/dict/) 辞書です。

## 概要

国土地理院が公開している以下のデータを元に、日本の山岳名の SKK 辞書ファイル (`SKK-JISYO.mountain`) を生成します。

- [日本の主な山岳一覧（1003山）](https://www.gsi.go.jp/kihonjohochousa/kihonjohochousa41139.html) — GeoJSON 形式
- [地名集日本（Gazetteer of Japan）](https://www.gsi.go.jp/kihonjohochousa/gazetteer.html) — PDF 形式

1003山のデータには標高・都道府県の情報が含まれるため、SKK の annotation として付与しています。

```
ふじさん /富士山;3,776m 静岡県,山梨県/
```

## 必要なもの

- [Deno](https://deno.land/) v2 以降

## ビルド

```sh
deno task build
```

これにより以下の処理が順に実行されます。

1. データソースのダウンロード (`dist/`)
2. GeoJSON への変換 (`data/`)
3. SKK 辞書の生成 (`data/SKK-JISYO.mountain`)

個別に実行する場合は `deno task` で利用可能なタスク一覧を確認してください。

## 辞書の使い方

生成された `data/SKK-JISYO.mountain` を SKK の辞書として追加してください。設定方法はお使いの SKK 実装のドキュメントを参照してください。

## データソースについて

本辞書は以下の国土地理院コンテンツを加工して作成しています。

- 国土地理院「[日本の主な山岳一覧（1003山）](https://www.gsi.go.jp/kihonjohochousa/kihonjohochousa41139.html)」（GeoJSON データ）
- 国土地理院「[地名集日本](https://www.gsi.go.jp/kihonjohochousa/gazetteer.html)」（PDF データ）

利用にあたっては[国土地理院コンテンツ利用規約](https://www.gsi.go.jp/kikakuchousei/kikakuchousei40182.html)に従ってください。

## ライセンス

- **ソースコード**: [MIT License](./LICENSE)
- **生成される辞書データ**: 国土地理院のコンテンツを加工して作成したものであり、[国土地理院コンテンツ利用規約](https://www.gsi.go.jp/kikakuchousei/kikakuchousei40182.html)（[政府標準利用規約（第1.0版）](https://www.kantei.go.jp/jp/singi/it2/densi/kettei/gl2_betten_1.pdf)準拠）が適用されます。
