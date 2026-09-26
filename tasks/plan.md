# TOKENIZE TOKYO 審査パッケージ plan（2026-09-26 15:10 JST 承認）

締切: 2026-09-27 09:00 JST。優先順位: 提出資格の確保 > デモの WOW > 文面 > スライド。

## 確定事項
- キーワードは「RWA」ではなく「Dormant Capital」
- 数字: 空き家 89.7万戸（うち その他の空き家 21.4万戸、令和5年住宅・土地統計調査）/ 23区 未利用地等 約1,303ha（令和3年 土地利用現況調査）/ 戸建住宅の太陽光設置率 約6.0%（2022年度実績、東京都環境局）。ChatGPT の 6.8% は使わない
- 狙う賞: Curvegrid RWA + Curvegrid Dashboard（ENS は未決定、下記）
- 休眠地点は on-chain 資産ではなく「demo dataset のレイヤー」として描画する（Activity ledger を汚さない）

## Todo
- [x] 1. 初回 git コミット（625a857、2026-09-26 15:15 JST）
- [x] 2. README.md（チーム情報と MultiBaas 感想は natsuki 待ち）（Curvegrid 5要件: 一文要約 / MultiBaas の使い方 / チームと SNS / setup & testing / MultiBaas の感想）
- [x] 3. Opportunity Lens: 休眠地点 ~150 件の demo dataset + フィルターで発光 + 「N dormant opportunities · demo dataset」表示 + Dormant/Tokenized/Activated カウンタ
- [x] 4. docs/showcase.md（one-liner / Project Description / How it's made）
- [x] 5. docs/qa-cheatsheet.md（想定 Q&A 10問）
- [x] 6. docs/pitch/index.html（5枚スライド、キーボード操作）
- [x] 7. typecheck / vitest / forge test / playwright を通す
- [ ] 8. 2回目コミット + push（remote は natsuki 確認後）
- [ ] 9. natsuki: チーム名と SNS、MultiBaas の実感、動画撮影

## 未決定
- ENSv2: 現状コードに ENS は一切無い。要件は「Sepolia の ENSv2 が製品の中核、ハードコード不可、ライブデモ必須」。残り 18h で実装は非推奨。ピッチにも「実装していない技術」は載せない

## 発見事項（2026-09-26 15:40）
- この repo は Codex（ChatGPT アプリ）が構築・並行編集している。docs/IMPLEMENTATION_REPORT.md と docs/ENSV2_DESIGN.md は Codex 作。同じファイルを両者で触らないこと
- MultiBaas は実サービスで一度も動かしていない（deployment 未作成）。Curvegrid 賞の最大リスク。締切前に deployment 作成 → `npm run multibaas:link` → `multibaas:verify` を通したい
- deployer が VERIFIER_ROLE も持つ（ADMIN_ADDRESS 未指定時）。Q&A の「誰が検証するか」で正直に言う

## 16:05 状況
- Codex が並行で大量変更中（Dashboard 全面改稿、TokenizeFlow/Tutorial/FinanceMarkets 追加、README・showcase・qa-cheatsheet に ENS「planned」節を追記、docs/PITCH_DEMO.md 追加）。未コミット。私はコミットしない（Codex の作業中のため）
- 現ツリーで typecheck / vitest 43 / playwright 9（lens 含む）全通過を確認
- ピッチ台本が2本ある: docs/pitch-script.md（私、ENS/PLATEAU 無し、デモ 2:15）と docs/PITCH_DEMO.md（Codex、ENS を slide 4 で説明、mock Markets を 25 秒）。natsuki が一本化を決める

## 17:00 MultiBaas ライブ接続
- deployment 作成済み（Curvegrid Testnet、chain 2017072401、Free プラン: 2 events/s・10 contracts・30k calls/月）
- API キー3種（admin-scripts / dapp-browser / web3-rpc）→ .env.local（gitignored）。テスト用 deployer 鍵は cast wallet new で生成、faucet 1 ETH
- forge deploy 成功（6本、0.027 ETH）→ deployments/2017072401.json。multibaas:link 一発成功、索引 6 本とも追いつき済み
- verify: DApp キーでは 403（索引状態などは admin 権限）→ admin キーで通し、最後の unsigned 合成が 400。調査中
- 課題: CORS origin 追加、seed をテストネットで実行して AssetRegistered を作る
- 17:20 verify 全通過。原因3件: (1) select は inputIndex 必須（name だと 400 invalid request）(2) limit>50 で 400 (3) DApp キーは索引状態/アドレス参照が 403 → verify を admin/DApp 二鍵化。gas 見積りは from の残高依存（残高0だと 400）。修正コミット 24570f3、push 済み
- 手動 seed: asset 1 / right 1 を cast で作成（scripts/seed.ts は anvil 前提で「already seeded」になる）
- ブラウザ multibaas モードは 3001（next build+start、CORS 追加済み）で確認: Activity に実イベント7件、エラー0。未検証: webhook 配信、Cloud Wallet、TXM
