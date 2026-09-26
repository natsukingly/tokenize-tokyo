# Account UX and Curvegrid Cloud Wallet options

Status: 2026-09-26. Proposal only; the live app still uses user-signed browser wallets.

## Current implementation / 現在

- Platform navigation: Explore, Dashboard, Markets, ENS Index, Activity. These show the shared city and market.
- My workspace: My assets and Compose. Holdings and transactions use the connected address; My assets explains how to connect when signed out. Viewing a basket definition does not require owning it.
- A browser wallet connection is not a server-authenticated login session. Demo role switching exists only in the explicit simulation.
- `src/server/operator.ts` has a Cloud Wallet adapter for bounded operator actions (verification, activation and revenue deposits) and TXM status. It is not a per-user account service and has not been validated with a live Cloud Wallet.

全体の市場を見るメニューと、自分の保有・組成を扱うメニューを分離した。現在の実取引は利用者のウォレット署名。メール／Googleログインや一般利用者向けCloud Walletは未実装。

## Can the product work without MetaMask?

Yes. MultiBaas Cloud Wallet integrates an externally owned account with Microsoft Azure Key Vault and can sign and submit contract calls. The application's cloud account controls the keys; Curvegrid does not take custody. If this application controls end-user signing keys, the application operator has custody relative to those users. Cloud Wallet is not itself an email/Google/passkey authentication system.

Proposed flow:

```mermaid
flowchart LR
  Login[App login] --> Account[Authenticated user account]
  Account --> Mapping[Server-owned user-to-wallet mapping]
  Confirm[User reviews and confirms action] --> Policy[Authorized action and spend checks]
  Mapping --> Policy
  Policy --> MB[MultiBaas Cloud Wallet]
  Vault[Operator's Azure Key Vault] --> MB
  MB --> Chain[Blockchain transaction]
  Chain --> TXM[TXM status and event indexing]
  TXM --> Receipt[My assets and explorer receipt]
```

Before implementation: choose the key ownership model, configure the cloud provider, build authenticated sessions and per-user wallet mapping, restrict backend signing by account/method/amount, prevent duplicate requests, and specify recovery and gas funding. An API key must not be shipped to the browser with signing permissions. Keep explicit transaction confirmation even if a browser extension is unnecessary.

MetaMaskを必須にしない構成は可能。通常のログイン→利用者専用アドレス→購入内容の確認→MultiBaasで署名／送信→保有一覧と取引履歴、という体験にできる。ただし自社の鍵保管基盤で利用者の鍵を管理する場合、運営者が鍵を管理する方式になる。自己管理を維持したい場合は、別途組込みウォレットを比較し、MultiBaasは取引作成・索引取得に利用する。現時点では鍵の管理方式を切り替えていない。

Official references: [Cloud Wallet setup](https://docs.curvegrid.com/multibaas/cloud-wallets/), [Curvegrid platform and custody model](https://www.curvegrid.com/blockchain-platform), [API key permissions](https://docs.curvegrid.com/multibaas/api-keys/).
