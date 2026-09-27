# Tokenize Tokyo — adversarial QA (2026-09-27)

## Scope and method

Tested the app with invalid and extreme inputs, rapid repeated purchases, role changes, modal dismissal, damaged browser storage, failed and stalled network responses, invalid links, and desktop/mobile navigation. Regression coverage includes tokenization, verification, primary/secondary purchases, revenue claims, baskets, fractional markets/rentals, dashboards, maps, city previews, ENS, and presentation flows.

Tests ran against isolated source snapshots and production builds to avoid interference from the active development server. The final snapshot's `src/` files were compared with the working tree. Browser tests use fresh profiles and simulated balances or intercepted API responses; they do not spend real funds. Public Privy checks open and cancel login dialogs without submitting credentials or signing transactions.

## Reproduced defects and fixes

| Reproduction | Previous behavior | Fix |
| --- | --- | --- |
| Continue with a blank, zero or negative area | Advanced to rights configuration | Shared validation at both the form step and submission boundary |
| Review a supply above 1,000,000,000,000 | Accepted a supply the contract cannot issue | Check contract bounds, exact prices, dates and encoded terms before review/submission |
| Put malformed nested entries in saved fractional/rental market data | Client-side exception made the market unusable | Validate nested data and references; preserve invalid source data in a recovery key |
| Damage the saved demo event list | Repeated connection-error state for a local-data problem | Validate external storage changes, retain a recovery copy and restore the sample dataset |
| Leave a checkout status request pending | Loading could remain indefinitely | Bound checkout attempts to 20 seconds and permit retry; preserve the creation idempotency key |
| Return an unknown checkout state | Receipt rendering crashed | Validate order identity and response shape; require a transaction hash in a fulfilled response |
| Navigate back to Explore at 320px | Logo pushed the role selector and Tokenize button offscreen | Apply responsive logo dimensions to SVGs as well as images |

Storage validation reuses the last validated serialized snapshot so unchanged local data does not trigger a second full market projection on every read. Loads still create independent objects, and changed storage is revalidated.

## Verification results

Completed at approximately 07:36 JST. Source baseline: `1edf558` plus the QA fixes in this change.

| Check | Result | Local evidence |
| --- | --- | --- |
| Production build and TypeScript | Passed | `verified-build.log` |
| Vitest | **199 passed, 2 skipped** | `verified-unit-final.log` |
| Foundry contracts | **74 passed** across 7 suites | `contracts.log` |
| Full production browser regression | 69 passed; one 320px defect subsequently fixed; 9 opt-in cases skipped | `e2e-final.json` |
| Final affected browser flows | **18 passed**, including all 10 new adversarial cases and the 320px fix | `e2e-verified.json` |
| Guest access and wallet account switching with fixtures | **3 passed** | `account-qa.json` |
| Public-site Privy desktop/mobile and cancellation checks | **4 passed** | `privy-public.json` |
| Public-site market/ENS loading, RPC failure and background refresh | **3 passed** | `loading-public.json` |
| Whitespace/conflict check | `git diff --check` passed | Working tree |

Across these runs, 80 distinct browser scenarios passed: 70 local app scenarios, 3 account-fixture scenarios and 7 public-site scenarios. This is a combined count, not a single 80-case run. The final 320px capture has `document.scrollWidth === 320`, and the Tokenize button ends at x=308; see `mobile-320-verified.png`.

Configured coverage: statements 97.04%, branches 91.61%, functions 95.12%, lines 98.38%. An earlier coverage run hit the existing 15-second history-scenario timeout under concurrent build/browser load. The final run passed without increasing that timeout.

Evidence is saved locally under `.data/adversarial-qa/`, including JSON test results, failure screenshots, build output and dependency audit output. Early development-server navigation timeouts are recorded separately from reproducible product failures; they are not counted as successful tests.

## Limits and follow-up

- No real-money payments, real OAuth login or live wallet signing were performed in this QA run. Contract behavior was exercised in Foundry, and card orchestration through mocked services and browser responses.
- Two database integration cases require `CARD_TEST_DATABASE_URL`; these remain explicitly skipped when a dedicated test database is unavailable.
- Of the nine opt-in browser cases skipped in the local regression, seven were separately exercised on the public site. Live wallet signing and the older Curvegrid-specific mobile tour scenario remain unexecuted.
- `npm audit --omit=dev` reported 23 moderate findings, zero high and zero critical findings. Dependencies were not upgraded during submission QA; a separate dependency update and regression run is still needed.
- Coverage percentages apply to the files listed in `vitest.config.ts`, not to the entire application. This QA is not a security audit or a guarantee that every defect has been found.

## Deployment

Released on **2026-09-27 at approximately 09:18 JST**, following the user's production release request.

- Source commit: [`3f8415178a84e44f2fefbc389601504618ee7ab6`](https://github.com/natsukingly/tokenize-tokyo/commit/3f8415178a84e44f2fefbc389601504618ee7ab6), pushed to `main`.
- Vercel production deployment: `dpl_MacG8GR1WUMHwNbHk51my9i8jzXo`, confirmed **Ready**.
- Public alias: [tokenize-tokyo.vercel.app](https://tokenize-tokyo.vercel.app/).
- Deployed from an isolated archive of the committed code. Every `src/` file matched the tested source manifest; existing Vercel production environment settings were used.
- Post-release public-site verification: **19 passed, 0 failed, 0 skipped**, covering all ten adversarial cases, four Privy cases, three loading/error cases and two ENS showcase cases. These repeat previously tested scenarios and are not added to the distinct-scenario total above.
- `/`, `/demo`, `/ens`, `/cities` and `/present` returned HTTP 200. The card checkout availability endpoint returned HTTP 200 with `available: true`.
- Local release evidence: `.data/release-3f84151/public-smoke.json` and `public-smoke.log`. No new payments or on-chain transactions were submitted.
