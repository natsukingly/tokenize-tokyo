# 200-space Sepolia test catalog

The target is **200 registered spaces**: preserve the four existing Sepolia assets and add 196 fictional spaces. This is not a migration from Curvegrid Testnet and does not modify the separate 265-space browser simulation.

## Verified public snapshot — 2026-09-27 JST

The available-funds run reached **88 assets, 47 rights and 12 active rights**, preserving the existing mixed basket. It added 84 spaces: 12 of each of the seven kinds. Seven newly issued rights remain pending verification. This is a partial run toward 200 assets, not a claim that all 200 are issued.

- **392 additional confirmed transactions**; all **376 market actions** matched MultiBaas transaction hashes and blocks. The other 16 transactions set up test balances, gas or approvals.
- **558 indexed market events**, including the preserved initial records. Total traded amount: **1,891,700 MockJPY**; deposited income: **24,300 MockJPY**. These are scripted, valueless test amounts.
- Issuer balance retained: **0.004534505783393144 Sepolia ETH**. The script protects a minimum of 0.003 ETH and stops before the next estimated transaction would exceed its available budget/reserve check.
- **112 asset registrations remain**, together with unfinished lifecycle steps on some already registered assets. The same journal can resume them after funding; existing registrations, purchases and deposits are not repeated.

Evidence: [public receipts](../deployments/sepolia-city-receipts.json), [contract-state and balance checks](../deployments/sepolia-city-verification.json), [MultiBaas index checks](../deployments/sepolia-city-index-verification.json). The separate [14-space fork rehearsal](../deployments/sepolia-city-fork-verification.json) completed 79 local transactions and a repeat run without duplicates. Catalog tests and TypeScript checks passed.

The issuer's actual outflow and network fees are reported separately from the conservative budget counter. Adding investor gas allocations to network fees counts some allocated gas twice; it is a safety allowance, not the issuer's net spending.

## Operator gas is held in the Cloud Wallet

The operating wallet is **`0xE90FB4cABa8bE81391389A2dA4E2192c69151a17`**, a Sepolia Cloud Wallet linked to MultiBaas and verified by recovering a fresh signature. It is separate from the deployer/issuer `0x71bE0c03F807Ad83F290aDddb842f14652c80554` used by the city seed.

At the user's request, the operator was topped up to **0.05 Sepolia ETH** on 2026-09-27 JST. The transfer added 0.048241259602139388 ETH; receipt-time balances are preserved in the [funding report](../deployments/sepolia-cloud-wallet-funding.json) and [Sepolia transaction](https://sepolia.etherscan.io/tx/0x8f6c169fcc91d34de86bc9d8e94e529ba151fcbe2bf5bf6f0b8e84561ad1a992). Later authorized operator transactions may consume that gas. The seed uses only the deployer's remaining funds, with a separate 0.003 ETH deployer buffer. It never signs with or spends the Cloud Wallet. This incoming transfer does not grant contract roles or enable sponsored user transactions.

日本語: 運営用のガス代は、デプロイ用アドレスとは別の**Cloud Walletに0.05 Sepolia ETHを補充済み**です。追加データの発行はデプロイ用ウォレットの残額だけで行い、こちらにも0.003 ETHを残します。運営用の残高をデータ発行で消費しません。補充は権限付与や利用者のガス代肩代わり機能の有効化とは別工程です。

## Catalog and lifecycle

The additional catalog contains 28 examples of each kind: rooftop, vacant home, idle land, parking, storage, advertising and other community space. There are also 28 examples of each lifecycle below, distributed across those seven kinds.

| Scenario | Result |
| --- | --- |
| Draft | Registered asset; not submitted for review |
| Review pending | Review requested; cannot issue a right yet |
| Verified | Simulated verification completed; no right issued |
| Funding open | Verified income right with 100 units listed |
| Partly funded | A test investor buys 25, 45, 65 or 85 of 100 units |
| Operating | All 100 units purchased; activated, test income deposited and claimed |
| Usage listed | One exclusive fixed-term usage right listed; no income entitlement |

The finished target adds **112 ERC-1155 rights**, 56 purchases and 28 income deposits/claims. Existing rights, the mixed basket and its balances are retained. New revenue rights can be used in additional baskets through the existing Compose workflow. New generated ENS names remain previews; this script does not register 196 ENS names or delegate control.

## Execution and evidence

```sh
# Read-only preflight; explicit Sepolia environment required.
npx tsx scripts/seed-sepolia-city.ts --env .env.sepolia

# Execute/resume within available funds, preserving 0.003 Sepolia ETH for the issuer.
npx tsx scripts/seed-sepolia-city.ts --env .env.sepolia --broadcast --spend-available

# Read contract state and match every asset, right and investor balance.
npx tsx scripts/seed-sepolia-city.ts --env .env.sepolia --verify

# Separately match MultiBaas discovery, event hashes, listings and totals.
npx tsx scripts/verify-sepolia-city.ts --env .env.sepolia
```

Only public transaction records belong in Git. Signers and exact-hash recovery journals stay in ignored `.data` directories with restricted permissions. A maximum of **0.30 Sepolia ETH including test-investor funding** and 1,200 actions is enforced. Waves of up to 21 spaces cover different asset kinds and lifecycles before moving on. The initial seven-space waves were completed before increasing throughput. Batches are bounded, submitted sequentially per signer and confirmed before dependent phases. The issuer retains at least 0.003 Sepolia ETH; `--spend-available` additionally caps the run at its starting available balance. Test investors receive small gas top-ups only when required. A resumed wave can add another bounded allocation under a new journal ID, without replaying the earlier transfer; each allocation restores at most 0.002 ETH. Partial runs report their actual counts and completed scenarios, never the unissued target. A resumed action must match its original chain, recipient, calldata and value. The script pauses on insufficient funds, unexpected fees or an incomplete receipt; it does not silently repeat a transaction with a fresh nonce.

Transactions are signed locally and sent to Sepolia RPC; the existing MultiBaas contract links index the resulting events. The small 51-transaction scenario separately verified MultiBaas unsigned transaction composition. The large catalog's index check requires every market action's transaction hash and block to appear in MultiBaas.

The scripts write public receipts and separate contract-state / index verification reports under `deployments/sepolia-city-*`. **A prepared catalog or a local fork rehearsal is not proof that 200 assets have been issued on public Sepolia.** Consult those reports for the completed count. Fork rehearsal uses local Anvil with chain ID `31338`; those transactions cannot be replayed on Sepolia (`11155111`).

All locations, operating states, ownership checks, purchases and income amounts are scripted test scenarios. MockJPY has no monetary value. Every public transaction keeps its real block timestamp: historical trading is never fabricated to fill a chart.

## 日本語

**今回の実行結果は88資産・47権利・稼働中12件です。** 7種類を各12件、84資産追加しました。追加392取引が成功し、市場操作376件すべてをMultiBaasのハッシュ・ブロックと照合済みです。残高は約0.00453 Sepolia ETHを保持。200件分のデータは用意済みですが、全件発行は未完了です。残り112資産の登録と、一部資産の後続工程は同じ記録から再開できます。

目標は**合計200資産**です。Sepoliaの既存4資産を保持し、7種類の資産を各28件、計196件追加します。登録途中・審査待ち・審査済み・募集中・一部出資済み・稼働中・利用権販売中を各28件用意し、地図、Markets、Dashboardで状態の違いを確認できるようにします。

追加分では112権利を実発行し、56件の購入と28件ずつの収益入金・受取りを行います。収益権と排他的な利用権は分けます。既存の混合バスケットや旧Curvegrid Testnetのデータは変更しません。追加資産のENS名はプレビューで、196件のENS登録を同時に行う処理ではありません。

処理は途中で止まっても同じ記録から再開でき、既存の取引を重複発行しません。登録者の0.003 Sepolia ETHを保護し、残高の範囲で状態の異なる案件を最大21件のまとまりで進めます。テストETHが不足すれば停止し、途中までの実発行件数を記録します。公開Sepoliaでの完了件数は `deployments/sepolia-city-*` の記録で確認します。取引がすべて今日発生した場合、ライブのグラフも今日に集計します。過去の日付を装った取引は作りません。実資産・実売上・投資利回りを表すデータではありません。
