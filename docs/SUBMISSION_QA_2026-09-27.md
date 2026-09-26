# Submission QA — 2026-09-27 JST

## Scope and result

The production build, TypeScript, unit/database tests, contract tests, demo lifecycle, isolated account tests and local-chain finance scenario passed. Public Sepolia checks below were read-only. No seeding was resumed and no new public-chain transactions were sent during this QA run.

The application under test was the pushed source at `2f70787ba777cf52e433b8faaa221cc0050c3d3c`, built in an isolated checkout. Test-harness corrections for clustered map pins and the centered tour welcome modal are recorded in `044bc4a`; it does not certify other sessions' uncommitted changes.

The hosted checks used `https://tokenize-tokyo.vercel.app` (Vercel deployment observed: `dpl_8bH6SsgHWToQC7rxQzJieNYA9LA4`). They verify the public deployment at the time of the run, not a guarantee that a later deployment is identical.

| Check | Result | Scope |
| --- | --- | --- |
| Production build | Passed | `npm run build` |
| TypeScript | Passed | `npm run typecheck` |
| Unit tests with coverage | 190 passed; 2 opt-in DB tests skipped here | Projection, analytics, wallet/call validation, payment service and other unit behavior |
| PostgreSQL integration | 2 passed separately | Fresh disposable PostgreSQL 14 cluster; concurrent fulfillment claim, immutable quote, durable hash and shared rate limits |
| Foundry contracts | 74 passed, 0 failed, 0 skipped | Core protocol, spatial rules, edge cases, ENS permissions, fractions, rentals and card executor |
| Demo browser suite | **58 passed, 9 opt-in skipped, 0 failed, 0 flaky** (3.6 minutes) | Production demo build, full Chromium, one worker |
| Account browser suite | 3 passed | Isolated MultiBaas-format fixture; no real signing |
| Local-chain finance browser scenario | 1 passed; 18 Anvil transactions | Fractions, trading, income, redemption, rental, rejection of active withdrawal, return, recovery, indexed activity and mobile layout |
| Hosted browser checks | 9 passed | ENS demo, load/error states, Privy entry and cancellation; some failure states are intentionally intercepted |
| Hosted transaction explorer | Passed | Existing Sepolia fulfillment decoded correctly; desktop and 390px mobile |

The nine default browser skips consist of seven hosted-only loading/login checks (run separately and passed below), the historical live-tour case and the opt-in wallet transaction case. The two ENS showcase checks also run in the default suite, so the hosted count is not entirely additive.

The unit/database total is **192 passing tests**. Coverage was **97.04% statements, 91.61% branches, 95.12% functions and 98.38% lines** for the configured target files in [vitest.config.ts](../vitest.config.ts). These percentages do not describe every source file in the application. No lint script is configured. Whitespace and changed-file secret-pattern checks passed; the latter is not a security audit.

## End-to-end behaviors exercised

- Buy rights → activate the project → deposit revenue → claim income → secondary trade → deposit underlying rights into a basket → redeem basket shares.
- Register an asset → request verification → separate asset/right approvals → reject a conflicting exclusive scope.
- Walk through buyer and issuer Quick tours, including Funding, and restart/dismiss the centered welcome dialog on desktop and mobile.
- Filter the map without choosing an arbitrary asset, reset filters, expand clustered spaces, inspect featured projects, open directory details, and inspect the ENS hierarchy.
- Keep consent specific to the account/listing, validate quantities, paginate activity, distinguish deposited money from financial assumptions, and display loading/error states.
- Create and trade custody-backed fractions; claim deposited revenue and redeem whole underlying units. Prepay a rental, return early and recover the original right. These transactions ran on **isolated Anvil**, with a **MultiBaas wire-format fixture**, not the public MultiBaas service.

## Public checks and evidence

The hosted suite checked the ENS permissions page at desktop/mobile sizes, initial loading, failed refresh, background refresh, RPC failures, email/Google and MetaMask login choices, and preservation of a tokenization draft or asset detail when login is cancelled.

The existing [Sepolia checkout transaction](https://tokenize-tokyo.vercel.app/tx/0x8e5d49e8f3e84ccd479e039dbd2501fb1592c38455e6d12d1e930a1322dfffbc) showed **Confirmed**, decoded `fulfill`, and an expandable `CardPurchaseFulfilled` event. At 390px it had no horizontal overflow; no browser page errors were recorded. This check inspected a previous transaction; it did not make another payment.

The live market probe read **180 assets**, **27 assets with deposited income**, **53,500 mJPY deposited** and **5,256,500 mJPY traded** at its timestamp. Those are seeded testnet data, not customer adoption or real yield. Login entry and market data both loaded successfully; these single-run observations are not a performance benchmark.

The earlier [hosted Stripe test verification](../deployments/card-checkout-hosted-verification.json) separately records a completed test payment, actual Cloud Wallet submission and recipient balance increase, plus replay protection. It was reviewed, not repeated in this read-only run.

## Test-harness corrections

Initial attempts exposed stale test assumptions: a named map pin can now be clustered; the welcome dialog makes outside controls inert; MapLibre may keep projected markers mounted outside the clipped map. Tests now wait for the correct UI and click a visible featured or hit-testable marker using normal pointer actions. They do not force-click an obscured element.

The default headless-shell also stalled several WebGL-heavy interactions in this environment. The browser configurations now use full Chromium's headless mode (`channel: "chromium"`). The affected tests passed after these changes. No application behavior was changed by this QA patch.

## Reproduce

Use the [README setup instructions](../README.md#how-to-run), initialize submodules, and install the full Playwright Chromium browser:

```bash
npm run build
npm run typecheck
npm run test:coverage -- --maxWorkers=2
npm run test:contracts
npx playwright install chromium
npm run start -- --port 3234
```

In another terminal, against that production demo build:

```bash
PLAYWRIGHT_BASE_URL=http://127.0.0.1:3234 npm run test:e2e -- --workers=1
npm run test:accounts
npm run test:finance
```

The account and finance scripts manage their isolated app/chain fixtures. Finance requires Foundry. To exercise the two database tests, create a **disposable PostgreSQL test database** and use its URL; do not point this test at the hosted checkout database:

```bash
CARD_TEST_DATABASE_URL=postgres://localhost/tokenize_qa npm test -- src/server/card-store.test.ts
```

Read-only hosted checks:

```bash
PRIVY_SMOKE=1 TOKENIZE_LIVE_E2E=1 \
PLAYWRIGHT_BASE_URL=https://tokenize-tokyo.vercel.app \
npx playwright test tests/privy-access.spec.ts tests/loading-overlay.spec.ts tests/ens-showcase.spec.ts --workers=1
```

## Not established by this run

- Completing email OTP/Google authentication, creating a real embedded wallet and signing as the account owner.
- Manual MetaMask extension confirmations or a fresh wallet-signed Sepolia purchase/ENS permission change. The opt-in live wallet and historical live-tour test were not run.
- Public FractionVault/RentalEscrow deployment and live MultiBaas linking.
- Production payment, fiat redemption, automated refunds, legal ownership verification or compliance approval.
- A passing remote GitHub Actions run for subsequent commits. The results above are local/hosted QA evidence with explicit scope.

The recorded demo video URL and account-owner signing rehearsal remain submission follow-ups. See [README release boundaries](../README.md#what-judges-can-verify-now) and the [trust model](TRUST_MODEL.md).
