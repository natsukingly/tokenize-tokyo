# ENSv2: spatial namespaces (proposed, not implemented)

The current working product is Curvegrid-first. No ENS registration, resolution or role assignment has been performed. No ENS prize eligibility is claimed.

The [Tokyo 2026 ENS requirements](https://ethglobal.com/events/tokyo2026/prizes/ens) require a functional **Sepolia** deployment with ENSv2 central to the product, an accessible source repository and a live demo. Decorative ENS labels are insufficient.

## Network decision comes first

A Curvegrid Testnet contract cannot directly read an ENSv2 registry on Sepolia. For authoritative delegation, deploy the Urban Rights Protocol to **Sepolia with a Sepolia MultiBaas deployment**, then bind both systems on the same chain. Alternatively, treat names only as discovery metadata until a separately designed cross-chain verification mechanism exists. Do not silently trust an off-chain lookup as an on-chain permission.

## Proposed integration

1. Obtain an ENSv2 parent name that the team actually controls; `tokenizetokyo.eth` is an illustrative name, not an owned deployment.
2. Attach a UserRegistry proxy using the ENSv2 Verifiable Factory and `setSubregistry` on the parent. An unattached registry can mint tokens without creating resolvable names.
3. After demo asset verification, register an asset subname under a district registry. Put the asset identifier, chain ID, registry address and canonical geometry hash in resolver records.
4. Create roof/interior/wall namespaces under the asset. Assign operator permissions using Enhanced Access Control with the minimum per-record privileges.
5. An `UrbanNamespaceAuthority` adapter checks the current ENSv2 resource permissions before permitting an operator to propose a scoped right. It must re-check on every action and respect name expiry/revocation.
6. Keep property verification separate. Namespace control proves control of an ENS namespace, never ownership of the physical building.
7. Index registration, resolver changes, expiry and permission changes through MultiBaas. Index by **labelhash**, not a supposedly stable ERC-1155 token ID: ENSv2 token IDs can change after permission updates and re-registration.

## Required tests before enabling

- Authorized delegated operator can propose only the intended scope.
- Expired, revoked or transferred namespace immediately loses authority.
- Permission to edit a description does not grant issuance or verification authority.
- Parent/child delegation cannot widen physical scope.
- Same-chain checks and resolver chain IDs reject mismatches.
- Labelhash tracking survives ENS token ID regeneration.
- Names resolve through the official Universal Resolver; no hard-coded resolution fixtures in the submitted demo.

Official references: [contract developer guide](https://docs.ens.domains/ensv2/tutorial-contract-developers/), [Permissioned Registry](https://docs.ens.domains/ensv2/permissioned-registry/), [Enhanced Access Control](https://docs.ens.domains/ensv2/enhanced-access-control/).
