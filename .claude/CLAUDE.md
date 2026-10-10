# CLAUDE.md（プロジェクト固有ルール）

バイト先向け「なぞり書きPOP」生成ツール。詳細な設計判断は [.claude/design.md](design.md)、
作業状況は [.claude/TODO.md](TODO.md) を必ず先に読むこと。使い方・構成は [README.md](../README.md)。

## 構成の要点

- 完全静的サイト（バニラ HTML / CSS / JS、ES modules）。サーバー処理なし
- ホスティング: GitHub Pages、`pop.mnlight.dev`（CNAME 済み）。shift-tool / pc-tool と同じ運用
- 状態は localStorage（`pop.state` / `pop.layouts`）、端末ローカルフォントは IndexedDB（`pop-fonts`）、台紙画像は IndexedDB（`pop-backgrounds`）
- 印刷はブラウザ標準（`window.print()`）。`@page size` を `#page-style` に JS で動的生成

## 守ること

- 公開リポジトリ前提。**会社名・競合名・店舗名・個人情報をコードやサンプルに書かない**（サンプル型番も架空のものを使う）
- **台紙画像・店の写真（`*.HEIC` 等）は絶対にコミットしない**（会社ロゴ・マスコット入り）。gitignore 済みだが新しい形式を置くときは先に ignore へ
- 商品リストの入力欄は内容幅を十分に取る（内容幅 ≤ 0 だと Chrome の IME 入力が逆順になる実バグあり。design.md 参照）
- `vendor/fonts/` に置くフォントは **再配布可（OFL等）** のものだけ。追加時は `fonts.json` に1行追加 + `<id>-OFL.txt` 同梱
- 組込みレイアウト `data/layouts.json` の `id` は変更しない（端末側の保存データが参照している）。追加は末尾
- レイアウトの読み込み元は `js/layouts.js` の `fetchBuiltin()` だけ。将来API化するときはここを差し替える
- `js/layouts.js` の `normalize()` が共有URL・古い保存データの防波堤。レイアウトに項目を増やすときは必ずここに既定値を足す

## 起動・確認

```bash
python3 -m http.server 8080      # http://localhost:8080
```

- 動作確認は Chrome。印刷確認は Chrome の印刷プレビュー（余白「既定」）
- ヘッドレス確認（Chrome拡張が繋がらないとき）: scratchpad に puppeteer-core を入れ、
  `page.pdf({ preferCSSPageSize: true })` で PDF を出して MediaBox を見る（前回の検証手順）

## フォント再生成

```bash
.venv/bin/python tools/fetch_fonts.py   # .venv は fonttools + brotli
```

## コミット

- グローバル設定どおり「変更内容がひと目でわかる簡潔な一行」。管理人の指示があるまでコミットしない
