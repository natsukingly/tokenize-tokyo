# 残タスクと完成条件

更新: 2026-09-27。現状の根拠は[機能一覧](FEATURE_STATUS.md)、[実tx記録](../deployments/testnet-demo-receipts.json)。完了を判定する基準は機能数ではなく、Register → Verify → Tokenize → Trade → Earn → Composeの通し実演。

## テストデータ拡充 — 2026-09-27

200資産分の追加計画を用意し、予算内で**合計88資産・47権利・稼働中12件**まで実行済み。追加392取引、市場操作376件のMultiBaas照合が完了。7種類を各12件追加し、既存4資産とBasketを保持。残高は約0.00453 Sepolia ETH。

**未完了**: 200件に到達する残り112資産の登録と、一部資産の発行・販売等の後続工程。追加ETHがあれば重複発行せず同じjournalから再開できる。[実行記録・再開手順](SEPOLIA_CITY_DATA.md)。

## 最新の接続状況 — 2026-09-27

公開メインは **Sepolia (`11155111`)** へ切替済み。MultiBaasの9契約link、DApp権限、CORS、未署名取引の組み立て、ENS名と発行権限の読取りを確認。英語コミット `996ccf2` / `bb3c5a2`。公開deployment: `dpl_4cbF55bu8bXPukdkk8XT7boWmJqC`。旧Curvegrid Testnetの50資産・448取引は保持し、全件移行しない。初期記録の扱いと最新の実行証跡は [SEPOLIA_CUTOVER.md](SEPOLIA_CUTOVER.md) を参照。

Sepoliaの追加シナリオも完了。4資産・4権利（稼働3件）・混合バスケット1件、51取引成功。41市場操作の索引、37,700 MockJPYの売買、5,800 MockJPYの入金、償還後の原資産預託数量を照合済み。公開ENS Indexの登録表示・権限履歴・Explorerリンクも確認。

残りは実ウォレット拡張での通し実演、外部Webhookの実配送と永続化、ピッチのリハーサル。下記の旧deployment番号・「公開メインはCurvegrid」等は各作業時点の履歴。

## 追加の地図・ENS・データ改善

2026-09-26の追加作業。公開反映とスモーク確認完了。deployment: `dpl_HfqfvqFUd9MP48haExZM4YZ3G7pB`。

- [x] 地図にFunding openフィルターと調達率プログレスバーを追加。既存の種類・状態フィルターと組み合わせ、リセットも可能。
- [x] Project picksは募集進捗と資産種類を基準に最大3件を表示。投資収益の予測や個別の投資推奨ではない。
- [x] メニューをENS Indexへ変更。地図の選択場所に未登録プレビューのENS名を表示し、その階層へ移動。
- [x] ブラウザ用資産53→265件、未活用候補150→750件。元の資産・利用者の操作を保持する追記型の移行。
- [x] 調達率・稼働状況・模擬取引と入金の履歴を追加。残高と分配額の対応、移行の重複防止、地図連携をテスト。
- [x] 大量イベントの集計を高速化。未登録ENSを実登録と誤認させる表示はしない。
- [x] 全体／個人のメニューを分離。ENS Indexは全幅階層＋詳細モーダルへ変更。Quick tourは中央のWelcomeモーダルから開始。ボタン横の装飾的な黄色い点を削除。
- [x] 公開版反映とスモーク確認。ライブ50資産、ENS選択モーダル、Welcomeモーダル、デモ265資産、3件のFunding picks、地図→ENS、スマホ分析表示を確認。ページ実行エラー0件。
- [ ] 一般利用者向けCloud Walletログインは設計候補。通常ログイン・利用者別鍵管理・署名認可は未実装。[選択肢と現状](WALLET_UX_OPTIONS.md)を整理済み。
- [ ] テストネットへの追加発行は未実行。今回5倍にしたのは表示用シミュレーション。実発行を増やす場合は既存journalと別の追加シナリオを用いる。

検証: 型チェック・production build・Vitest 85件通過。変更関連のPlaywright 17件通過（実ウォレットopt-in 1件は未実行）。本番URLのゲスト操作のみを追加確認し、新しい取引は送信していない。

## 直近のUX改善 — 最新TODO

公開メインは[Curvegrid Testnet版](https://tokenize-tokyo.vercel.app/)、[操作練習用デモ](https://tokenize-tokyo.vercel.app/demo)はブラウザ内のシミュレーション。下記P0のUX改善は公開反映済み。メインの実データ表示・ゲストの接続導線・履歴入りデモ・スマホの横幅を公開URLで確認した。公開deployment: `dpl_FmvK8nLWPmZJSn6iwVW9EMYUWjvB`。

| 優先度 | 作業 | 現在の状態・残り |
| --- | --- | --- |
| P0 | 読み込み・空・エラーの区別 | 初回取得中はローダー、数値・一覧を非表示。更新中は直前のデータを維持し、失敗時は再試行。残高も取得前に0と表示しない。自動テスト済み、公開反映済み |
| P0 | My assetsと接続状態 | 未接続時の案内、接続後の保有一覧、アカウント変更時の古い残高・入力・同意のリセットを実装・テスト済み。ウォレット接続であり、サーバーのログインセッションではない |
| P0 | バスケットの意味と操作結果 | 預ける権利、必要数量、受け取る口数、購入総額を表示。組合せ保存→権利預託→持分受取りを区別。Solar以外との組合せも検証済み。初心者による理解度確認は残り |
| P0 | バスケット購入の同意バグ | 出品ごとにチェック状態を分離。アカウント変更で同意を解除するテスト済み |
| P0 | ウォレット選択画面 | 黄色ベタ塗りをやめ、コンパクトな選択行へ変更。ライブ版は自分の接続アカウント、デモだけ役割を切替える |
| P0 | 接続不具合と地図ローダー | MultiBaasのlocalhost CORS不足を修正。地図スタイルと建物タイルの読込状態を分離し、再試行を追加。localhostで実データ50件と建物の描画・ローダー終了を確認済み。外部タイルへの依存は残る |
| P0 | テスト履歴・分析グラフ拡充 | 28日分の模擬購入・再販・収益入金と、屋根＋駐車場＋広告のサンプルバスケットを追加。取引額と収益入金を同時表示、期間選択は1つに簡略化。日別／週別表示をテスト済み。既存データを保持して明示的に追加する。ライブの0件の日は改変しない |
| P0 | Quick tourと表記の整合 | My assets表記・接続導線を更新、購入・発行ツアーの自動テスト済み。公開版のゲスト→My assets→ウォレット案内まで確認済み。実ウォレット署名を伴う全行程のリハーサルは残り |
| P0 | 公開版更新 | 完了。テストネットの実データ50資産、ゲスト導線、デモの2系列グラフ・混合バスケット、スマホ横幅390pxを確認。ページ実行エラー0件 |
| P1 | 分かりやすさの仕上げ | Activated、収益受取り、売却、クラファンの説明を横断点検。何が移動し、手数料がいつ必要かを操作前に理解できるか初心者に確認 |
| P1 | 入出金・オン／オフランプ設計 | テストETHとMockJPYの補充は実装済み。円→決済通貨→購入、売却／収益→円への導線・対応地域・提供事業者・審査を決める。実際の法定通貨入出金は未実装 |
| P1 | ENSv2実接続 | 登録・解決・発行権限連携を実装、公式契約でローカル検証済み。公開Sepolia配置・委譲発行検証済み。MultiBaas設定・ブラウザ実署名確認を進める。現サイトの例示名はプレビューのまま |
| P1 | 最新デモ台本 | コンセプト→マップ探索→トークナイズ→Fundingを主軸に、My assets／収益／混合バスケットを補足。最新画面で4分の通しリハーサルを実施する |
| P2 | クラファンの保全・二次金融 | 一次販売の集計は実装済み。期限・未達返金・資金預託は未実装。分割・レンタルはモック、担保ローンは未実装。仕様決定後に実取引化する |

### 確認方法

- 履歴入り練習画面: `/demo?view=dashboard&sample=1`。`View sample holdings`で収益権と混合バスケットを持つサンプル利用者へ移動。
- サンプル追加は繰り返しても重複せず、既存のデモ操作を維持。実チェーンの履歴には混ぜない。
- 実装検証: `tests/account-access.spec.ts`、`tests/basket-consent.spec.ts`、`tests/tour.spec.ts`。型チェックとVitest 83件が通過。Playwrightは今回の変更対象7件（接続・読込・分析・バスケット・購入ツアー・発行ツアー）を確認。実ウォレット署名を行うopt-in試験は今回未実行。

### English status

Deployed and smoke-tested: initial loading/error states, account-specific My assets, independent basket consent, custody/payment previews, compact wallet choices, and opt-in 28-day fictional activity with daily/weekly analytics. Real ENSv2 registration/delegation, webhook delivery verification, fiat ramps, protected crowdfunding and production eligibility controls remain incomplete. Wallet connection is not a server-authenticated login session.

## P0 — 提出前に閉じる

| 作業 | 完了条件 | 状態 |
| --- | --- | --- |
| 実取引データと索引の照合 | 各actionのtxHashがEvent Queryに存在し、Basket custody/売買集計が一致 | **完了**: 448tx、426 actionのevent照合、630 indexed events。`demo:verify:testnet`で再現 |
| 拡張ウォレットの手動実演 | MetaMask/Rabbyでclaim/Basketも含めた4分の通し確認 | 接続・gas・mint・購入・Portfolio・再出品/取消・Explorerは制御された署名者のブラウザE2Eで検証。拡張自体の確認とclaim/Basketの通しは残り |
| 外部Webhook | 公開HTTPS受信先、秘密値、`event.emitted`登録、正署名だけ受理しUI再取得 | handlerローカル確認済み、実delivery未確認 |
| 公開デモ | 公開URL、CORS、データ永続化、秘密値を含まないfrontend | Vercelで公開済み。メインはMultiBaas／Curvegrid Testnet、`/demo`だけlocalStorage。今回のUX変更も反映・公開確認済み。Webhookの永続化と実配信確認は残り |
| 4分リハーサル | 別プロフィールで本番操作、読み上げ、時間内終了を2回確認 | Playwright台本テストあり。人間の通しは未確認 |
| 提出表記 | README、ピッチ、動画のlive/mock/plannedが一致 | ENSのLive表記は実証が揃うまで不可 |

## P1 — ENSv2の中核統合

同一チェーンで強制するため、**Sepolia版Urban Rights + Sepolia版MultiBaas + ENSv2**を構築する。現在のCurvegrid Testnetは維持する。

1. **完了**: 0.05 Sepolia ETHの入金を確認し、新規配置・登録・委譲発行検証に使用。
2. Sepolia用MultiBaas deploymentは無料プランで作成済み。DApp/Admin権限、CORS、9契約のlink/indexとブラウザ確認を完了する。Curvegrid TestnetのAPIキー・アドレスを混在させない。
3. 制御可能なENSv2親名を取得し、公式registry/factory/resolverの配置と参照revisionを照合。
4. UserRegistry階層を実際に作成・attachし、Universal Resolverで解決。`ens:inspect`で状態/期限/親子関係を検証。
5. `UrbanNamespaceAuthority`と委譲発行entry pointを実装・テスト・配置。grantは空間/用途/期間/発行者に限定し、Verifierと分離。
6. Owner→rooftop Operatorの成功、interior拒否、取消後拒否を実演。MultiBaasでeventを取得し、SepoliaのExplorerリンクを残す。

詳細な仕様と段階別受け入れ条件は[ENSV2_DESIGN.md](ENSV2_DESIGN.md)。登録スクリプト、公式契約での解決、UrbanNamespaceAuthority、委譲発行、ENS Index操作、MultiBaas link/queryを実装済み。15 Foundryテスト＋ローカルSepolia forkで確認。公開Sepoliaの登録・限定発行・取消検証も完了し、[公開証跡](../deployments/ens-v2-sepolia-delegation-proof.json)を保存済み。別MultiBaasのAPI設定・索引・ブラウザ確認が公開切替の残条件。

## P2 — コアを壊さずに伸ばす

- 集計値から対応対象へ移動するOverviewを、実接続・複数ユーザー・より多い履歴で検証。
- 分割市場/貸出は当面モックを明示。次の実装候補は稼働条件付きescrowと期限付き貸出。
- PLATEAU geometry、細かいfloor区画、実測発電・稼働データ。
- Cloud Wallet設定後にOperator→TXM確認。Safe、auction、担保融資は後続。

## 人が必要な入力・作業

- SepoliaのテストETHは入金済み。親ENS名取得とMultiBaas環境作成も完了。キー/秘密鍵はチャットに貼らない。
- team/social/public repo・公開先・提出動画、実際のMultiBaas利用感想。
- ウォレット署名を伴うデモと4分の読み上げ。
- 実資産へ移る前の権利証憑・契約・法令対応の検討。現在は準拠を主張しない。

## 追加の実装・確認

- [x] 公式ENSv2 revisionを固定し、Sepoliaの7契約のruntimeを照合。
- [x] ENSv2とUrbanRightTokenを同一チェーンでつなぐ発行権限コントラクト。
- [x] 15項目の公式バイトコードテスト、256回の数量上限fuzz検証。
- [x] ローカルSepolia forkで新規登録・名前解決・資産bindingの全工程。
- [x] 概要の長文化、7種類のAI作成下書き、編集可能な3ケース収益試算、metadata保存。
- [ ] Sepolia MultiBaasの別deployment接続、9契約link、event queryとブラウザ委譲取引の確認。

- [x] 公開Sepoliaで親名・屋根登録、名前解決、binding、委譲発行10口、別空間拒否、取消後拒否を検証。
- [x] Sepolia MultiBaasの無料deployment作成。API設定以降は継続中。
