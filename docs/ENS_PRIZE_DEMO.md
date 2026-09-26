# ENSv2: identity and precise permissions for an urban space

**Live demo:** https://tokenize-tokyo.vercel.app/ens

**Source:** https://github.com/natsukingly/tokenize-tokyo

**Network:** public Ethereum Sepolia (11155111). Test assets and test tokens only.

## Why ENSv2 is central

The rooftop has an ENSv2 registry path, not just a generated display label:

`rooftop.building-1.chiyoda.tokenizetokyo-demo-2026.eth`

The protocol validates the canonical registry hierarchy, controller, expiry, deployment provenance and binding to the asset and scope. Delegated issuance requires both the live ENS role and the owner's bounded application grant. Removing the ENS role stops future delegated issuance. The owner can still operate their own asset without delegation.

A second, independent role lets an energy reporter write only `urban.energyReport` through the official Permissioned Resolver. The reporter cannot change `urban.assetId` or `urban.rightsContract`. This role does not grant issuance or resolver replacement. Reports are read through the official Universal Resolver V2, not a locally substituted value.

## Two roles, two explicit permission models

| Actor | ENS permission | Product effect | Revocation |
| --- | --- | --- | --- |
| Rooftop operator | Name-scoped registry `ROLE_SET_RESOLVER`, plus a separate issuer-approved application grant | Resolver management and bounded preparation of solar revenue rights for the issuer | Removing either the ENS role or application grant blocks future issuance; existing rights remain |
| Energy reporter | Permissioned Resolver `grantSetterRoles(setText(..., "urban.energyReport", ...), reporter)` | Update only the energy report key; no issuance authority | Revoke the report-key `ROLE_SET_TEXT`; existing report stays readable |

The issuance operator's registry role is deliberately broader than report-only access: it permits replacing the leaf resolver. Canonical contract binding, not mutable resolver records, decides issuance authority. Do not describe the issuance role as report-only or as a custom ENS issuance role.

Resolver key permissions apply to **all names served by that resolver instance**. This demo uses an isolated rooftop resolver. Give independent spaces separate resolver instances; a shared resolver does not provide per-name isolation. Reporting permission has no built-in expiry and remains active until revoked. Application issuance grants separately enforce quantity, purpose and time limits.

## 90-second presentation

1. **Identity (15s):** open `/ens`. Show the registered rooftop name and live Sepolia binding. Explain district → building → rooftop.
2. **Issuance (25s):** show the recorded successful delegation, issuance and revocation receipts. Explain that 10 units were delivered to the issuer, not the operator. Open **Issue rights** for the functional wallet controls. Separate verifier approval still applies.
3. **Precise permission (35s):** open **Report energy**. The owner grants report-only access to a separate reporter wallet. Connect that reporter, enter a month and kWh reading, and publish. **Check permissions** must show the report key allowed and both protected keys denied. Read back the stored report through the Universal Resolver.
4. **Revocation (15s):** reconnect the owner and revoke reporting access. Run the read-only permission checks again: all writes are denied; the saved report remains visible.

Transactions need block confirmation, so rehearse and allow enough time. The overview is explicitly a **recorded public run** whose receipts are checked live. Never present those older transactions as having just been sent. Permission checks use `eth_call` and do not send failed transactions or consume gas. Transport errors display **Check unavailable**, not **Denied**.

日本語の締め:

> ENSは、この屋根の名前であり、誰にどの操作を任せるかを決める仕組みです。報告だけ任せることも、上限付きで権利の発行を任せることもできます。権限を取り消すと、その後の操作がコントラクトで止まります。

## Code map for judges

| Feature | Start here |
| --- | --- |
| Official registration, registries and isolated resolver | [setup-ens-sepolia.ts](../scripts/setup-ens-sepolia.ts) |
| Canonical binding and enforced issuance limits | [UrbanNamespaceAuthority.sol](../contracts/src/UrbanNamespaceAuthority.sol), [UrbanRightToken.sol](../contracts/src/UrbanRightToken.sol) |
| Live registry and binding reads | [authority.ts](../src/lib/ens/authority.ts), [registry.ts](../src/lib/ens/registry.ts) |
| Report-key grant/revoke, Universal Resolver readback and live denial checks | [reports.ts](../src/lib/ens/reports.ts), [resolver-abi.ts](../src/lib/ens/resolver-abi.ts) |
| Dedicated judging UI and wallet actions | [EnsShowcase.tsx](../src/components/EnsShowcase.tsx), [EnsDelegation.tsx](../src/components/EnsDelegation.tsx) |
| MultiBaas unsigned transaction composition and independent calldata checks | [multibaas.ts](../src/lib/multibaas.ts), [call.ts](../src/lib/ens/call.ts) |
| Public issuance proof | [delegation report](../deployments/ens-v2-sepolia-delegation-proof.json), [verification script](../scripts/verify-ens-delegation.ts) |
| Public report-key proof | [reporting report](../deployments/ens-v2-sepolia-report-proof.json), [verification script](../scripts/verify-ens-reports.ts) |
| Real official contract fixtures and permission tests | [ENSDelegation.t.sol](../contracts/test/ENSDelegation.t.sol), [fixture provenance](../contracts/test/fixtures/ensv2/README.md), [reports.test.ts](../src/lib/ens/reports.test.ts) |

## Reproduce

Use the Sepolia configuration described in the README. Browser variables point to the same registry, authority and MultiBaas contracts as `deployments/11155111.json`. The reporting feature uses the already-linked `enspermissionedresolver` contract; no secret or new deployment is required by the browser.

```sh
npm ci
npm run typecheck
npx vitest run src/lib/ens
forge test --root contracts --match-contract ENSDelegationTest

# Read-only binding and resolver preflight:
npx tsx scripts/verify-ens-reports.ts --env .env.sepolia

# Explicitly execute/resume bounded Sepolia test transactions:
npx tsx scripts/verify-ens-reports.ts --env .env.sepolia --broadcast
```

The broadcast script journals signed transactions before submission, creates a separate test reporter, caps the combined maximum fee/funding allocation at 0.003 Sepolia ETH, verifies a report-only grant and protected-record denials, writes a labeled test report, and revokes the grant. It keeps the signing key and journal under ignored `.data/ens-reports/`; only public addresses, receipts and verification results are published. Re-running uses the same journal; it does not silently mint a new reporter or repeat confirmed transactions.

## Scope and attribution

Only the registered asset #1 rooftop is the live ENS example. Other generated names in the main map remain previews. ENS does not prove property ownership or physical generation. Report contents are explicitly operator-reported test data. No wildcard resolution, namespace aliasing or AI agent execution is claimed. These are optional directions, not implemented features in this submission.

Project-authored code is MIT licensed. ENS fixtures and dependencies retain their own licenses. Third-party fonts and brand research assets retain the licenses distributed with them and are not relicensed by the root MIT license. AI coding assistance was used for implementation, tests and documentation; see repository history for project contributions.
