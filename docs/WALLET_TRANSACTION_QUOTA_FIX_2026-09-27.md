# Wallet transaction preparation after the MultiBaas quota limit

The first quota fix restored portfolio reads. Sepolia wallet actions such as `MockJPY.approve` and `UrbanAssetRegistry.registerAsset` still called the exhausted MultiBaas contract-method endpoint to prepare unsigned transactions, so those operations continued to fail with HTTP 429.

## Implementation

- [core-transactions.ts](../src/lib/core-transactions.ts) explicitly encodes the core application actions from their Solidity ABIs. It excludes protocol administration and arbitrary token transfers.
- [sepolia-rpc.ts](../src/lib/sepolia-rpc.ts) shares a configured, chain-verified Sepolia client between reads and transaction preflight.
- [wallet-rpc.ts](../src/lib/wallet-rpc.ts) checks target bytecode, simulates with `eth_call`, rechecks wallet account/network, requests one wallet submission and follows the original hash through the configured RPC. Simulation does not authorize or broadcast anything; the wallet and contract remain responsible for authorization.
- A rejection, revert or receipt failure never falls back to another submission. A submitted transaction whose receipt cannot be obtained stays **pending**, with its hash retained.
- [multibaas.ts](../src/lib/multibaas.ts) routes Sepolia core actions and already encoded ENS/finance intents to this path. Curvegrid Testnet retains SDK composition/receipts; server-side Cloud Wallet fulfillment is unchanged.
- MultiBaas still supplies event queries and aggregates. This change does not replenish its quota or remove dependencies from Cloud Wallet, the decoded explorer or finance-extension reads.

## Validation

- Unit suite: **221 passed**, two database-dependent tests skipped. New coverage includes exact approval amounts, target/calldata, permissions, account/network changes, no bytecode, wallet rejection, receipt failures, mined reverts and no duplicate submission.
- TypeScript and production webpack build passed; existing optional dependency warnings remain.
- `npm run test:wallet-rpc`: on isolated Anvil, compared **23 function selectors** with Foundry's compiled artifacts and successfully executed **22 transactions**. Flows include asset registration/verification, scoped and basic right issuance, activation, listing, approval/purchase, revenue deposit/claim and basket deposit/redemption. An unauthorized operation failed before wallet submission. MultiBaas composition/receipt calls: **0**.
- Browser preparation check against live Sepolia data: portfolio loaded, `registerAsset` and `approve` both reached the injected wallet with **0 MultiBaas contract-method calls**. The test wallet rejected both requests; no public transaction was signed or broadcast. `MARKET_RATE_LIMIT_QA=1 MARKET_WRITE_QA=1` enables this check in [market-rate-limit.spec.ts](../tests/market-rate-limit.spec.ts).

## Separate local HTTP 400 report

The reported `ic2i3…multibaas.com` endpoint is the local Curvegrid Testnet deployment (chain **2017072401**), while production uses Sepolia (**11155111**) through `kxe47…multibaas.com`. Matching numeric contract addresses on these two chains do not imply shared balances.

A read-only unsigned approval probe with a public test account returned HTTP 400 **`insufficient funds for transfer`** on the local deployment. This reproduces a gas-shortage case; it does not inspect the user's connected account or establish the response body of every HTTP 400. The local `/api/test-gas` challenge returned 200. Users with no native Testnet ETH can open the account panel, choose **Get test ETH** and sign the challenge. No gas claim was submitted by this verification. MockJPY cannot pay native gas fees.

`walletError` now gives that instruction when the provider's actual error reports insufficient funds, instead of only showing the HTTP 400 message.

All changes are on `fix/multibaas-read-rate-limit`. No commit or merge to `main` is required for the production release.
