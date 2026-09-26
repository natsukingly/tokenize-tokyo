# 200-space Sepolia test catalog

The target is **200 registered spaces**: preserve the four existing Sepolia assets and add 196 fictional spaces. This is not a migration from Curvegrid Testnet and does not modify the separate 265-space browser simulation.

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

Only public transaction records belong in Git. Signers and exact-hash recovery journals stay in ignored `.data` directories with restricted permissions. A maximum of **0.28 Sepolia ETH including test-investor funding** and 1,200 actions is enforced. Seven-space waves cover different asset kinds and lifecycles before moving on. Batches are bounded, submitted sequentially per signer and confirmed before dependent phases. The issuer retains at least 0.003 Sepolia ETH; `--spend-available` additionally caps the run at its starting available balance. Test investors receive small gas top-ups only when required. Partial runs report their actual counts and completed scenarios, never the unissued target. A resumed action must match its original chain, recipient, calldata and value. The script pauses on insufficient funds, unexpected fees or an incomplete receipt; it does not silently repeat a transaction with a fresh nonce.

Transactions are signed locally and sent to Sepolia RPC; the existing MultiBaas contract links index the resulting events. The small 51-transaction scenario separately verified MultiBaas unsigned transaction composition. The large catalog's index check requires every market action's transaction hash and block to appear in MultiBaas.

The scripts write public receipts and separate contract-state / index verification reports under `deployments/sepolia-city-*`. **A prepared catalog or a local fork rehearsal is not proof that 200 assets have been issued on public Sepolia.** Consult those reports for the completed count. Fork rehearsal uses local Anvil with chain ID `31338`; those transactions cannot be replayed on Sepolia (`11155111`).

All locations, operating states, ownership checks, purchases and income amounts are scripted test scenarios. MockJPY has no monetary value. Every public transaction keeps its real block timestamp: historical trading is never fabricated to fill a chart.

## 日本語

目標は**合計200資産**です。Sepoliaの既存4資産を保持し、7種類の資産を各28件、計196件追加します。登録途中・審査待ち・審査済み・募集中・一部出資済み・稼働中・利用権販売中を各28件用意し、地図、Markets、Dashboardで状態の違いを確認できるようにします。

追加分では112権利を実発行し、56件の購入と28件ずつの収益入金・受取りを行います。収益権と排他的な利用権は分けます。既存の混合バスケットや旧Curvegrid Testnetのデータは変更しません。追加資産のENS名はプレビューで、196件のENS登録を同時に行う処理ではありません。

処理は途中で止まっても同じ記録から再開でき、既存の取引を重複発行しません。登録者の0.003 Sepolia ETHを保護し、残高の範囲で7件ずつ状態の異なる案件を進めます。テストETHが不足すれば停止し、途中までの実発行件数を記録します。公開Sepoliaでの完了件数は `deployments/sepolia-city-*` の記録で確認します。取引がすべて今日発生した場合、ライブのグラフも今日に集計します。過去の日付を装った取引は作りません。実資産・実売上・投資利回りを表すデータではありません。
