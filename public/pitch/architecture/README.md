# RWA Tokenization Platform — architecture

[Animated HTML](index.html?autoplay=1) · [Static overview](overview.png)

The architecture is an additional explanation slide. The original four-slide introduction and logo → 3D city reveal remain intact. English labels match the current black/yellow presentation. Each view uses three large concepts and two arrows. The overview includes concrete functions beneath each concept and a shared Curvegrid service row; detailed calls remain in the focused views and notes. The overview is Tokenize → Launch & trade → Bundle & operate. Advancing replaces the diagram with one focused flow; service details appear only in the relevant view. All diagram text, nodes and connections are editable HTML/SVG; no video is generated.

In `/present`, **A** opens the architecture, **D** returns to the mounted demo, and **S** returns to the opening slides. **Alt+3** also opens the architecture while editing an input. On this slide, **→ / Space** advances the explanation, **←** goes back, **0** shows the whole platform, **P** plays a single sequence, **H** reveals controls, and **N** shows notes. Controls start hidden. Reduced-motion preferences disable the transition between views. Leaving the architecture stops automatic advancement and retains the current explanation.

## Explanation sequence

| State | English | 日本語 |
| --- | --- | --- |
| Overview | Tokenize Tokyo is an RWA platform connecting issuance, a launchpad, a marketplace, fractional revenue ownership and basket management. | 発行、Launchpad、Marketplace、小口の収益保有、バスケット運用をつなぐRWAプラットフォームです。 |
| Structure + launch | Owners define a space, its scope and its terms. Reviewed rights are issued as revenue units and offered through the launchpad. | 空間と条件を定め、資産と権利を審査し、小口の収益権を発行して募集します。 |
| Participate + trade | Privy provides Google/email onboarding. For card checkout, CloudWallet signs and submits the purchase with operator-paid gas. | Google・メールで入り、カード購入では運営CloudWalletが署名・送信とガス負担を担います。 |
| Bundle + manage | Compatible rights are deposited into BasketVault. Holders mint basket shares, trade them, claim income and redeem underlying rights. | 複数の互換収益権を預託し、まとめた持分を発行・売買・収益請求・償還できます。 |
| Operate + follow the money | RevenueVault accounts for deposited income. MultiBaas retrieves contract state and market events and aggregates totals for the dashboard. | 入金を会計・配分し、MultiBaasで状態・履歴・集計値を取得してDashboardに表示します。 |

## Implementation evidence

- Primary rights and fractional ownership: `contracts/src/UrbanRightToken.sol` issues ERC-1155 revenue units. These do not convey property title. The separate `FractionVault` subdividing acquired units has been verified on Anvil and awaits public deployment; it is not the fractional-unit mechanism depicted in the main flow.
- Launchpad and Marketplace: existing issuer offers and secondary listings use `contracts/src/UrbanMarketplace.sol`. Fixed-price fundraising pays sellers directly; the architecture does not claim fundraising escrow or minimum-goal refunds.
- BasketVault: `contracts/src/BasketVault.sol` supports 2–8 compatible revenue rights in fixed composition, custody-backed share issuance, trading, revenue claims and redemption for underlying rights. No automatic rebalancing. Public run evidence: `deployments/sepolia-demo-receipts.json` and `deployments/sepolia-multibaas-verification.json`.
- RevenueVault: `contracts/src/RevenueVault.sol` distributes settlement tokens actually deposited. Physical generation and offchain receipts need separate verification.
- Privy: `src/components/PrivyConnection.tsx`; Google/email login is enabled in the deployed application. Public login UI was inspected; authenticated wallet creation/signing still needs an account-owner run. See `docs/WALLET_SETUP.md`.
- ENS: `docs/ENS_PRIZE_DEMO.md`. Canonical space binding, ENS role checks plus owner grants for issuance, and an isolated Permissioned Resolver for report-key permissions. Other map names remain previews.
- MultiBaas: `src/lib/multibaas.ts` uses contract calls, Event Queries and `add` aggregation. Initial Sepolia records use a verified RPC archive; later indexed ranges are combined without double counting. The arrows express functional dependencies, not a claim that every dataset row was retrieved exclusively through MultiBaas.
- CloudWallet: `src/server/card-chain.ts` calls MultiBaas with `signAndSubmit: true` and `nonceManagement: true`. `deployments/card-checkout-hosted-verification.json` records the deployed Stripe test webhook → operator wallet → Sepolia delivery. [Purchase receipt](https://sepolia.etherscan.io/tx/0x8e5d49e8f3e84ccd479e039dbd2501fb1592c38455e6d12d1e930a1322dfffbc).
- Planned extension: T-REX / ERC-3643 requires additional issuance, identity, settlement, indexing and vault integration. [Specification](https://eips.ethereum.org/EIPS/eip-3643). Other cities require their own asset data and operating/legal arrangements. Contractual rights and duties would need to be established for real assets; the test prototype has not executed such agreements.

Official references: [MultiBaas Event Queries](https://docs.curvegrid.com/multibaas/event-indexing/), [Cloud Wallets](https://docs.curvegrid.com/multibaas/cloud-wallets/), [ERC-3643](https://eips.ethereum.org/EIPS/eip-3643).

Rebuild from the repository root with `node docs/submission-kit/architecture/render.mjs`. `index.html` is the source; `public/pitch/architecture` is the presentation copy. Private PNG checks are under `build/`.
