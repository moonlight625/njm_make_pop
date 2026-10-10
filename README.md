# なぞり書きPOP

他店価格調査の上貼りPOPを「手書き風フォントで薄く印刷して、なぞるだけ」にするWebツール。
カテゴリ・型番・税別価格・コメントを入力すると、選んだレイアウト（用紙・台紙・項目の位置）で用紙プレビューが出て、そのまま印刷 / PDF保存できる。税込価格は自動計算。

- サーバー不要の静的サイト（バニラ HTML / CSS / JS）。入力内容はブラウザ内（localStorage）にのみ保存され、どこにも送信されない
- 公開URL: https://make-pop.mnlight.dev （GitHub Pages）

## 使い方

1. 商品リストにカテゴリ・型番・税別価格・コメントを入力（Excel / スプレッドシートからの貼り付けも可。列は カテゴリ / 型番 / 税別価格 / コメント / 枚数）
2. フォントと、なぞりガイドの見せ方（薄く塗る / 輪郭線のみ）・薄さを選ぶ
3. レイアウトを選ぶ。無ければ「複製して自分用に」→「レイアウトを編集」
4. 「印刷 / PDF」

### 台紙（店のPOP作成ソフトで出している赤ヘッダーなど）に合わせる

組込みの「他店対抗 A4縦」には Canva で作った台紙（`data/bg/taisei.png`、A4・342dpi、文字と図形のみ）が付いていて、
そのまま白紙に印刷できる。「（簡易サンプル台紙）」は SVG から生成した予備（`data/bg/taisei-sample.png`、元は `tools/taisei-sample.svg`）。
別の台紙に差し替えたいときは次の手順。

1. 台紙を画像（PNG / JPEG）にする。POP作成ソフトから PDF に出力して画像に変換するか、印刷したものをスキャン
2. 「他店対抗 A4縦」を「複製して自分用に」→「レイアウトを編集」→「画像を選ぶ」で登録
3. プレビュー上で各項目の枠をドラッグして書く場所に合わせる（右下をつまむと大きさ変更。数値入力も可）
4. 白紙に印刷すると台紙となぞりガイドが一度に出る。台紙が印刷済みの用紙を使うなら、画像は登録せず位置だけ合わせてその用紙に印刷

台紙画像は会社ロゴ入りなので **リポジトリには置かない**（端末のブラウザ内 IndexedDB にだけ保存される）。

### 印刷時の注意（Chrome / Edge）

- 印刷ダイアログの **余白は「既定」か「なし」** にする（余白はレイアウト側で持っている）
- 用紙サイズはレイアウトから自動で選ばれる。カスタム寸法のときはプリンタ側で合わせる
- 「背景のグラフィック」は不要
- 薄すぎ / 濃すぎは「薄さ」スライダーかプリンタの濃度で調整

### iPhone / iPad / Android

- iOS Safari: 「印刷 / PDF」→ プリント画面のプレビューをピンチで拡大 → 共有 → 「"ファイル"に保存」。用紙サイズはプリント画面側で合わせる
- Android Chrome: 「印刷 / PDF」→ プリンタの選択で「PDF形式で保存」

## レイアウトを他の端末でも使う

自作レイアウトは端末ごとの localStorage に保存されるため、他の端末には次のいずれかで渡す。

1. **パック**（台紙画像あり）: 「パックを保存」で出る `.pop-layout.json` を相手の端末で「パックを取り込む」。台紙画像ごと運べる
2. **共有（URL / QR）**（台紙画像なし）: 出てきたURLを他の端末で開く（スマホはQRを読む）と取り込み確認が出る
3. **全端末の標準にする**: 「JSONをコピー」した内容を `data/layouts.json` の配列に追記して push する。
   `id` は既存と重複しない文字列にすること。台紙画像は含まれない（公開リポジトリのため）

## フォントを追加する

配布フォントは `vendor/fonts/fonts.json` で管理している。

1. フォントファイル（.ttf / .otf / .woff / .woff2）を `vendor/fonts/` に置く
2. `vendor/fonts/fonts.json` に1行足す: `{ "id": "my-font", "name": "表示名", "file": "my-font.ttf" }`
3. push

**ライセンスに注意**: このサイトは公開されているので、「商用利用可」だけでなく **ファイルの再配布が可能** なフォントだけを置くこと
（Google Fonts の OFL フォントは可。フリーフォントには「商用可だが再配布不可」のものがある）。
再配布できないフォントは、画面の「この端末にフォントを追加」で読み込めば、その端末のブラウザ内だけで使える。

同梱フォントは Google Fonts の OFL（SIL Open Font License）: Yomogi / Zen Kurenaido / Klee One / Yusei Magic / Hachi Maru Pop / Yuji Syuku。
各ライセンス本文は `vendor/fonts/<id>-OFL.txt`。

### サンプル台紙の再生成

```bash
# tools/taisei-sample.svg を編集 → A4 300dpi の PNG に書き出す(puppeteer-core を入れたディレクトリを指定)
PUPPETEER_DIR=/path/to/dir-with-node_modules node tools/render_bg.mjs
```

### 同梱フォントの再生成

```bash
python3 -m venv .venv && .venv/bin/pip install fonttools brotli
.venv/bin/python tools/fetch_fonts.py          # 全部
.venv/bin/python tools/fetch_fonts.py yomogi   # id 指定
```

google/fonts から TTF を取得し、日本語に必要な文字範囲だけ残して woff2 化する。

## ローカルで動かす

```bash
python3 -m http.server 8080
# → http://localhost:8080
```

ES modules と fetch を使っているため、`index.html` を直接ダブルクリック（file://）では動かない。

## 構成

```
index.html          画面
css/style.css       画面UI
css/print.css       印刷時（UIを隠して用紙だけ出す）
data/layouts.json   組込みレイアウト（全端末共通）
js/main.js          UI配線
js/render.js        商品行 × レイアウト → 用紙DOM
js/layouts.js       レイアウトの読込・保存・共有URL・パック
js/backgrounds.js   台紙画像の保存（IndexedDB）
js/fonts.js         フォント一覧と端末ローカルフォント（IndexedDB）
js/state.js         入力内容と設定の保存
vendor/fonts/       フォント本体 + fonts.json + OFL
vendor/qrcode.min.js  QR生成（qrcode-generator, MIT）
tools/fetch_fonts.py  フォント取得・変換
```
