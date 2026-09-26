# Judge Q&A Cheatsheet

Answers are grounded in the code. File references are for your own backup if a judge asks "show me".

### 1. Why blockchain?

Rights here are split across many parties (owner, verifier, operator, many investors, basket holders) who do not trust one company's database. The chain enforces three rules nobody can quietly override: no overlapping exclusive use (`findConflict`), payment and token delivery in one atomic `purchase`, and revenue split only from real deposits by a transparent index (`RevenueVault`). Rights are ERC-1155 tokens, so they compose: `BasketVault` bundles them without asking permission.

> JA: 当事者が多く互いを信用しないため、重複禁止・同時決済・収益按分をチェーンで強制する。

### 2. Why not a database or a normal marketplace?

A marketplace can list a rooftop; it cannot guarantee that a second platform is not selling the same roof for the same dates, or that a secondary buyer receives no revenue earned before purchase. We enforce both in contracts (conflict check at issuance and again at verification; revenue checkpoint on every transfer in `UrbanRightToken._update`). The history is also portable: any dashboard can rebuild the market from events, which is exactly how ours works via MultiBaas.

> JA: 二重販売防止と過去収益の非継承をコントラクトで保証し、履歴はイベントで誰でも再構築できる。

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

It is our entire backend in live mode: contract reads, 24 address-filtered Event Queries for discovery and history, server-side `add` aggregation for volume and revenue totals, and unsigned transaction composition (`signAndSubmit: false`) that the user signs in their own wallet. Signed webhooks trigger dashboard refresh, and a separate admin key runs a Cloud Wallet operator for verifier and revenue actions. RBAC maps to our roles: DApp User key in the browser, admin key only on the server, and `multibaas:verify` checks the browser key cannot list API keys.

> JA: 読み取り・イベント検索・集計・未署名Tx生成・Webhook をすべて MultiBaas で賄い、独自インデクサ不要。

### 7. What is technically new?

A spatial-temporal conflict engine for real-world rights on-chain: canonical scopes with a whole-asset wildcard, half-open intervals so adjacent bookings pass, exclusivity forcing supply 1, re-check at verification to defeat racing pending applications, and revenue rights that deliberately coexist with usage rights. Combined with transfer-time revenue checkpoints and custody-backed baskets that harvest revenue, one protocol handles a vacant-home workshop and a solar revenue pool. All of it is covered by 25 Foundry tests including a rounding fuzz test.

> JA: 空間・時間の競合判定をオンチェーンで行い、利用権と収益権を共存させる点が新しい。

### 8. What stops two people selling the same rooftop?

Three layers. Only one asset can be verified per canonical geo hash (`verifiedAssetByGeo`). Only the verified asset's issuer can create rights on it. An exclusive right on the roof blocks any other non-revenue right (exclusive or not) on the roof or the whole asset for overlapping dates, checked at creation and again at verification (the demo shows "Spatial Right Conflict"). Honest limit: the geo hash is only as canonical as the verifier makes it, so a differently described duplicate still needs verifier review.

> JA: 位置ハッシュの一意性・発行者制限・競合判定の三重チェック。別表記の重複は検証者の責任。

### 9. Cold start?

Supply comes first: owners can register and list without any buyers, and lifecycle labels (Dormant, Available, Funding, Funded, Active) show where each asset stands. Opportunity Lens visualizes about 150 demo sites to show the scale of dormant supply that local governments already count. Baskets let a small investor get exposure to several roofs at once, and operators (solar installers) are natural first issuers because they already have revenue to deposit.

> JA: 供給側から始め、Opportunity Lens で潜在供給を可視化し、Basket で小口投資家を呼ぶ。

### 10. What is simulated and what is real?

Real: six Solidity contracts and their tests, 50 transactions with assertions on local Anvil (`demo:seed`), the MultiBaas SDK adapter, scripts and webhook receiver with unit tests. Simulated: all assets and sites (fictional positions on a real OpenStreetMap basemap), ownership verification, Mock JPY, and the browser demo mode, which runs the same rules and event shapes in localStorage. `TODO natsuki: state whether the live MultiBaas run was completed.` The map uses OpenFreeMap tiles, not a 3D city model dataset.

> JA: コントラクトとテストは本物、資産・検証・通貨・ブラウザデモは模擬。

### 11. How does revenue distribution work?

The operator deposits Mock JPY into `RevenueVault` only while the revenue right is Active and inside its time window. The vault raises a cumulative `rewardPerShare` index (scaled by 1e27) for that right. Every token transfer checkpoints sender and receiver first, so a buyer earns only from deposits after purchase; `claim` pays accrued amounts and rounding dust stays in the vault (fuzz-tested to never create money). Baskets harvest from the vault and redistribute per basket share.

> JA: 入金時に1単位あたり累積収益を更新し、移転時に精算。購入前の収益は引き継がない。

### 12. What is next?

First, a live MultiBaas testnet deployment with a recorded signed-webhook refresh and Transaction Explorer links. Then a real verifier partner and KYC-gated `Allowlist` transfers, the Cloud Wallet operator for scheduled revenue deposits, a shared database for webhooks so the app can scale beyond one Node server, and finer geometry than five canonical scopes. Legal structuring with counsel comes before any real money.

> JA: 本番 MultiBaas 接続、検証パートナーと KYC、運用自動化、法務設計の順に進める。
