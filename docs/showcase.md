# ETHGlobal Showcase Fields

## Short description (60 to 100 characters)

Pick one. Character counts include spaces.

1. `Tokenize what Tokyo's idle spaces can do: scoped, time-bound rights that fund and trade.` (88)
2. `Turn dormant Tokyo roofs and vacant homes into verifiable usage and revenue rights on-chain.` (92)
3. `Dormant capital, put to work: conflict-free urban rights for Tokyo, indexed by MultiBaas.` (89)

## Project Description

**Problem.** Tokyo has 897,000 vacant homes, 214,000 of them "other vacant homes" that are not for rent or sale (MIC 2023 Housing and Land Survey). The 23 wards hold about 1,303 ha of unused land (TMG 2021 Land Use Survey), and only about 6.0% of detached houses have rooftop solar (TMG Bureau of Environment, FY2022). The blocker is not capital. An owner cannot sell part of what a space can do, such as a roof for ten years of solar or a ground floor as a weekend workshop, without a bespoke contract for the whole property, and investors have no shared record of what is available, already committed, or actually paid.

**Solution.** TOKENIZE TOKYO implements the Urban Rights Protocol: a right is space × time × usage × cash flow. Owners register an asset, a verifier approves it, and the owner issues ERC-1155 rights scoped to roof, interior, wall, land or whole asset, with a half-open time window, purpose, terms hash and transfer policy. An on-chain conflict engine rejects overlapping exclusive uses, while revenue-share rights coexist with usage rights on the same space.

**Example walkthrough.** Owner A registers a roof in Nihonbashi; the verifier approves it. Owner A issues 100 units of a solar revenue right and lists them. Investor B buys 10. The verifier activates the project and the operator deposits 10,000 mJPY; B can claim exactly 1,000. B resells 5 units to Investor C, who does not inherit B's past revenue. C bundles two solar rights into a Tokyo Solar Basket, minting shares only against rights held in custody. Owner A then tries to issue a second exclusive roof use for the same dates and the chain rejects it: "Spatial Right Conflict". Opportunity Lens lights up about 150 demo sites to show the dormant supply this pipeline targets.

**Innovation.** We tokenize what a place can do rather than the building. Conflict detection is enforced by the contract at issuance and again at verification, and revenue accounting checkpoints every transfer. The dashboard reads everything through Curvegrid MultiBaas event queries, and users sign MultiBaas-composed transactions in their own wallets. All assets are simulated test data; Mock JPY has no value.

## How It's Made

**Stack.** Next.js 16 (App Router, React 19, TypeScript), MapLibre GL 6 with OpenFreeMap/OpenStreetMap vector tiles and extruded buildings, viem for wallet plumbing, Zod for webhook payloads. Contracts are Solidity 0.8.28 with OpenZeppelin 5 and Foundry: 25 Foundry tests including a rounding fuzz test, 33 Vitest tests and 4 Playwright end-to-end tests, run in CI.

**MultiBaas integration.** The browser uses only a DApp User key with the `@curvegrid/multibaas-sdk`. It reads contracts with `callContractFunction`, discovers assets, rights, listings, transfers and revenue through 24 address-filtered Event Queries paged 500 rows at a time, and gets volume and revenue totals from server-side `add` aggregation. Writes call `callContractFunction` with `signAndSubmit: false`; we validate the returned `to`, `from`, `value` and `data` before the wallet signs. A signed-webhook route checks HMAC-SHA256 over raw body plus timestamp, deduplicates by delivery id, and bumps a revision the UI polls to re-query. Server scripts link all six contracts with forge-multibaas, verify indexing and key permissions, and run an allowlisted Cloud Wallet operator with TXM status.

**Contracts.** Registry (asset lifecycle, one verified asset per geo hash), UrbanRightToken (scoped ERC-1155 rights, conflict engine), Marketplace (atomic fixed-price trades), RevenueVault (reward-per-share index), BasketVault (custody-backed basket shares), MockJPY.

**Notable and hacky.** MultiBaas Event Query has no log index, so same-block lifecycle ties are resolved with a contract read. The in-browser demo mode reimplements contract rules and emits the same event shapes into the same projection function as live mode, so the UI code path is identical. The webhook store uses exclusive hard links as an atomic, retry-safe dedup without a database.
