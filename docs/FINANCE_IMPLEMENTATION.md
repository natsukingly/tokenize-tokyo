# 取得後の再分割・期限付き貸出

2026-09-27。コントラクト、ウォレット操作、MultiBaasアダプターを実装し、隔離したAnvil上でブラウザから実トランザクションを送る検証を完了した。**この追加2コントラクトは公開ネットワークへ未デプロイ。公開サイトで使うには下記の配置・リンク・再ビルドが必要。** `/demo` は従来どおりブラウザ内のシミュレーション。

## できること

| 操作                 | 動作                                                     | 対象・条件                                                   |
| -------------------- | -------------------------------------------------------- | ------------------------------------------------------------ |
| 取得済み権利の再分割 | 原資産をVaultへ預託し、固定比率のERC-1155持分を発行      | Open譲渡の収益権。利用権は対象外                             |
| 小口売買             | 数量・単価を指定して出品、部分購入、取消                 | MockJPY支払と持分移転を同一取引で実行                        |
| 分割後の収益請求     | 原資産のRevenueVaultから入金済み収益を回収し、持分へ配分 | 売却前の発生収益は旧保有者に残る                             |
| 元の権利へ償還       | 持分をburnし、預託した原資産を返す                       | 1口を1,000持分にした場合、償還は1,000の整数倍                |
| 期限付き貸出         | 排他的利用権1口をescrowへ預託し、借り手が日数指定で利用  | Open譲渡・Activeの利用権。元の期限内、最大365日              |
| 返却・回収           | 借り手の早期返却、または期限切れ後に貸し手が原資産を回収 | 利用中の回収・二重貸出は拒否。料金前払い、早期返却の返金なし |

再分割は原資産1口を細かい経済持分にする処理。屋根を物理的に分割したり、排他的利用を複数人へ付与したりする機能ではない。1つのright IDには1つの分割pool、比率は最初の作成時に固定される。

貸出中の原資産トークンはescrowにある。`userOf(offerId)` が有効な利用者を返し、満了時に借り手の操作なしでゼロアドレスになる。期限後の原資産回収には貸し手の取引が必要。電子錠・現地設備との接続、将来日付の予約、転貸、保証金、担保融資は含まない。

## 審査員向けコード案内

| 役割                                                      | コード・主な関数                                                                                                              |
| --------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| 預託・持分発行・収益・償還・売買                          | [FractionVault.sol](../contracts/src/FractionVault.sol): `createPool`, `deposit`, `purchase`, `claimRevenue`, `redeem`        |
| 貸出預託・利用者・失効・返却                              | [RentalEscrow.sol](../contracts/src/RentalEscrow.sol): `createOffer`, `rent`, `userOf`, `returnRental`, `withdraw`            |
| MultiBaasによるstate read、unsigned compose、イベント索引 | [rights-finance.ts](../src/lib/rights-finance.ts): `loadFinance`, `financeIntent`, `sendFinanceIntent`, `loadFinanceActivity` |
| 送信先・chain・calldataの照合とreceipt追跡                | [multibaas.ts](../src/lib/multibaas.ts): `sendAtMultiBaas`                                                                    |
| 画面、確認ダイアログ、承認・署名・結果表示                | [RightsFinance.tsx](../src/components/RightsFinance.tsx)                                                                      |
| 既存Markets／Portfolioからの接続                          | [FinanceMarkets.tsx](../src/components/FinanceMarkets.tsx), [Dashboard.tsx](../src/components/Dashboard.tsx)                  |
| 既存プロトコルへの追加デプロイ                            | [DeployFinance.s.sol](../contracts/script/DeployFinance.s.sol)                                                                |
| ABI・アドレス・索引開始blockのMultiBaas登録               | [link-finance-multibaas.ts](../scripts/link-finance-multibaas.ts)                                                             |

MultiBaasはこの追加機能で **コントラクト読み取り、未署名取引の組み立て、イベント索引／検索、receipt監視** に使う。デプロイはFoundry、ABI/API登録はSDKによる別ステップ。ブラウザの送信前には2つの拡張が既存Rights／Revenue／MockJPYを参照することを確認する。設定が不足すると接続未完了を表示し、模擬約定に置き換えない。

Markets → Fractional／Rentalに残高・請求可能額・貸出中の利用者・回収可否・履歴を表示する。既存Dashboardの市場全体集計には、この2拡張の約定額やレンタル料はまだ合算しない。プロトタイプの取得上限は各pool／listing／offerカタログ200件で、超過はエラーとして明示する。

## 東京の屋根を使ったデモ

1. Aが発行した100口の太陽光収益権をBが購入する。Bは取得した1口をMarkets → Fractionalで預け、1,000持分を発行する。
2. Bが250持分を出品し、Cが購入する。元の1口はVaultに残る。
3. 元の100口の権利に10,000 mJPYが新規入金される。Vaultの1口には100 mJPY、Cの250／1,000持分には25 mJPYが発生し、Cが請求する。
4. Cが残り750持分も取得すれば、1,000持分をburnして元の収益権1口を受け取れる。
5. 貸出は別の排他的利用権で示す。Aが屋根利用権を預け、運営者が1日分を前払いする。有効な利用者、早期返却、Aの回収をRental画面で確認する。

ENSは空間の識別と発行権限の限定委任を担い、この追加処理は発行済みright IDを参照する。貸出の利用者とENSの発行権限は別で、借りただけでENSのoperator権限や新規発行権限は付与されない。

## 検証と再現

```sh
npm run test:contracts
npm run test:coverage
npm run typecheck
npx playwright install chromium
npm run test:finance
npm run build
```

- Solidity全67テストを通過。うち追加26件は[Finance.t.sol](../contracts/test/Finance.t.sol)。custody、収益帰属、失効、二重貸出、異常入力、再入、fuzzでの持分供給量と原資産の一致を検証する。
- Vitest全114テストを通過。追加アダプターの10テストは[rights-finance.test.ts](../src/lib/rights-finance.test.ts)。
- TypeScriptとproduction buildを通過。既存市場・Basket・分析・アカウント表示の関連ブラウザ8ケースも、それぞれdemo／MultiBaasモードで通過した。
- ブラウザ検証は[finance.spec.ts](../contract-e2e/finance.spec.ts)。分割→購入→入金→請求→償還、貸出→早期返却→回収、履歴、390px表示を通した。[保存した実行記録](../deployments/finance-local-verification.json)。
- `test:finance` は一時Anvil・アプリ・API fixtureを空きポートで起動し、自分で起動したプロセスを終了する。テスト専用のローカルアカウントを使い、公開チェーンや利用者のウォレットには送信しない。
- チェーン上のコントラクト・トークン移動・receiptは実物。**MultiBaas側はローカルのAPI形式fixtureであり、実MultiBaasサービスの索引・CORS・権限を確認した証拠ではない。** 公開接続後に同じ操作を実サービスで再確認する。

## 既存テストネットへの追加配置

先にMultiBaasの登録枠を確認する。2026-09-27の読み取りではCurvegrid Testnetは6／10枠、Sepoliaは9／10枠。追加2本にはSepoliaの枠が1つ不足する。既存リンクの削除やプラン変更は行っていない。リンクスクリプトも不足時は書き込み前に停止する。

既存manifestの`rights`と`revenue`へ追加する。コア6本を再デプロイする必要はない。以下はリポジトリルートから開始する例。`DEPLOYER_ADDRESS`はローカルのFoundryアカウントに対応するテスト用アドレスを指定する。

```sh
cd contracts
DEPLOYMENT_FILE=../deployments/11155111.json \
  DEPLOYER_ADDRESS=<test-deployer-address> \
  forge script script/DeployFinance.s.sol:DeployFinance \
  --rpc-url <sepolia-rpc-url> --account <local-foundry-account> --broadcast
cd ..
npm run finance:link -- --env .env.sepolia --manifest deployments/finance-11155111.json
```

Curvegrid Testnetではmanifestを`2017072401.json`に変更し、Forgeの実行に`FOUNDRY_PROFILE=curvegrid`を付けてParis向けにコンパイルする。リンク対象の環境ファイルも同じチェーンに合わせる。現在のプランの過去ログ索引範囲は100 blocksなので、枠を確保してからデプロイし、直後にリンクする。

環境ファイルはサーバー専用の`MULTIBAAS_URL`と`MULTIBAAS_API_KEY`を使用する。リンク完了後にフロントエンドへ以下を設定し、既存のcoreアドレス・chain・DApp keyを同じ環境へ合わせて再ビルドする。

```dotenv
NEXT_PUBLIC_FRACTION_ADDRESS=<finance manifest fraction>
NEXT_PUBLIC_RENTAL_ADDRESS=<finance manifest rental>
```

公開接続の完了条件は、両コントラクトへのDApp key読取・compose、ブラウザの購入とレンタル、receipt、実イベント索引を確認すること。リポジトリでの実装完了と公開サイトでの利用可能状態を区別する。
