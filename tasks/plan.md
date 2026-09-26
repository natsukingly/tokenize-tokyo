# TOKENIZE TOKYO 審査パッケージ plan（2026-09-26 15:10 JST 承認）

締切: 2026-09-27 09:00 JST。優先順位: 提出資格の確保 > デモの WOW > 文面 > スライド。

## 確定事項
- キーワードは「RWA」ではなく「Dormant Capital」
- 数字: 空き家 89.7万戸（うち その他の空き家 21.4万戸、令和5年住宅・土地統計調査）/ 23区 未利用地等 約1,303ha（令和3年 土地利用現況調査）/ 戸建住宅の太陽光設置率 約6.0%（2022年度実績、東京都環境局）。ChatGPT の 6.8% は使わない
- 狙う賞: Curvegrid RWA + Curvegrid Dashboard（ENS は未決定、下記）
- 休眠地点は on-chain 資産ではなく「demo dataset のレイヤー」として描画する（Activity ledger を汚さない）

## Todo
- [ ] 1. 初回 git コミット（.gitignore 確認済みのうえで）
- [ ] 2. README.md（Curvegrid 5要件: 一文要約 / MultiBaas の使い方 / チームと SNS / setup & testing / MultiBaas の感想）
- [ ] 3. Opportunity Lens: 休眠地点 ~150 件の demo dataset + フィルターで発光 + 「N dormant opportunities · demo dataset」表示 + Dormant/Tokenized/Activated カウンタ
- [ ] 4. docs/showcase.md（one-liner / Project Description / How it's made）
- [ ] 5. docs/qa-cheatsheet.md（想定 Q&A 10問）
- [ ] 6. docs/pitch/index.html（5枚スライド、キーボード操作）
- [ ] 7. typecheck / vitest / forge test / playwright を通す
- [ ] 8. 2回目コミット + push（remote は natsuki 確認後）
- [ ] 9. natsuki: チーム名と SNS、MultiBaas の実感、動画撮影

## 未決定
- ENSv2: 現状コードに ENS は一切無い。要件は「Sepolia の ENSv2 が製品の中核、ハードコード不可、ライブデモ必須」。残り 18h で実装は非推奨。ピッチにも「実装していない技術」は載せない
