# Privy, MetaMask and Curvegrid Cloud Wallet setup

## Current status

- The app includes optional Privy email/Google login and a separate MetaMask connection choice. `NEXT_PUBLIC_PRIVY_APP_ID` activates it; without that setting, existing injected wallets continue to work.
- WalletConnect is optional and only appears when `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` is set. A Reown account is not required for the default Privy + MetaMask setup.
- A Privy development app named TOKENIZE TOKYO has been created and its public App ID was confirmed in the dashboard. Local App ID activation, login-method configuration and live login verification remain pending.
- **Cloud Wallet setup completed on 2026-09-27 JST.** An enabled Azure subscription, a dedicated Standard Key Vault and a service principal restricted to key create/read/sign are configured. Separate operator keys are linked to Curvegrid Testnet (`2017072401`) and Sepolia (`11155111`). Both passed live MultiBaas `personal_sign` signature recovery checks. No on-chain Cloud Wallet transaction has been submitted.
- Neither embedded login nor WalletConnect automatically sponsors gas. Sponsored tokenization is **not enabled** by this change. The current transaction flow still requires gas in the sending wallet.

## Verification performed

- Production build and TypeScript checks passed.
- All 131 unit tests passed, including account/chain binding, cancellation and private Cloud Wallet configuration validation.
- Three local browser tests passed for injected-wallet connection, account-change state clearing, market loading and demo behavior. MultiBaas was mocked for these browser tests; no transaction was signed or broadcast.
- Live Azure key creation and MultiBaas Cloud Wallet signing passed on both configured networks. Privy live login, Cloud Wallet transaction submission/TXM and sponsored tokenization remain unverified. See [the public verification record](../deployments/cloud-wallet-verification.json).

## 1. Activate Privy

1. Sign in to [Privy Dashboard](https://dashboard.privy.io/) and create an app for TOKENIZE TOKYO.
2. Enable Email and Google login. Enable Ethereum embedded wallets; use user-controlled wallets.
3. Allow the actual frontend origins: the local development origin in use, and the deployed application origin. For example, `http://localhost:3000`, `http://127.0.0.1:3000`, and `https://tokenize-tokyo.vercel.app`. Update these when using a different port or deployment domain.
4. Copy the public **App ID** into the active uncommitted environment file:

   ```dotenv
   NEXT_PUBLIC_PRIVY_APP_ID=your-real-app-id
   ```

   No Privy App Secret is required for this client-side integration. Never put an App Secret in `NEXT_PUBLIC_*`.
5. Restart the development server, or configure the same variable on the hosting platform and rebuild. A `NEXT_PUBLIC_*` variable is embedded at build time.
6. Open the wallet panel. The primary choice is **Continue with email / Google**; the secondary choice is **Connect MetaMask**. Complete email verification or Google sign-in yourself.

The application configures only its active chain. On Curvegrid Testnet, `NEXT_PUBLIC_RPC_URL` must be the existing browser-safe RPC endpoint, not an admin credential. Sepolia uses the SDK's Sepolia chain configuration. Switching environments must also switch the corresponding MultiBaas deployment and contract addresses.

Login creates a new embedded wallet for the user. Existing MetaMask assets are not automatically moved into it. The app binds the explicitly selected account and clears account-specific state on changes. Transaction review UIs are explicitly enabled.

### Optional WalletConnect

If needed later, create a project in [Reown Dashboard](https://dashboard.reown.com/), configure its allowed origins, and set its public project ID:

```dotenv
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your-real-project-id
```

This adds WalletConnect choices to Privy's external-wallet menu. QR is available on desktop, with individual WalletConnect wallet choices for mobile. Without the variable, the app does not offer these choices.

## 2. Create the Azure provider for Cloud Wallet

An Azure account with a valid subscription is required. Creating that account, accepting its terms, and configuring billing are account-owner steps. Azure Key Vault usage may be billed by Azure.

Azure CLI 2.90.0 is installed and authenticated. The active subscription was confirmed through CLI after the portal retained its older directory context. Resources were created in Japan East: resource group `tokenize-tokyo-wallet` and Standard Key Vault `tt-wallet-fce72ff1`, using Azure RBAC. The MultiBaas service principal has only the custom role below, assigned to this dedicated resource group. Its client secret expires on **2026-10-27 01:49 JST**; rotate the provider credential before continuing operation beyond that date. Private credentials are stored in ignored environment files with mode `0600`, not in verification reports.

Use the [official Curvegrid Cloud Wallet setup guide](https://docs.curvegrid.com/multibaas/cloud-wallets/). The required resources are:

- A dedicated resource group, for example `tokenize-tokyo-wallet`.
- A **Standard** Key Vault with a globally unique name. The setup command uses a software-protected key, not the extra-cost Premium HSM option.
- An Entra application/service principal for MultiBaas and its client secret.
- The least-privilege custom role described in Curvegrid's guide: vault metadata read, key create/read/sign, scoped to the dedicated resource group. Set a short credential expiry appropriate to this project rather than copying the example's distant expiry date.

Put these values only in the chosen private environment file. Do not paste secrets into README, chat, browser code, or public deployment reports:

```dotenv
CLOUD_WALLET_LABEL=tokenize-tokyo-operator
AZURE_CLIENT_ID=
AZURE_CLIENT_SECRET=
AZURE_TENANT_ID=
AZURE_SUBSCRIPTION_ID=
AZURE_RESOURCE_GROUP=
AZURE_KEY_VAULT=
AZURE_KEY_NAME=tokenize-operator
```

The file must also contain its existing server `MULTIBAAS_URL`, `MULTIBAAS_API_KEY`, and matching `NEXT_PUBLIC_CHAIN_ID`. The signing/admin API key must be separate from the public DApp User key.

## 3. Register and verify the Cloud Wallet

Inspect first (read-only, no Azure secrets required):

```sh
npm run cloud-wallet:setup -- --env .env.sepolia
```

After Azure has been provisioned, register its provider and create the operator key:

```sh
npm run cloud-wallet:setup -- --env .env.sepolia --apply --verify-signature
```

Use `.env.local` instead if setting up the Curvegrid Testnet deployment. The command checks the actual MultiBaas chain before any change, reuses matching registered providers/wallets, preserves a different existing operator, and stores the verified public address as `MULTIBAAS_OPERATOR_ADDRESS` in that same environment file. It never deletes a provider, changes contract roles, or sends an on-chain transaction.

`--verify-signature` signs a unique, non-transaction setup message and verifies the recovered address. This verifies signing access, not transaction submission or TXM. Reports under `.data/cloud-wallet/<chainId>.json` contain only public metadata and explicit verification flags.

If a request times out during creation, inspect the MultiBaas Cloud Wallet screen before retrying. A key may exist in Azure even if the local process did not receive its response; import that existing key rather than replacing it.

### Verified operator wallets

| Network | Operator address | Azure key | Verification |
| --- | --- | --- | --- |
| Curvegrid Testnet | `0xe7651562e2F34b5d3D668BEaD79B718f7db688bb` | `tokenize-operator-curvegrid` | Live signature verified |
| Sepolia | `0xE90FB4cABa8bE81391389A2dA4E2192c69151a17` | `tokenize-operator-sepolia` | Live signature verified |

`.env.local` and `.env.sepolia` contain the matching operator address and private provider settings. The local setup summary is `.data/cloud-wallet/azure-provisioning.json`. These changes do not update hosted environment variables, fund the operators, grant contract roles or enable transaction sponsorship.

## 4. Sponsored tokenization remains a separate step

The intended product policy is: **the application pays the network fee to register/tokenize assets, while rights belong to the user**.

The deployed `registerAsset` records `msg.sender` as issuer. Directly calling it from the operator would make the operator the issuer. `createScopedRightForIssuer` supports the existing ENS-authorized issuance path, but only after the relevant namespace permissions have been set. Cloud Wallet configuration alone does not change either rule.

Before enabling sponsored issuance, implement the appropriate issuer authorization path, verify ownership and replay protection, fund the operator, set only necessary contract permissions, and verify the user receives the issued rights. Never expose an unrestricted server signing endpoint or automatically grant administrator roles.

Privy's native gas sponsorship is another option for embedded-wallet transactions on supported networks, including Sepolia. Its published sponsorship list does not include Curvegrid Testnet; adding a custom RPC does not add sponsorship support. This integration does not enable native sponsorship or incur a sponsorship subscription.

## Relevant code

- `src/components/WalletConnection.tsx`: optional provider boundary and injected-wallet fallback.
- `src/components/PrivyConnection.tsx`: email/Google, embedded wallet, MetaMask and optional WalletConnect.
- `src/lib/managed-wallet.ts`: account and network binding, cancellation checks.
- `src/lib/use-browser-wallet.ts`: common connection state and account/chain events.
- `src/lib/multibaas.ts`: unsigned composition, wallet submission and MultiBaas receipt tracking.
- `scripts/setup-cloud-wallet.ts`: explicit inspection/setup and signing verification CLI.
- `src/server/cloud-wallet-setup.ts`: private provider configuration validation and redacted reporting.
- `src/server/operator.ts`: existing bounded operator adapter; no live Cloud Wallet transaction has been verified.

References: [Privy setup](https://docs.privy.io/basics/react/setup), [wallet options](https://docs.privy.io/wallets/connectors/setup/configuring-external-connector-wallets), [gas sponsorship](https://docs.privy.io/wallets/gas-and-asset-management/gas/overview), [Curvegrid Cloud Wallets](https://docs.curvegrid.com/multibaas/cloud-wallets/).
