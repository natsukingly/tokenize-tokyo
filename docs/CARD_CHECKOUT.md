# Stripe test checkout → operator Cloud Wallet → buyer

The rights and basket purchase panels now offer Wallet / Card. Card purchases show the test JPY total, receiving address and operator-paid gas before redirecting to Stripe Checkout. The receiving wallet can be a Privy embedded wallet or an external wallet; no purchase signature or gas is required from the buyer.

## Verified on 2026-09-27 (JST)

The integration is published at **https://tokenize-tokyo.vercel.app** with a dedicated Neon **Free** PostgreSQL database in Singapore and a hosted Stripe test webhook. The database uses a pooled connection with TLS certificate verification enforced by the server.

A second ¥2,400 Stripe test purchase on the public deployment succeeded. The hosted webhook submitted the purchase from the registered operator Cloud Wallet; the controlled demo recipient's balance increased **3 → 4**. Replaying the event and reconciling the order did not repeat delivery. Unsigned webhooks returned 400, and order reads without the browser capability cookie returned 404.

- [Hosted purchase transaction](https://sepolia.etherscan.io/tx/0x8e5d49e8f3e84ccd479e039dbd2501fb1592c38455e6d12d1e930a1322dfffbc)
- [Hosted verification record](../deployments/card-checkout-hosted-verification.json)
- [Hosting configuration record](../deployments/card-checkout-hosted.json)

The hosted smoke test created its order through the public API, completed Stripe Checkout in Chrome using synthetic card details, and checked the receipt in an isolated browser carrying that order's capability cookie. Both 390px and 1512px receipt layouts displayed confirmed delivery with the actual transaction link. Seven browser regression tests also passed against the deployed application (mocked receipt states and demo purchase panels); those tests are separate from the live payment verification.

### Earlier local integration verification

A real Stripe **test** Checkout for ¥2,400 completed in the browser. The official Stripe CLI delivered the signed completion event to the local application. The registered Sepolia Cloud Wallet submitted the purchase and delivered one right to the existing controlled demo buyer: balance **2 → 3**. The application confirmed the on-chain commitment after two confirmations. Replaying the same test event (re-signed with the local listener secret) and invoking reconciliation again did not repeat the delivery.

- [Sepolia transaction](https://sepolia.etherscan.io/tx/0x9433b707f9596954f018b11cb8076bed4dedb511b3a641a311ce686498d53813)
- [Public verification record](../deployments/card-checkout-test-verification.json)
- [Executor deployment](../deployments/card-checkout-11155111.json)
- Local test application: `http://127.0.0.1:3012`; the receipt is `/checkout/9bb609d7-a630-417e-8c68-487c8952ab12` in the browser used for Checkout.

The Stripe account used is the existing BonusQuest test environment, so hosted Checkout displays that account name. No real charge was made. Public operation uses Vercel environment variables, Neon and the dedicated hosted webhook; it does not depend on the local database or Stripe CLI listener. The local listener was stopped before the hosted test.

Validation: production build and TypeScript passed; 163 unit tests passed (one worker with a 15-second timeout for existing CPU-heavy fixtures); two additional PostgreSQL concurrency tests passed on an isolated local cluster; six contract tests and seven browser tests passed.

Only the existing marketplace's direct rights/basket listings are supported. FractionVault trades and rentals are separate flows. New environments keep card checkout disabled until the configuration below is complete. There is no simulated-success fallback for missing credentials.

## Payment and delivery

1. The server reads the listing, payment-token decimals, treasury balance (through simulation), chain/deployment and Cloud Wallet registration. It simulates the exact delivery before creating Checkout.
2. The server stores a quote in PostgreSQL and creates a card-only Stripe test Checkout Session. For these tests only, 1 MockJPY = 1 simulated JPY, with whole-yen totals of ¥50–¥100,000. This is not a conversion, redemption or fiat settlement facility.
3. A signed Stripe webhook retrieves the session again and checks the order reference, commitment, mode, paid status, currency and exact amount.
4. A durable atomic database claim permits one signing attempt. MultiBaas submits `CardPurchaseExecutor.fulfill` from `MULTIBAAS_OPERATOR_ADDRESS` with nonce management.
5. The prefunded executor approves exactly the order amount, purchases from the existing marketplace and transfers the rights/basket shares to the buyer in one transaction. A failed delivery reverts payment and purchase together. A used order ID cannot execute again.
6. The receipt page checks the on-chain delivery commitment after two confirmations. A success URL alone never means success. The buyer can explicitly recheck Stripe if the webhook is delayed, using the same claim and verification path.

The marketplace's original `ListingPurchased.buyer` is the executor, since it calls `purchase`. Ownership is the recipient, recorded by the ERC1155 transfer and `CardPurchaseFulfilled` event. Existing buyer-count analytics may count the executor as one wallet; they are not a count of card customers.

## Configuration

Use a Stripe test environment. Keep `STRIPE_SECRET_KEY=sk_test_...` and `STRIPE_WEBHOOK_SECRET=whsec_...` server-only. No Stripe publishable key is needed for hosted Checkout. A local `.env.stripe-card` can hold the test key privately; Next.js does not load that file automatically. Copy the settings into the active uncommitted `.env.local` only when the rest of this environment is ready, or set them on the hosting platform.

Required settings (also listed in `.env.example`):

```dotenv
NEXT_PUBLIC_APP_MODE=multibaas
# Matching testnet chain and existing protocol addresses, as already configured
STRIPE_CARD_CHECKOUT_ENABLED=true
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
CARD_CHECKOUT_DATABASE_URL=postgres://...
CARD_CHECKOUT_EXECUTOR_ADDRESS=0x...
MULTIBAAS_OPERATOR_ADDRESS=0x...
MULTIBAAS_URL=https://your-deployment.multibaas.com
MULTIBAAS_API_KEY=your-private-server-key
NETWORK_RPC_URL=https://your-chain-rpc
APP_ORIGIN=http://127.0.0.1:3000
```

Set `APP_ORIGIN` to the exact HTTPS site origin for hosting. Do not share a mainnet environment: live Stripe keys and non-test chains are rejected. The public DApp key cannot be reused as the signing key. Keep the operator dedicated to this application.

Provision a durable PostgreSQL database and apply `db/card-checkout.sql` with your database client. Local files and in-memory locks are not used for payment records, including on Vercel. Use authenticated TLS connections on hosted databases. Retain order rows for reconciliation; old `card_checkout_limits` minute buckets can be pruned periodically.

Complete [Cloud Wallet setup](WALLET_SETUP.md), fund the operator with test ETH, then deploy the additive `contracts/script/DeployCardCheckout.s.sol` with the existing deployment manifest and the registered operator address. It does not replace core contracts or require admin/verifier roles. Use the existing Foundry account workflow; do not put private keys into command history. The constructor accepts only local Anvil, Sepolia or Curvegrid Testnet.

Alternatively, `npx tsx scripts/setup-card-checkout.ts --env .env.sepolia` inspects the deployment. Adding `--apply` deploys/reuses the executor, links it in MultiBaas, funds the operator with at most 0.002 test ETH if needed and mints 10,000 MockJPY to an empty executor. It uses the private environment's existing deployer and journals transaction hashes; gas price is capped at 3 gwei. Compile the artifact for the target chain first (Cancun for Sepolia; the existing `curvegrid` Foundry profile for Curvegrid). Inspect any pending journaled transaction before restarting after an error.

Publish the artifact `contracts/out/CardPurchaseExecutor.sol/CardPurchaseExecutor.json` in MultiBaas as `cardpurchaseexecutor`, link the deployed executor at its actual starting block, and set `CARD_CHECKOUT_EXECUTOR_ADDRESS`. Fund the executor with the project's MockJPY, which it uses for seller settlement. The operator pays gas. The current executor deliberately has no generic call, administrator grant or withdrawal entrypoint; fund it only with the test budget required. It is testnet-only and should never receive real assets.

Ensure the private MultiBaas API key can inspect Cloud Wallet registration/chain status and sign the executor call. UI preflight fails closed if the signer, chain, deployment, available listing or delivery simulation does not match.

## Test with Stripe

Register `/api/webhooks/stripe` for `checkout.session.completed`, `checkout.session.async_payment_succeeded` and `checkout.session.expired`. For local development, run the official Stripe CLI:

```sh
stripe listen --events checkout.session.completed,checkout.session.async_payment_succeeded,checkout.session.expired --forward-to http://127.0.0.1:3000/api/webhooks/stripe
```

Use that listener's signing secret locally; hosted endpoints have their own secrets. Restart the app after changing environment variables.

Choose an existing rights/basket listing, select quantity, accept terms, select **Card · TEST**, review the recipient and continue to Stripe. Use test card **4242 4242 4242 4242**, any future expiry and any three-digit CVC. Only use invented test details. Returning from Stripe displays payment/submission/delivery separately, with a transaction link. Cancelled open checkouts can be resumed from that receipt page without creating another order.

Verify the recipient's balance and seller's MockJPY balance. Replay the same webhook and confirm balances do not change again. A card decline must not submit a transaction. A sold-out listing or recipient rejection must enter review, not show successful delivery.

## Failure handling and operating limits

There is no on-chain inventory reservation during Checkout. Another buyer can take the listing after preflight. Unavailable inventory, a signer failure, a reverted transaction, and uncertain submission outcomes require operator review. The page explicitly tells the buyer not to pay again.

A signing timeout is ambiguous: the transaction may already exist. Never automatically release the claim, resubmit, or refund. Inspect MultiBaas TXM and the executor's `fulfilled(orderKey)` commitment first; the receipt page can recover confirmed delivery even when the signing response was lost. For a definitively failed order, handle the test refund in Stripe and record the resolution operationally. Automated refunds, background reconciliation, order support tooling and production fiat settlement are outside this test integration.

The browser's HTTP-only random capability cookie authorizes its order status; an order ID alone does not. Keep the same browser after Checkout. Clearing cookies loses self-service receipt access; the operator can use the order reference for reconciliation. A new account/session authentication model can replace this when a production order history is introduced.

API create/status routes enforce the configured origin for mutations, bounded bodies, durable request limits and strict request schemas. The signer receives only the server's stored listing/quantity/recipient/amount. Webhooks verify the raw-body Stripe signature and reject live events.

## Verification

Run `npm test`, `npm run typecheck`, `npm run build`, `forge test --root contracts --match-contract CardPurchaseTest` and `npx playwright test tests/card-checkout.spec.ts tests/basket-consent.spec.ts` against the local demo server. `src/server/card-service.test.ts` uses mocked Stripe/MultiBaas boundaries and does not claim a live payment or Cloud Wallet broadcast.

The separate live verification above used the actual Stripe test service, Azure-backed Cloud Wallet and Sepolia contracts. To restart the local app, use `node --env-file=.env.card-checkout node_modules/next/dist/bin/next dev --hostname 127.0.0.1 --port 3012`. Restart the isolated local PostgreSQL cluster at `.data/card-checkout/pg` on port 55439 if needed. The Stripe CLI listener must also run; restarting it may require updating its signing secret in `.env.card-checkout`. These private environment files are gitignored.

References: [Stripe Checkout](https://docs.stripe.com/payments/checkout), [fulfillment](https://docs.stripe.com/checkout/fulfillment), [webhook verification](https://docs.stripe.com/webhooks), [test cards](https://docs.stripe.com/testing), [Curvegrid Cloud Wallets](https://docs.curvegrid.com/multibaas/cloud-wallets/).
