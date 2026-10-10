# TODO.md

## 現状（2026-10-10）

- v2 実装完了: 台紙画像（端末保存）＋項目の自由配置（ドラッグ）＋税込自動計算＋パック共有
- ヘッドレス Chrome で確認済み: 行入力 → 台紙登録 → ドラッグ → PDF（A4）、パック保存 → 別端末で取り込み、共有URL、旧形式の移行、スマホ幅
- 2026-10-10 デプロイ済み: GitHub `moonlight625/njm_make_pop`（public）、Pages は main / root、カスタムドメイン `make-pop.mnlight.dev` 設定済み
- **Cloudflare DNS は管理人作業（未）**: `pop` の CNAME → `moonlight625.github.io`、プロキシOFF（DNS only）。shift-tools / pc-tools と同じ
  DNS 反映後、GitHub 側で証明書が発行されたら `gh api -X PUT repos/moonlight625/njm_make_pop/pages -F https_enforced=true` で HTTPS 強制
- プロジェクト直下に管理人の現物写真 `IMG_2554.HEIC` / `IMG_2555.HEIC` がある（gitignore 済み。会社ロゴ入りなのでコミット厳禁）

## 次やること

1. 管理人: 組込み「他店対抗 A4縦」（Canva 製台紙 `data/bg/taisei.png`）を白紙に試し刷りし、ガイド位置を確認。ずれていれば複製→ドラッグで合わせた JSON をもらい組込みに反映
2. 本物の台紙を使いたい場合: Mighty POP から画像化（PDF 出力 → PNG、またはスキャン）→ 複製 → 画像を選ぶ → ドラッグで位置合わせ
3. 薄さの初期値（80）と、赤ガイドの見え方（ピンクが薄すぎ/濃すぎ）を実機で調整
4. iPhone/iPad Safari で印刷→PDF保存を確認
5. Cloudflare に `pop` の CNAME を追加 → https://make-pop.mnlight.dev で開けることを確認 → HTTPS 強制を ON

## 候補（必要になったら）

- 台紙を PDF のまま登録（pdf.js が必要なので見送り中。PNG 変換手順で足りるなら不要）
- 保存ボタンで全端末に即同期（VMにAPI追加）。`js/layouts.js` の `fetchBuiltin()` 差し替えで対応
- 項目枠のキーボード微調整（矢印キー）
- Material Symbols アイコン導入（現状は絵文字）
