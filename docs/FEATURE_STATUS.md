# 基本機能と実装状況

更新: 2026-09-26。**トークナイズ後の売買・収益分配・Basket運用は、実際のSolidityで動作する。公開サイトのメイン画面は `multibaas` モードで実ウォレット取引。`/demo` は別のシミュレーション。** この区別をピッチでも明示する。

最新のウォレット更新: TypeScript / production build、78 unit tests、公開サイトの購入→Portfolio→再出品→取消E2Eが通過。[実取引レポート](../deployments/browser-wallet-verification.json)。以前のコントラクト検証では25 Foundry tests、既存画面では15 browser E2Eが通過。MultiBaas側は630 events、426 scenario actionのhash/event一致、3 Basketのcustody・残高を照合済み。[実接続検証レポート](../deployments/testnet-demo-verification.json)。

## 発見 → 発行 → 運用

| 基本機能 | できること | 状況・根拠 | 残り |
| --- | --- | --- | --- |
| 3D都市地図 | フィルター、対象空間ハイライト、X-ray、保有空間表示 | UI実装・E2E確認 | PLATEAU実データ、精密な屋根/階のgeometry |
| 資産一覧 | 種類・状態・検索・価格順から地図詳細へ移動 | MarketsのAll assetsタブ・モバイル対応 | 大規模データのページ分割 |
| 多様なアセット | 屋根、空き家、遊休地、駐車場、倉庫、広告、コミュニティ空間 | ブラウザ49件、テストネットにも49件追加 | 実物件との契約は未実施 |
| 分析Overview | 7日推移、一次/二次/Basket売買高、タイプ別稼働、収益入出金、対応待ち | `MarketOverview.tsx` / `analytics.ts`・ユニット/E2E確認 | 実測稼働率・価格評価・収益予測は未実装 |
| チュートリアル | 購入などを実画面で順に案内 | 実装・E2E確認 | WalletConnect/QR対応 |
| Asset登録 | 空間とmetadataを登録 | コントラクト・UI・テストネット確認 | 登記/所有権の照合 |
| Asset審査 | 申請、承認、却下、再申請 | VERIFIER_ROLEで制御・Foundry確認 | 現実の審査はシミュレーション |
| 権利発行 | 用途・期間・scope・供給量・譲渡条件を定義 | ERC-1155発行をテストネット確認 | 法的契約としての有効性・証憑保管 |
| 権利審査 | Assetとは別に承認後のみ出品可能 | コントラクト・テストネット確認 | 本人確認・審査運用 |
| 空間/期間の競合 | 同じscope・重複期間の排他的用途を拒否 | コントラクト・Foundry・ブラウザE2E確認 | プロトコル外の二重契約は検知しない |
| 一次販売 | 発行者から投資家へ持分を販売 | MockJPY支払と権利移転を同一txで実行・テストネット確認 | MetaMask/Rabby拡張そのものの手動リハーサル |
| 二次販売・取消 | 保有者の再出品、部分購入、残数量管理、取消 | 売買はテストネット確認、取消はFoundry/E2E確認 | 実際の買い手・流動性は保証しない |
| 稼働開始 | Verifierが独立してActivate | テストネット確認 | 発電設備など現物稼働の確認 |
| 収益入金 | OperatorがMockJPYをRevenueVaultへ送金 | 実際のテストERC-20移動を確認 | 実世界売上との接続 |
| 収益請求 | 保有割合でclaim、譲渡前の収益は旧保有者へ残す | テストネット確認、二重claim/移転会計テスト通過 | 税・法令・会計対応 |
| Portfolio | 保有権利、claimable、再出品、Basket持分 | ブラウザE2E確認・MultiBaas read実装 | claim/Basketも含めた拡張ウォレットでの手動確認 |
| Basket作成 | 2–8種類の互換収益権を固定比率で束ねる | テストネットで3種類作成 | 自動リバランス・管理報酬なし |
| Basket発行・償還 | 実際に権利を預けてmint、burnで原資産へ戻す | テストネットで発行・売買・償還確認 | 現金償還ではなく権利の返却 |
| Basket収益 | underlying収益を回収しBasket持分へ配分 | テストネットclaim・Foundry会計テスト | 実売上の収益ではない |
| 分割市場 | 権利の経済価値を分割して購入・再販売 | **Marketsのモック** | ERC-1155収益持分とは別機能。実custody/発行なし |
| 期限付き貸出 | 利用期間の指定・貸出・返却 | **Marketsのモック** | レンタルescrow、予約重複防止、実アクセス制御 |
| 担保融資・Lending | 権利を預けて借入、利息、清算 | **未実装** | 評価・担保管理・清算・法的権利の設計 |

## 基盤・外部接続

| 機能 | 現在の状態 |
| --- | --- |
| EVMネットワーク | Curvegrid Testnet / chain ID `2017072401`。Ethereum mainnet/Sepoliaとは別 |
| コントラクト | Registry / Rights / Marketplace / RevenueVault / BasketVault / MockJPYの6本を配置・link済み |
| MultiBaas SDK | state read / unsigned compose / DApp key権限制限を実接続確認 |
| Event Indexing / Queries | lifecycle取得、売買高・入金・出金の集計を実接続確認。追加取引は索引に反映されるまで待機が必要 |
| 再現可能な証跡 | `deployments/testnet-demo-receipts.json`に448件。`npm run demo:verify:testnet`で各scenario actionのeventとcustodyを照合 |
| Browser wallet | EIP-6963/注入wallet接続、ネットワーク追加/切替、署名付きテストETH取得、MockJPY mint、購入、取引状態表示。opt-inブラウザテストは制御したテスト署名者を使用。外部ウォレット拡張の手動確認は別途 |
| Transaction Explorer | `/tx/[hash]`。MultiBaas SDKから取引・receipt・decoded関数/events。Activity/送信直後/ウォレット履歴からリンク |
| API keys | frontend DApp key / server admin keyを分離。admin endpoint拒否を確認 |
| Webhook | HMAC、時刻、delivery重複排除、revision polling実装・ローカル確認。**実サービスからの配送は未確認** |
| Cloud Wallet / TXM | adapter実装済み、Azure/Cloud Wallet未設定・未実行 |
| Safe | 未実装 |
| ENSv2 | ENS Index画面で階層プレビュー・検索・地図連携。名前生成・registry読取・限定roleのunsigned descriptorを実装。**登録・解決・権限委譲・ERC-1155発行連携を実装。公式コントラクト15テスト／ローカルSepolia fork検証済み。公開Sepoliaの登録・限定発行・取消検証済み。Sepolia MultiBaasのAPI設定とサイト切替は残り。ENSV2_DESIGN.md参照** |
| コンプライアンス | 譲渡制限/allowlist/Verifier権限は実装。KYC/AML、実所有権確認、規制対応、法的契約は未実装。準拠済みと説明しない |

## 「何のトークンか」

UrbanRightTokenはERC-1155。同じ権利ID内では各口が同等、別の権利IDとは内容が異なる。Usage Rightは通常1口、Revenue Shareは100口など。建物の所有権そのものではない。BasketもERC-1155、決済のMockJPYはERC-20で金銭的価値はない。

## Basketは誰が使うか

1. **組成者・既存保有者**: 複数の収益権を保有し、固定比率でVaultへ預けて商品にまとめる。
2. **取得する投資家**: 各屋根を個別に買う代わりに組み合わせの持分を保有する。収益請求・再販売・原資産償還ができる。
3. **プロジェクト運営者**: 各事業のRevenueVaultへ収益を入金する。Basketを作るだけで事業売上は発生しない。

現在の仕様では同じRightは1つのBasket poolにのみ属する。構成比は固定、リバランスなし、原資産は2–8種類、同じ決済通貨・互換な譲渡条件のRevenue Shareのみ。Basket化によって安全性や流動性が保証されるわけではない。

## 次に追加する金融機能の提案

共同保有の発展は、**収益持分の共有（現在のERC-1155）→ 共同運営（投票・委任、未実装）→ 担保借入（未実装）→ 再投資（未実装）**と分ける。共同運営では売却、貸出価格、修繕費負担を誰が決めるかを定める。持分トークンだけで法的な不動産共有を成立させたとは主張しない。

担保レンディングの想定フローは `Revenue Right / Basket → CollateralVaultへロック → MockJPY借入 → 返済で返却`。返済不能時の清算、担保評価、借入上限、権利の満期、担保中の収益の帰属が必要。出品者の言い値や自作の直近売買だけを担保価格にしてはいけない。現時点では設計候補で、contract/UIの実装済み機能には含めない。

| 優先 | 機能 | 利用場面・新しく必要な仕組み |
| --- | --- | --- |
| 1 | 稼働条件付き資金調達 | 期限までに目標額/設備設置条件を満たせば送金、未達なら返金。今の即時売買とは別のescrow contractが必要 |
| 2 | 利用権の期限付き貸出 | 駐車場・倉庫・広告枠の保有者が、期間だけOperatorへ貸す。転貸許可、重複予約、期限切れ、返金/保証金を定義する |
| 3 | 指値注文・一括購入 | 希望価格での購入注文や複数権利の一括取得。約定・取消・支払権限を明示する |
| 4 | 限定的な収益再投資 | 入金済み収益のみを、利用者の上限・対象指定に従って再投資。新規yieldを作らない |
| 後続 | 担保融資 | 独立した価格評価、LTV、清算、満期、default時の権利移転を設計してから追加 |

期限付き利用の考え方には[ERC-4907](https://eips.ethereum.org/EIPS/eip-4907)が参考になる。ただしこれはERC-721拡張であり、現在のERC-1155にそのまま準拠と称することはできない。将来の換金待ちがあるVaultには[ERC-7540](https://eips.ethereum.org/EIPS/eip-7540)の非同期償還モデルも参考になるが、現在のBasketVaultはこれらの規格を実装していない。

## 検証コマンド

```sh
npm run typecheck
npm test
npm run test:contracts
npm run test:e2e -- --workers=1
npm run build
npm run multibaas:verify
npm run demo:verify:testnet
```

最後の2つは設定済みMultiBaasに接続する。`demo:verify:testnet`は読み取りのみ。データ増強用の`demo:seed:testnet`は実際にテストネットへ送信するため、単なる検証と混同しない。

## 追加：プロジェクト概要と事業収益シナリオ

7アセットタイプのAI作成下書き、長文概要、資金用途・運用・リスクの説明、編集可能な売上/費用/初期投資/分配比率、3シナリオの営業キャッシュと単純回収期間を実装。資産metadataへ保存し詳細表示に引き継ぐ。実AI API呼び出し、現地査定、市場実績に基づく予測、法定通貨入出金は含まない。
