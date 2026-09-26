# TOKENIZE TOKYO

![3D opportunity map](docs/screenshots/explore.png)

## (a) One-sentence summary

**TOKENIZE TOKYO turns Tokyo's dormant rooftops, vacant homes and idle land into scoped, time-bounded ERC-1155 rights (usage and revenue share) that can be verified, funded, traded and bundled into baskets, with every market view built from Curvegrid MultiBaas event queries and every transaction composed by MultiBaas and signed in the user's own wallet.**

> **Integration status (read first).** The contracts, the MultiBaas SDK adapter, deploy/link/verify scripts, the signed webhook receiver and the Cloud Wallet operator are implemented and tested locally (Foundry, Vitest with controlled SDK responses, Playwright on the simulated demo, 50 confirmed transactions on local Anvil). **A live MultiBaas deployment run is `TODO natsuki: confirm`.** Until `npm run multibaas:verify` passes against a real deployment, treat the MultiBaas path as "implemented, not yet verified live". In `multibaas` mode the app fails visibly instead of falling back to simulated data.

---

## Pitch: Dormant Capital

Tokyo does not lack assets. It has assets that do nothing.

| Figure | Value | Source |
| --- | --- | --- |
| Vacant homes in Tokyo | 897,000 | MIC Statistics Bureau, 2023 Housing and Land Survey (令和5年住宅・土地統計調査) |
| of which "other vacant homes" (not for rent, not for sale, not secondary) | 214,000 | same survey |
| Unused land in the 23 wards | about 1,303 ha | Tokyo Metropolitan Government, 2021 Land Use Survey (令和3年 土地利用現況調査) |
| Detached houses with rooftop solar | about 6.0% | TMG Bureau of Environment, FY2022 survey (2022年度実績) |

Sources:

- Vacant homes: MIC, 2023 Housing and Land Survey, Tokyo summary by the TMG Bureau of Housing Policy <https://www.juutakuseisaku.metro.tokyo.lg.jp/akiya/learn/genjyo> (detail tables on e-Stat <https://www.e-stat.go.jp/dbview?sid=0004021631>).
- Unused land: TMG Bureau of Urban Development, "Land Use in Tokyo, 2021 survey of the 23 wards" <https://www.toshiseibi.metro.tokyo.lg.jp/about/chousa/tochi_c/tochi_kekka_r3>.
- Rooftop solar: TMG Bureau of Environment, Tokyo solar installation survey, FY2022 results (detached houses 6.01%, all housing 5.79%, all buildings 4.99%) <https://www.kankyo.metro.tokyo.lg.jp/climate/renewable_energy/solar_energy/200300a20210608150837623>.

The owner of a vacant house or an idle roof has no way to sell *part of what the space can do* (the roof for 10 years of solar, the ground floor on weekends as a workshop) without selling or leasing the whole property through a bespoke contract. Capital providers have no shared registry of what is available, what is already committed, and what revenue has actually been paid.

## Urban Rights Protocol

A right is **space × time × usage × cash flow**.

| Dimension | On-chain field | Where |
| --- | --- | --- |
| Space | `assetId` + canonical `scope`: roof=0, interior=1, wall=2, land=3, whole asset=4 | `UrbanRightToken.SpatialScope` |
| Time | `startAt`, `endAt` as a half-open interval `[start, end)` | `UrbanRightToken.Right` |
| Usage | `rightType` (Usage, Revenue Share, Lease, Other), `purpose` hash, `exclusive` flag, transfer policy (Open, Allowlist, Nontransferable), `termsURI` + `termsHash` | `UrbanRightToken.RightRequest` |
| Cash flow | Revenue Share rights receive a pro-rata share of MockJPY actually deposited into `RevenueVault` | `RevenueVault` |

Every right is an ERC-1155 token id with a fixed supply. Assets and rights have **separate** verification lifecycles (asset: Draft, Pending, Verified, Rejected; right: Pending, Verified, Active, Closed, Rejected).

**Conflict engine** (`UrbanRightToken.findConflict`):

- Two rights on the same asset conflict when at least one is exclusive, the scopes match or either is "whole asset", and the intervals overlap: `start < other.endAt && other.startAt < end`. Adjacent periods (`end == other.start`) do not conflict.
- Only Verified or Active rights block; the check runs at creation **and again at `verifyRight`**, so two competing pending applications cannot both be approved.
- Exclusive usage must have `supply == 1` (indivisible).
- Revenue Share rights (`rightType == 1`) are skipped by the engine and cannot be exclusive, so **revenue rights coexist with usage rights** on the same space: a workshop can use the interior while investors hold the roof's solar revenue.
- Only one asset can be verified per canonical `geoReference` hash (`verifiedAssetByGeo`), and only the verified asset's issuer can create rights on it.

This is a bounded, canonical-scope engine, not an arbitrary polygon intersection or surveyed floor plan.

## Product

- **Explore**: 3D Tokyo (MapLibre GL, OpenFreeMap vector tiles from OpenStreetMap data, extruded buildings) with category and lifecycle filters and a **City X-ray** layer that shows right scopes on each building.
- **Opportunity Lens**: a filter that lights up about 150 client-side, clearly labeled demo sites representing the kind of dormant supply the statistics describe. These are a visual demo dataset, not on-chain assets and not claims about real properties.
- **Tokenize**: register an asset, request verification, verifier approves, issuer defines a scoped right, verifier approves, issuer lists it.
- **Portfolio**: holdings, claimable revenue, resale listings, basket redemption.
- **Compose**: bundle 2 to 8 compatible revenue rights into a Tokyo Solar Basket (ERC-1155 shares backed by custody of the underlying rights).
- **Activity**: urban activity ledger built from MultiBaas event queries; links to the MultiBaas Transaction Explorer.
- Lifecycle stage per asset (`src/lib/lifecycle.ts`): Dormant, Available, Funding, Funded, Active. "Funded" means the issuer sold its full supply; it is not a certification of project economics.

## Architecture

```
                         +------------------------------------------+
  Browser                |  Next.js 16 app (React 19)               |
                         |  Dashboard.tsx  TokyoMap.tsx (MapLibre)  |
                         |  projection.ts: events -> MarketState    |
                         +------+-------------------+---------------+
                                |                   |
        reads, event queries,   |                   | poll /api/activity (2 s)
        unsigned tx composition |                   | full refresh fallback (15 s)
        (DApp User key only)    v                   v
                   +-----------------------+   +--------------------------------+
                   |  Curvegrid MultiBaas  |   | Next.js API (Node runtime)     |
                   |  ContractsApi         |   | POST /api/webhooks/multibaas   |
                   |  EventQueriesApi      |   |  HMAC-SHA256 + 5 min window    |
                   |  ChainsApi            |-->|  dedup by delivery id          |
                   |  Event indexing       |   | GET /api/activity (revision)   |
                   |  Webhooks (signed)    |   +--------------------------------+
                   +----+------------+-----+
     unsigned tx        |            ^  indexes events
     returned to UI     v            |
              +----------------+     |        +------------------------------+
              | Browser wallet |-----+------->| EVM chain                    |
              | signs + sends  |  eth_send... | UrbanAssetRegistry           |
              +----------------+              | UrbanRightToken (ERC-1155)   |
                                              | UrbanMarketplace             |
  Server / CLI only (admin key):              | RevenueVault                 |
   scripts/link-multibaas.ts (forge-multibaas)| BasketVault (ERC-1155)       |
   scripts/verify-multibaas.ts                | MockJPY (test ERC-20)        |
   scripts/operator.ts -> CloudWalletOperator +------------------------------+
     (signAndSubmit=true, nonceManagement, TXM status)
```

Demo mode replaces MultiBaas and the chain with `src/lib/demo.ts`, which enforces the same rules in the browser (localStorage), emits the **same event shapes**, and feeds them through the **same** `project()` function used for MultiBaas event rows.

## Smart contracts

Solidity 0.8.28, Paris EVM, via-IR, OpenZeppelin 5, Foundry. `contracts/src/`.

| Contract | What it does |
| --- | --- |
| `UrbanAssetRegistry` | Anyone registers a draft asset (geo hash, metadata, type). Issuer requests verification; `VERIFIER_ROLE` approves or rejects. One verified asset per canonical geo hash. Metadata is frozen after submission; rejected assets can be revised and resubmitted. |
| `UrbanRightToken` | ERC-1155 rights with type, supply, terms URI/hash, time window, transfer policy, scope, purpose, exclusivity. Conflict engine, right verification, activation, closure, allowlist and nontransferable policies. Its `_update` hook checkpoints revenue for sender and receiver on every transfer. |
| `UrbanMarketplace` | Fixed-price primary and secondary listings for rights and basket shares, partial fills, cancel. Payment (MockJPY) and token delivery in one atomic `purchase`. Listings do not escrow tokens. |
| `RevenueVault` | Deposits allowed only for Active revenue rights inside their time window. Cumulative reward-per-share index (scale 1e27), per-holder checkpoints, claims. Buyers do not inherit revenue earned before they bought. |
| `BasketVault` | ERC-1155 basket shares. Fixed-ratio custody of 2 to 8 revenue rights; deposit and mint are atomic (no unbacked shares); redeem returns the underlying; harvests revenue from `RevenueVault` and redistributes per share. One basket per underlying right. |
| `MockJPY` | "Mock JPY - TEST ONLY" (mJPY), 18 decimals, public faucet capped at 1,000,000 per call. No monetary value. |

**Tests:** 25 Foundry tests in 3 suites (`Protocol.t.sol` 13 including a rounding fuzz test, `Spatial.t.sol` 5, `EdgeCases.t.sol` 7), 33 Vitest tests in 6 files, 4 Playwright end-to-end tests. `npm run demo:seed` additionally executes 50 real transactions on local Anvil with assertions (receipts in `deployments/local-demo-receipts.json`).

Local Anvil addresses (chain 31337, not a public network) are in `deployments/31337.json`.

## (b) How we used MultiBaas

MultiBaas is the app's only data and transaction backend in `multibaas` mode. There is no custom indexer and no RPC read path.

**1. Contract management (Forge MultiBaas).** `npm run multibaas:link` (`scripts/link-multibaas.ts`) checks the MultiBaas chain id against the deployment manifest with `ChainsApi.getChainStatus`, then runs `contracts/script/Link.s.sol`, which calls `MultiBaas.linkContractWithOptions` from `curvegrid/forge-multibaas` for all six contracts with labels `urbanassetregistry`, `urbanrighttoken`, `urbanmarketplace`, `revenuevault`, `basketvault`, `mockjpy`, and sets event sync to start at the deployment block. Deploy and link are separate steps because Forge also runs FFI during simulation.

**2. Reads via the SDK.** `readContract()` in `src/lib/multibaas.ts` calls `ContractsApi.callContractFunction(address, label, method, { args, formatInts: "as_strings" })` for `balanceOf`, `claimable`, `getAsset` and MockJPY `balanceOf`. Integers come back as strings to avoid precision loss.

**3. Discovery and history via Event Queries.** `src/lib/queries.ts` declares 24 event streams (asset lifecycle, `RightCreated`, `RightScopeDefined`, verification/activation/closure, listings, purchases, revenue, basket events, and ERC-1155 `TransferSingle`/`TransferBatch` for both rights and baskets). Each query is built as an `EventQuery` filtered by `FieldType.ContractAddress` so another deployment cannot pollute the view, selects input fields plus `BlockNumber`, `TxHash`, `TriggeredAt`, ordered by block. `EventQueriesApi.executeArbitraryEventQuery(query, offset, 500)` is paged 500 rows at a time, fetched in bounded batches of 4 streams, and the app refuses to render if a stream exceeds 100,000 rows.

**4. Server-side aggregation.** Trade volume, total revenue deposited and total claimed use Event Query aggregation (`aggregator: "add"` on `totalPrice` / `amount`), so dashboard totals are computed by MultiBaas, not by summing in the browser.

**5. Unsigned transactions, signed by the user's wallet.** `sendViaMultiBaas()` calls `callContractFunction(..., { args, from, signAndSubmit: false })`, requires a `TransactionToSignResponse`, rejects any `submitted` response, then validates the returned transaction (`to` equals the expected contract, `from` equals the connected account, `value` is zero, `data` is hex) before handing it to `eth_sendTransaction`. The wallet is used only for signing, submission and receipt polling, never as a second data source. The chain id of the wallet must match `NEXT_PUBLIC_CHAIN_ID`.

**6. Webhooks.** `POST /api/webhooks/multibaas` reads the raw body (hard cap 1 MiB of actual bytes), verifies `HMAC-SHA256(rawBody + X-MultiBaas-Timestamp)` against the hex `X-MultiBaas-Signature` with `timingSafeEqual`, rejects timestamps outside 5 minutes, validates the payload with Zod, accepts only `event.emitted` from the six configured contract addresses, and stores each delivery once using an exclusive hard link keyed by `sha256(delivery id)` (retry-safe dedup). `GET /api/activity` returns a revision hash; the browser polls it every 2 s and re-runs the event queries when it changes, with a 15 s full refresh as fallback. This is webhook-triggered polling, not push.

**7. Key separation.** The browser only ever gets `NEXT_PUBLIC_MULTIBAAS_DAPP_KEY`, a key in the DApp User group (reads, event queries, unsigned composition). The admin/server key `MULTIBAAS_API_KEY` is used only by `scripts/*` and `src/server/operator.ts`, which throws if loaded in a browser. `npm run multibaas:verify` proves the frontend key cannot call `AdminApi.listApiKeys` (expects 401/403) and fails otherwise.

**8. Readiness check.** `npm run multibaas:verify` (`scripts/verify-multibaas.ts`) checks chain id, that each address is linked with the right label (`AddressesApi.getAddress`), that indexing is enabled and caught up (`ContractsApi.getEventIndexingStatus`), an SDK read (`nextAssetId`), an unsigned composition of `registerAsset` (not submitted), a non-empty `AssetRegistered` query, the volume aggregation, and the admin-endpoint denial.

**9. Operator (optional Cloud Wallet + TXM).** `CloudWalletOperator` (`src/server/operator.ts`, CLI `npm run operator`) calls `callContractFunction` with `signAndSubmit: true, nonceManagement: true` from a MultiBaas Cloud Wallet, restricted to an allowlist (`verifyAsset`, `verifyRight`, `activateRight`, `closeRight`, `depositRevenue`, and MockJPY `approve` only to RevenueVault with a cap of 1e24), and reads status back through `TxmApi.listWalletTransactions`. `BrowserOperator` implements the same interface through the wallet path. Cloud Wallet requires an Azure-backed wallet configured in MultiBaas and has not been executed.

## Why Curvegrid

- **One backend for reads, history, aggregates and transaction composition.** An RWA dashboard lives or dies on lifecycle history (who verified, when it activated, what was actually paid). Event Queries with contract-address filters and `add` aggregation give that without running our own indexer or database.
- **Non-custodial by default.** `signAndSubmit: false` lets the backend build the transaction while the investor keeps the key. The same `callContractFunction` with `signAndSubmit: true` gives an operator path (Cloud Wallet + TXM) for the verifier and revenue operator roles that should not live in a browser.
- **RBAC fits RWA roles.** A DApp User key in the browser and an admin key on the server map cleanly to "public investors" vs "platform operator".
- **Signed webhooks** give an auditable trigger for dashboard refresh when revenue is deposited or a right is verified.

## (c) Team and social handles

```
TODO natsuki: team name / GitHub / X handles
Team name:
Members:
  - Name / role / GitHub @ / X @
Repository URL:
Live demo URL:
Demo video URL:
```

## (d) Setup and testing

Prerequisites: Node.js 22+, npm, Foundry 1.5.0 (`forge`, `anvil`), Git, Python 3 (for Forge MultiBaas linking). Internet access for OpenFreeMap tiles and WebGL for 3D; asset cards still work if tiles fail.

```sh
git submodule update --init --recursive
npm ci
cp .env.example .env.local
```

### Mode 1: demo (no keys, no chain)

Keep `NEXT_PUBLIC_APP_MODE=demo`.

```sh
npm run dev            # http://127.0.0.1:3000
```

Use the **Demo actor** selector (Owner A, Investor B, Investor C, Demo verifier). State is simulated in localStorage and the header shows **SIMULATED DEMO**. **Reset demo** clears it.

### Mode 2: local contracts on Anvil (no MultiBaas)

```sh
npm run anvil          # terminal 1
npm run deploy:local   # terminal 2: deploys 6 contracts, writes deployments/31337.json
npm run demo:seed      # 50 local txs with assertions, writes deployments/local-demo-receipts.json
```

`deploy:local` uses Anvil's unlocked dev account and `demo:seed` refuses to run unless chain id is 31337 and the registry is fresh. Never reuse Anvil accounts on a public network. The browser demo does not talk to Anvil.

### Mode 3: multibaas

1. Create a MultiBaas deployment on an EVM testnet. Create a **DApp User-only** key for the browser and a separate admin key for scripts. Add `http://127.0.0.1:3000` and your HTTPS origin to CORS.
2. In `.env.local` set `MULTIBAAS_URL`, `MULTIBAAS_API_KEY`, `NETWORK_RPC_URL`, `DEPLOYER_ADDRESS`, `ADMIN_ADDRESS`, `DEPLOYMENT_FILE=deployments/<chainId>.json`.
3. Deploy with a Foundry keystore:
   ```sh
   cd contracts && forge script script/Deploy.s.sol:Deploy --rpc-url "$NETWORK_RPC_URL" --account <keystore> --sender "$DEPLOYER_ADDRESS" --broadcast && cd ..
   ```
4. Link and export public addresses:
   ```sh
   npm run multibaas:link
   npx tsx scripts/write-public-env.ts deployments/<chainId>.json   # writes deployments/frontend-addresses.env
   ```
5. Copy the `NEXT_PUBLIC_*_ADDRESS` lines into `.env.local`, set `NEXT_PUBLIC_APP_MODE=multibaas`, `NEXT_PUBLIC_MULTIBAAS_URL`, `NEXT_PUBLIC_MULTIBAAS_DAPP_KEY`, `NEXT_PUBLIC_CHAIN_ID`. Restart `npm run dev`.
6. Grant `VERIFIER_ROLE` to your demo verifier, register one asset from the UI, then run `npm run multibaas:verify`.
7. Webhooks: subscribe `event.emitted` to `https://<origin>/api/webhooks/multibaas`, set `MULTIBAAS_WEBHOOK_SECRET` (server only) and a persistent `WEBHOOK_DATA_DIR`. Designed for a single Node server, not serverless.
8. Optional operator (Cloud Wallet configured in MultiBaas, `MULTIBAAS_OPERATOR_ADDRESS` set):
   ```sh
   npm run operator -- registry verifyAsset 1 true
   npm run operator -- rights activateRight 1
   npm run operator -- status <txHash>
   ```

### Tests

| Command | What it runs |
| --- | --- |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run test` | Vitest, 33 tests: projection, lifecycle, SDK adapter with controlled responses, tx validation, webhook HMAC/replay/dedup, webhook route to activity revision |
| `npm run test:contracts` | Foundry, 25 tests: authorization, lifecycle, atomic trades, revenue accounting, fuzzed rounding, conflicts, baskets, expiry |
| `npm run test:e2e` | Playwright, 4 tests on demo mode (starts `npm run dev` itself): buy, activate, deposit, claim, resale, basket mint/redeem; register, verify and reject a conflicting right; mobile layout; 3D map filters and X-ray |
| `npm run demo:seed` | Real-contract flow on Anvil (after `anvil` + `deploy:local`) |
| `npm run multibaas:verify` | Live MultiBaas readiness (Mode 3 only) |

CI (`.github/workflows/ci.yml`) runs typecheck, Vitest with coverage, Foundry, build and Playwright.

## (e) Experience with MultiBaas

> **Draft, natsuki to confirm from real experience.** The points below are derived from what the code had to do. Replace or delete anything not observed on a live deployment.

**Wins**

- The generated TypeScript SDK gives typed request/response models; `callContractFunction` covers reads, unsigned composition and Cloud Wallet submission with one call shape, switched by `signAndSubmit`.
- Event Query filters plus `add` aggregation replaced an indexer and a database for a full market dashboard (listings, holdings history, revenue totals).
- `forge-multibaas` let us link all six contracts and set the sync start block from the same Foundry script flow we deploy with.
- `getEventIndexingStatus` made a scripted "is the index caught up" check possible before the demo.

**Challenges**

- **No log index in Event Query results.** We can order by block but not by position inside a block. Two lifecycle events for one asset in the same block (for example reject then revise) are ambiguous, so `loadMarket()` detects same-block ties and resolves the asset status with an SDK `getAsset` read. Right status is projected order-independently (Closed beats Active beats Verified) for the same reason.
- **Pagination.** `executeArbitraryEventQuery(query, offset, limit)` needs a manual offset loop; we page 500 rows and throw above 100,000 rather than render a silently truncated market.
- **Union result types.** `callContractFunction` returns either `MethodCallResponse` or `TransactionToSignResponse`; we had to discriminate on `result.kind` and cast.
- **Webhook signature format.** The signature is HMAC-SHA256 over the raw body followed by the timestamp header value, so the route must read raw bytes before any JSON parsing. Deduplication by delivery id and a persistent store are left to the app.
- **Example drift.** Some older frontend examples pass a chain argument that SDK 1.1.1 methods no longer accept; operator and aggregator names (`equal`, `add`) had to be checked against official samples.
- **Deploy vs link.** Forge runs FFI during simulation, so linking had to be a separate post-broadcast script to avoid registering contracts from a dry run.

**Suggestions**

- Expose a log index (or a per-transaction ordinal) as an Event Query field.
- A typed end-to-end example combining pagination, ordering and aggregation.
- A webhook reference receiver with raw-body verification, dedup and retries.

**Not evaluated yet:** hosted latency, index backfill time, Cloud Wallet signing and TXM behavior. `TODO natsuki: add observations from the live run.`

## Disclaimers

The app shows: **"Test assets only. Verification is simulated. Map data does not prove ownership. Mock JPY has no monetary value."** The vacant-home demo site states: **"No residential or property ownership is sold."**

- All demo sites, including Opportunity Lens sites, are fictional positions on a real basemap. They do not assert that any real property is vacant, available or owned by anyone.
- `VERIFIER_ROLE` stands in for evidence review; no real ownership or authority is checked.
- MockJPY is a valueless test token. No yield is promised; revenue is only what is actually deposited.
- This is not a securities offering. Legal structuring, KYC, tax and enforceable real-world agreements are not implemented.
- The map uses MapLibre with OpenFreeMap/OpenStreetMap tiles. No 3D city model dataset is integrated.
- No external security audit has been performed.

## Project documents

- [Implementation report](docs/IMPLEMENTATION_REPORT.md): what was built, what was executed locally, what remains unverified.
- [ENSv2 spatial namespace design](docs/ENSV2_DESIGN.md): proposed, not implemented, no ENS prize claimed.
- [Showcase copy](docs/showcase.md), [Q&A cheat sheet](docs/qa-cheatsheet.md), [pitch deck](docs/pitch/index.html).

## References

- MultiBaas docs: <https://docs.curvegrid.com/multibaas/>
- MultiBaas TypeScript SDK: <https://github.com/curvegrid/multibaas-sdk-typescript>
- Forge MultiBaas: <https://github.com/curvegrid/forge-multibaas>
- MapLibre GL JS: <https://maplibre.org/>, OpenFreeMap: <https://openfreemap.org/>
