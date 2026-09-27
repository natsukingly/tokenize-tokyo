# MultiBaas plan quota and portfolio read recovery

Observed on 2026-09-27 JST, using read-only checks against the hosted Sepolia deployment.

## Cause

The provider's `GET /plan` reported `api_calls_per_month` at **30,000 / 30,000**. Per-second and per-day API limits were unset. Contract reads returned HTTP 429 with `request exceeds the plan’s rate limit`. Neither that response nor the plan exposed a reset timestamp. Changing frontend settings or waiting a few seconds does not replenish this quota.

Indexed event queries still succeeded during this incident. An actual connected-account `loadMarket` failed at the settlement token's `balanceOf`. This case was missed by the previous guest/demo and fixture-based release checks.

## Change

- On Sepolia, [core-reads.ts](../src/lib/core-reads.ts) batches an explicit list of view functions through the configured RPC and verifies its chain ID. Big integers remain decimal strings; a failed subcall rejects the batch instead of inventing a zero balance.
- [multibaas.ts](../src/lib/multibaas.ts) batches token balances and all claimable revenue, including claims belonging to former holders with zero current balance. Event indexing, aggregate queries, unsigned transaction composition and receipt monitoring retain MultiBaas.
- Verifier permissions are read from `UrbanAssetRegistry`. `UrbanRightToken` delegates permission checks to that registry and does not expose its own `hasRole` method.
- Background market refresh changes from 15 seconds to 60 seconds and skips hidden pages and in-flight refreshes.
- Transient reads have bounded retries. A provider plan-limit response fails immediately and explains the usage limit. Transaction composition/submission is never retried by this helper.

## Validation before deployment

- Unit suite: **210 passed, 2 database-dependent tests skipped**. New tests cover a 100-right portfolio with SDK contract reads forced to 429, exact integer normalization, zero-balance revenue claims, wrong RPC chains, rejected writes, failed subcalls and bounded retries.
- TypeScript and the production webpack build passed. Existing optional Privy/Farcaster and viem/Tempo build warnings remain.
- Account fixture browser suite: **3 passed**, using webpack because this isolated worktree shares dependencies through a symlink that Turbopack rejects.
- Live Sepolia account plus loading browser checks: **4 passed**. The injected public-address wallet cannot sign or submit. Contract-method endpoints were forced to return 429; the portfolio loaded without calling them. Temporary local QA ports are outside the provider's CORS allowlist, so only local event-query responses were forwarded unchanged by Playwright. The public-origin run must be direct.
- Independent real-data read: **180 assets, 100 rights, 101 balances and 101 claim amounts**, plus registry permission, completed in approximately **2.3 seconds** with **zero MultiBaas SDK contract reads**.

## Remaining provider dependency

This restores the core portfolio read path while event queries remain available. It does not restore exhausted MultiBaas quota or guarantee that provider-dependent transactions, Cloud Wallet fulfillment, finance extensions or receipt endpoints are available. Those still require a provider quota increase or the next quota window. Exact reset time and paid upgrade terms need confirmation from Curvegrid.

Changes are maintained on `fix/multibaas-read-rate-limit`; deployment is from this branch without a commit or merge to `main`.

## Production release and direct-origin verification

- Application commit: `2d92e3ea3ecdbf7fe47153f54c5f3d4630fc1905`.
- Vercel deployment: `dpl_A476u1Ss7jcmV3ZiBxJsP71M9qXi`, confirmed `READY` and aliased to [the public application](https://tokenize-tokyo.vercel.app/).
- Public checks: **8 passed** — three loading/error cases, four Privy entry/cancellation cases, and one connected portfolio check. The connected test uses the actual Privy external-wallet selector with an injected read-only provider; it does not authenticate, create a wallet or sign anything.
- On the public origin, event queries went directly to MultiBaas without the local CORS forwarding. The connected public test account displayed **27 holdings**, with **2 RPC read requests**, **0 failed RPC HTTP responses**, and **0 MultiBaas contract-method requests** despite those methods being forced to 429 in the test.
- The test fixture was extended to support MetaMask's account-access permission request and the Privy dialog flow. All signing/submission methods remain rejected. Production application code was unchanged by that test-only adjustment.
- `main` and `origin/main` remained at `16700e338ba30aaaa75d8ea1f2b7bd8666729dc0`.
