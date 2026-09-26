# Judge Q&A Cheatsheet

Start with a 15–20 second answer. Use the detailed sections below only when a judge asks for evidence. The browser demo mode is simulated; the same contracts run live on Curvegrid Testnet and are indexed by MultiBaas (multibaas mode); ENSv2 / PLATEAU are planned.

## Six answers for the three-minute Q&A

| Question | Short answer | Evidence / limit |
| --- | --- | --- |
| Does PLATEAU prove ownership? | No. Spatial data describes a place; verification of authority is separate. Our current map is OpenStreetMap. | Simulated verifier role. No real title checks. |
| Why blockchain instead of a database? | A common settlement layer enforces issuance, atomic trades and deposited-revenue accounting across holders and vaults. | Solidity contracts; not a guarantee against external duplicate contracts. |
| How is this different from property NFTs? | The token describes what a particular space may provide, for a defined purpose and period. | Roof access differs from building title and from a revenue share. |
| Can two operators rent the same roof? | Within the protocol, a verified exclusive use blocks competing uses for overlapping dates. | Canonical scopes and geo hashes; verifier review still matters. |
| Why ENS? | The proposed hierarchy identifies a right's space and enables scoped namespace delegation. | Not implemented. An explicit adapter must connect it to issuance. |
| Why Curvegrid? | The SDK, indexing, queries and signed webhooks are designed to build the citywide market from its lifecycle events. | Code and local tests exist; real connection is pending. |

## Detailed answers

### 1. Why blockchain?

Rights here are split across many parties (owner, verifier, operator, many investors, basket holders) who do not trust one company's database. The chain enforces three rules nobody can quietly override: no overlapping exclusive use (`findConflict`), payment and token delivery in one atomic `purchase`, and revenue split only from real deposits by a transparent index (`RevenueVault`). Rights are ERC-1155 tokens, so they compose: `BasketVault` bundles them without asking permission.

> JA: 当事者が多く互いを信用しないため、重複禁止・同時決済・収益按分をチェーンで強制する。

### 2. Why not a database or a normal marketplace?

A database can represent these rules. Our reason for a shared protocol is that marketplaces and vaults can use the same settlement rules and public history. Contracts reject conflicting rights within this registry and preserve past revenue for the seller (conflict checks at issuance and verification; revenue checkpoints in `UrbanRightToken._update`). They cannot prevent somebody making a separate off-platform agreement or using a different registry. MultiBaas mode is implemented to rebuild the market from events but awaits live verification.

> JA: 共通の決済ルールと履歴を複数市場・Vaultで使うため。同一Protocol内の競合を防ぎ、外部の契約まで阻止するとは主張しない。

### 3. Who verifies ownership?

An address with `VERIFIER_ROLE` in `UrbanAssetRegistry`. In this prototype verification is simulated: the verifier approves by clicking, and the app says "Verification is simulated. Map data does not prove ownership." In production this role would be a licensed party (for example a judicial scrivener or a trust company) checking registry records; the contract already separates asset verification from right verification and supports rejection and resubmission. Note the deployer holds `VERIFIER_ROLE` by default unless `ADMIN_ADDRESS` is set.

> JA: VERIFIER_ROLE が検証。デモでは模擬で、本番は司法書士・信託会社等の第三者を想定。

### 4. What exactly is tokenized?

Not the building. A right: asset id + scope (roof, interior, wall, land, whole) + time window `[start, end)` + type (Usage, Revenue Share, Lease, Other) + purpose + terms hash + transfer policy, as an ERC-1155 id with fixed supply. Exclusive usage rights have supply 1; revenue rights are divisible units that receive a pro-rata share of actual deposits. Baskets are a second ERC-1155 backed by custody of revenue rights.

> JA: 建物ではなく「空間×期間×用途×キャッシュフロー」の権利を ERC-1155 で発行。

### 5. Is this a security in Japan?

We do not claim a legal classification. A transferable revenue-share token that pays cash flows from a project could fall within Japan's Financial Instruments and Exchange Act (for example as electronically recorded transferable rights or a collective investment scheme interest), which would require licensed intermediaries and disclosure. That is why this prototype uses a valueless Mock JPY on test networks, sells no residential or property ownership, and supports `Allowlist` and `Nontransferable` policies that a compliant deployment could use for KYC-gated transfers. Real launch needs legal counsel.

> JA: 法的分類は断定しない。金商法の対象になり得るため、本作はテスト通貨のみで提供していない。

### 6. Why Curvegrid MultiBaas?

It is the implemented backend for `multibaas` mode, verified live on Curvegrid Testnet on 2026-09-26: contract reads, 24 address-filtered Event Queries for discovery and history, server-side `add` aggregation for volume and revenue totals, and unsigned transaction composition (`signAndSubmit: false`) that the user signs in their own wallet. Signed webhooks trigger dashboard refresh, and a server-only operator adapter supports Cloud Wallet verifier/revenue actions when configured. Cloud Wallet and TXM have not been exercised. RBAC maps to our roles: DApp User key in the browser, admin key only on the server, and `multibaas:verify` checks the browser key cannot list API keys.

> JA: 読み取り・イベント検索・集計・未署名Tx生成・Webhook をすべて MultiBaas で賄い、独自インデクサ不要。

### 7. What is technically new?

A spatial-temporal conflict engine for real-world rights on-chain: canonical scopes with a whole-asset wildcard, half-open intervals so adjacent bookings pass, exclusivity forcing supply 1, re-check at verification to defeat racing pending applications, and revenue rights that deliberately coexist with usage rights. Combined with transfer-time revenue checkpoints and custody-backed baskets that harvest revenue, one protocol handles a vacant-home workshop and a solar revenue pool. All of it is covered by 25 Foundry tests including a rounding fuzz test.

> JA: 空間・時間の競合判定をオンチェーンで行い、利用権と収益権を共存させる点が新しい。

### 8. What stops two people selling the same rooftop?

Three layers. Only one asset can be verified per canonical geo hash (`verifiedAssetByGeo`). Only the verified asset's issuer can create rights on it. An exclusive right on the roof blocks any other non-revenue right (exclusive or not) on the roof or the whole asset for overlapping dates, checked at creation and again at verification (the demo shows "Spatial Right Conflict"). Honest limit: the geo hash is only as canonical as the verifier makes it, so a differently described duplicate still needs verifier review.

> JA: 位置ハッシュの一意性・発行者制限・競合判定の三重チェック。別表記の重複は検証者の責任。

### 9. Cold start?

Demand first. An investor or operator can signal interest in a dormant site from Opportunity Lens before any owner is on the platform. That demand is routed to the owner: in-app if they are registered, otherwise through local agencies and referrals. An owner who hears "twelve people want to fund your rooftop" has a reason to register and verify, and the right is issued into visible demand. Today the app shows about 150 demo sites and the lifecycle labels (Dormant, Available, Funding, Funded, Active); the interest-signal step is the next feature.

> JA: 需要が先。Lens で関心表明 → 所有者へ届ける（アプリ内・代理店・紹介）→ 検証 → 需要が見えた状態で発行。関心表明機能は次の実装。

### 10. What is simulated and what is real?

Real: six Solidity contracts and their tests, 50 transactions with assertions on local Anvil (`demo:seed`), the MultiBaas SDK adapter, scripts and webhook receiver with unit tests, and the same six contracts deployed on Curvegrid Testnet (chain 2017072401), linked to a MultiBaas deployment and indexed live: the Activity ledger in `multibaas` mode shows real events through Event Queries. Simulated: all assets and sites (fictional positions on a real OpenStreetMap basemap), ownership verification, Mock JPY, and the browser demo mode, which runs the same rules and event shapes in localStorage. The map uses OpenFreeMap tiles, not a 3D city model dataset.

> JA: コントラクト・テスト・Curvegrid Testnet 上の稼働と MultiBaas 索引は本物。資産・検証・通貨・ブラウザのデモモードは模擬。

### 11. How does revenue distribution work?

The operator deposits Mock JPY into `RevenueVault` only while the revenue right is Active and inside its time window. The vault raises a cumulative `rewardPerShare` index (scaled by 1e27) for that right. Every token transfer checkpoints sender and receiver first, so a buyer earns only from deposits after purchase; `claim` pays accrued amounts and rounding dust stays in the vault (fuzz-tested to never create money). Baskets harvest from the vault and redistribute per basket share.

> JA: 入金時に1単位あたり累積収益を更新し、移転時に精算。購入前の収益は引き継がない。

### 12. What is next?

Co-ownership already exists: a Revenue Share right is 100 fungible ERC-1155 units, so many holders share one rooftop's cash flow, and BasketVault pools several roofs. The next financial layer is collateralized lending, using revenue history to value a right and borrow against it; that needs a valuation oracle and a securities-law review before anything real. On the plumbing side: a real verifier partner with KYC-gated `Allowlist` transfers, the Cloud Wallet operator for scheduled revenue deposits, a shared store for webhooks beyond one Node server, and finer geometry than five canonical scopes.

> JA: 共同所有は既に実装（収益権は 100 単位の ERC-1155）。次は担保貸付（評価オラクルと金商法レビューが前提）、検証パートナー、KYC、運用自動化。

---

Harder questions (40, tagged fatal / prepared / demo): [English](qa-adversarial.en.md) · [日本語](qa-adversarial.ja.md)
