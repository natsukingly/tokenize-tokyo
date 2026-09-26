# TOKENIZE TOKYO: Adversarial Q&A (ETHGlobal Tokyo 2026)

Purpose: the 40 hardest questions a judge, regulator or investor can ask, with an answer we can say out loud in 20 seconds. Every answer is grounded in the repo as of 2026-09-26 evening. When the true answer is "simulated" or "not yet", we say so first. This file extends `docs/qa-cheatsheet.md`; where the two overlap, the wording is consistent.

**Tags**

- **[A]** could be fatal: must have a crisp answer, no pause.
- **[B]** handle with a prepared answer.
- **[C]** answer with the demo itself: the named demo moment is the answer.

---

> **The one question that decides the pitch**
>
> *"Cool visualization. But what exactly became possible because you tokenized it?"*
>
> **Answer:** Two people can no longer sell the same rooftop for the same years, a hundred strangers can co-own its cash flow, and the revenue follows the token automatically, all enforced by code instead of a bespoke contract.
>
> - **Conflict rejection (Scene 3):** issuing a second exclusive rooftop right for overlapping years fails with "Spatial Right Conflict" (`UrbanRightToken.findConflict`, re-checked in `verifyRight`).
> - **Purchase → activation (Scene 4):** Investor B buys revenue units; test JPY in and ERC-1155 out settle in one transaction (`UrbanMarketplace.purchase`); the verifier activates and the roof turns green.
> - **Activity ledger:** AssetVerified, RightCreated, ListingPurchased, RevenueDeposited, all read from MultiBaas Event Queries. On Curvegrid Testnet: 448 scripted transactions, 50 assets, 44 rights, 69 sales, 20 revenue deposits.

---

## I. Token vs real-world rights

**Q1. What right exactly is being tokenized?** [A]
Not the building. A right is space × time × usage × cash flow: asset id, canonical scope (roof, interior, wall, land, whole), a half-open window `[start, end)`, a type (Usage, Revenue Share, Lease, Other), a purpose, a terms hash and a transfer policy. Each right is one ERC-1155 id with fixed supply; exclusive usage has supply 1, revenue rights are divisible units.
Evidence: `UrbanRightToken.RightRequest`, `createScopedRight`.

**Q2. What legal rights does a token holder have?** [A]
In this prototype, none: assets are fictional and Mock JPY has no value. By design, the token points to a terms document whose hash is on chain; a usage holder gets the use described there, a revenue holder gets a pro-rata share of what is actually deposited. The code guarantees the payout math and the transfer rules; making the terms enforceable against the owner is a legal wrapper we have not built.
Evidence: `termsURI` + `termsHash` in `Right`; `RevenueVault.claim`.

**Q3. If the NFT is transferred, does property ownership transfer?** [A]
No. The token never represents title to the building. Transferring it moves the scoped right (for example ten years of rooftop solar revenue), and the land registry is untouched. The app says it on screen: "Map data does not prove ownership. No residential or property ownership is sold."

**Q4. If the land registry and on-chain owner disagree, which is authoritative?** [A]
The land registry, always, for property ownership. The chain is authoritative for a narrower thing: who holds which right token and what was paid and deposited. If the issuer turns out not to own the property, the verifier rejects the asset or closes the right (`verifyAsset(id,false)`, `closeRight`).

**Q5. Who guarantees the mapping between real-world rights and tokens?** [A]
The holder of `VERIFIER_ROLE`. In the demo that is the deployer, and verification is simulated. In production it is a licensed party (for example a judicial scrivener or trust company) who checks registry records and the terms; the contract already separates asset verification from right verification and allows only one verified asset per canonical geo hash.
Evidence: `UrbanAssetRegistry.verifyAsset`, `verifiedAssetByGeo`, `UrbanRightToken.verifyRight`.

**Q6. Can you label something "Dormant" without the owner's consent?** [B]
Today we label nothing real: the ~150 Opportunity Lens sites are generated demo points marked "Demo dataset · not real listings". In the protocol, "Dormant" is a lifecycle stage of an asset the owner registered: it means no right is issued yet, not a claim about the building. In production, a site-level label appears only for owner-registered assets; unregistered supply stays at the level of public statistics and investor interest signals.
Evidence: `src/lib/dormant.ts` (`DORMANT_DATASET_LABEL`), `src/lib/lifecycle.ts`.

**Q7. How do you prove a house/plot/space is actually vacant or unused?** [B]
We do not prove physical vacancy on chain, and we do not claim to. The owner declares what capacity they offer and submits evidence; the verifier reviews it before any right is issued. What the chain proves is that the capacity is not already committed: a verified exclusive right blocks any overlapping one.

**Q8. Can PLATEAU really provide that information?** [A]
No, and we do not use it. PLATEAU is a 3D city model: building shapes and some attributes. It does not record ownership or vacancy. Our map is MapLibre with OpenStreetMap/OpenFreeMap tiles; PLATEAU is a possible future source for finer building geometry only.

**Q9. Who estimates asset value and expected yield?** [B]
Nobody inside the protocol, on purpose. The issuer sets the listing price, the market accepts or ignores it, and revenue is only what an operator actually deposits; the app promises no yield. A valuation oracle becomes necessary for collateralized lending, which is our next layer.
Evidence: `UrbanMarketplace.createListing` (price set by seller), `RevenueVault.depositRevenue`.

## II. Regulation

**Q10. KYC/AML?** [A]
Not implemented; the prototype uses test money only. In production, a licensed intermediary or partner performs KYC and AML, and the right uses the Allowlist policy so only approved addresses can receive or send it. Primary purchases also pass through that check, because every transfer does.
Evidence: `UrbanRightToken._update`, `setAllowed`.

**Q11. Isn't the token a financial instrument?** [A]
We do not claim a legal classification. A transferable revenue-share token may fall under the Financial Instruments and Exchange Act, as electronically recorded transferable rights or a collective investment scheme interest. That is why the prototype uses fictional assets and valueless Mock JPY and sells nothing real; a real launch goes through a licensed intermediary and legal counsel.

**Q12. Relationship to Japan's Real Estate Specified Joint Enterprise Act and FIEA?** [A]
Both are relevant and we give no conclusion on either. Revenue-share rights raise FIEA questions; pooling money to invest in real estate raises the Real Estate Specified Joint Enterprise Act. Our production path is to operate through a licensed intermediary or partner, with Allowlist for eligibility and Nontransferable for usage rights where needed.

**Q13. Is a freely tradable ERC-20 acceptable?** [B]
The rights are not ERC-20; they are ERC-1155 ids with a per-right transfer policy. Only the payment token is ERC-20. "Open" exists for the testnet; investment-type rights in production use Allowlist, and usage rights that must stay with one operator use Nontransferable.

**Q14. Restrictions on sales to foreign investors?** [B]
We do not state which limits apply; that is for counsel. Whatever limits apply are enforced by the same mechanism as KYC: the intermediary checks eligibility before calling `setAllowed`, and an address that is not allowed cannot receive the right.

**Q15. How is permissioned transfer implemented?** [B]
Every transfer runs `_update`, which checks the right's policy: Open passes, Allowlist requires both sender and receiver in `allowed[id]`, Nontransferable reverts. Nontransferable rights are also not tradable, so the marketplace refuses to list them, and baskets accept only Open revenue rights.
Evidence: `UrbanRightToken._update`, `isTradable`, `isBasketCompatible`.

## III. Operations after tokenization

**Q16. Who collects revenue and sends it on chain?** [B]
The operator, for example the solar operator on the roof. It collects income off chain and calls `depositRevenue`, which works only while the right is Active and inside its time window. The server-side Cloud Wallet path for this role is implemented but not exercised live; the 20 on-chain deposits were scripted.

**Q17. What if rent or usage fees are not paid?** [B]
Then nothing is deposited and holders receive nothing; there is no advertised yield to break. The shortfall is public: the Activity ledger shows no RevenueDeposited for that period. Collecting from the operator is enforced off chain under the terms; the verifier can close the right.

**Q18. What happens to tokens if the property is sold?** [A]
On chain, nothing changes automatically: the right lives until `endAt` or until the verifier closes it. Whether a new owner is bound by the right is set by the off-chain agreement, and that legal structuring is not built. We do not claim the token survives a sale by itself.

**Q19. What if the owner wants to un-tokenize?** [B]
The owner cannot take back sold units; that is the point. The owner can burn units they still hold, buy units back on the marketplace, or wait for `endAt`. Closing an active right stops trading and new deposits, while revenue already accrued stays claimable.
Evidence: `burn`, `closeRight`, `RevenueVault.claim`.

**Q20. How do token holders exit?** [C]
Demo moment: Portfolio → **List for resale** on a holding. Any holder can list some or all units on `UrbanMarketplace`, with partial fills; basket holders can also **Redeem** shares for the underlying rights. The scripted testnet run includes secondary purchases among its 69 sales.

**Q21. If there is no liquidity, what is the point of RWA?** [B]
Liquidity is not guaranteed and we do not promise it. What remains valuable without it: no double sale of the same space, small units anyone can co-own, revenue that follows the holder automatically, and a public payment history. Baskets pool several roofs so one share has broader demand than one roof.

## IV. Attacks on the product itself

**Q22. Why not ordinary real-estate crowdfunding?** [A]
Crowdfunding funds a whole property through one operator's fund, recorded in that operator's database. We split one building into scoped rights: the roof for ten years, the ground floor on weekends, each with its own cash flow, and these rights trade and bundle across platforms. A licensed crowdfunding operator is a natural partner and distribution channel.

**Q23. Why blockchain instead of a database?** [A]
Many parties who do not trust one company's database: owner, verifier, operator, many investors, basket holders. The chain enforces three rules none of them can quietly override: no overlapping exclusive use, payment and delivery in one atomic trade, revenue split only from real deposits. A database can model these rules; it cannot make them binding for marketplaces and vaults it does not run. It does not stop an off-platform agreement, and we do not claim it does.

**Q24. Why not existing REITs?** [B]
REITs hold large, stabilized properties as whole assets. They cannot buy ten years of one small roof or weekend use of a vacant house. We target capacity that is too small, too partial and too time-bound for any existing vehicle.

**Q25. Does the "dormant capital" problem really exist?** [B]
Yes, in public statistics: 897,000 vacant homes in Tokyo, 214,000 of them "other vacant" (not for rent, sale or secondary use), a 10.9% vacancy rate (MIC 2023); about 1,303 ha of unused land in the 23 wards (TMG 2021); solar on only about 6.0% of detached houses (TMG FY2022).

**Q26. Market size and the basis for the number?** [B]
We do not state a TAM, and we will not make one up. The numbers we cite measure supply: vacant homes, unused land, roofs without solar, each from a named government survey. Demand is what the interest-signal feature will measure.

**Q27. Who is the first customer?** [A]
No signed customer yet; we say that plainly. The first target is a rooftop: a building owner in the central wards paired with a solar operator. Tokyo's solar mandate since April 2025 covers new houses by large builders, so existing roofs remain the gap. Demand comes first: investors signal interest, we reach the owner through the app, agents and referrals, verify, then tokenize into visible demand.

**Q28. Who pays?** [B]
The plan is a fee on primary issuance and settlement, taken by the platform or the licensed partner that operates it. The current contracts charge no fee; the business model is not implemented.

**Q29. What is the asset owner's incentive to tokenize?** [B]
Earn from what the space can do without selling or leasing the whole property. With 23-ward residential land prices up 9.0% in the 2026 MLIT publication, the fifth straight rise, owners prefer to hold; this lets them hold and still monetize the roof or the weekends. Funding arrives up front from the primary sale.

**Q30. What is the investor's incentive to buy?** [B]
Small-unit access to the cash flow of one specific roof or space, which no existing product offers. Every deposit and claim is on a public ledger, and units can be resold or bundled into baskets. No yield is promised; revenue is only what is deposited.

## V. Sponsor technology / Curvegrid

**Q31. Why is Curvegrid necessary?** [A]
Not for the contracts; for the product. An RWA market lives on lifecycle history: who verified, when it activated, what was paid. MultiBaas gives us that without an indexer or database: Event Queries with `add` aggregation, unsigned transaction composition signed in the user's wallet, and RBAC keys that match our roles. All 448 scripted transactions were composed through MultiBaas; webhooks, Cloud Wallet and TXM are implemented but not exercised live.

**Q32. Couldn't you build this without MultiBaas?** [B]
Yes, with our own indexer, backend and key management, and we would rebuild what MultiBaas already gave us. The integration is real, not a logo: we hit and fixed seven concrete issues (positional `inputIndex`, 50-row page cap, funded-sender gas check and others) and wrote them up as feedback.
Evidence: README "(e) Experience with MultiBaas".

**Q33. Isn't the "dashboard" just a 3D visualization?** [C]
Demo moment: **Activity** after the purchase, then **Dashboard**. Every row is an on-chain event from MultiBaas Event Queries, and the traded-volume and revenue-deposited totals use server-side `add` aggregation. The live testnet ledger holds the 448 scripted transactions.

**Q34. Isn't the "tokenization" just an NFT mint demo?** [C]
Demo moment: **Scene 3, conflict rejection**. A plain mint accepts anything; ours refuses an unverified issuer, an overlapping exclusive right, and a divisible exclusive right. After the mint come transfer policies on every transfer, revenue checkpoints so a buyer earns only after purchase, and custody-backed baskets. 25 Foundry tests, including a rounding fuzz test, cover this.

## VI. Demo credibility

**Q35. Are you actually tokenizing Tokyo real estate?** [A]
No. Every asset is fictional, verification is simulated, Mock JPY has no value, and no real property is sold. What is real is the protocol: six contracts deployed on Curvegrid Testnet (chain 2017072401), indexed by MultiBaas, with 448 transactions on chain.

**Q36. If assets are fictional, what have you proven?** [A]
The mechanics, on a live chain: the conflict engine, atomic settlement, the pro-rata revenue index, fixed-ratio baskets, transfer policies and two-stage verification, reconciled by a read-only script against Event Query aggregates. Not proven: real demand, legal enforceability, real ownership checks. We say that split every time.

**Q37. Does it really need to be 3D?** [C]
Demo moment: **City X-ray** on Nihonbashi Solar Roof. Rights here are vertical: roof, interior, wall and land are different spaces in the same footprint. On a flat map they collapse into one pin; in 3D you see which layer is committed and which is free.

**Q38. How is this different from pins on Google Maps?** [C]
Demo moment: **Opportunity Lens → Rooftop**, then the roof turning green after activation. A pin describes a place. Here each space carries scoped rights with on-chain state: Dormant, Funding, Funded, Active. The map changes because the contract state changed.

**Q39. Why does putting it on chain activate dormant assets?** [A]
The chain alone does not. It removes the reason small capacity stays idle: selling part of a space today needs a bespoke contract for the whole property. Once a rooftop decade is a standard unit that cannot be double-sold and pays holders automatically, it is small enough to fund. Activation still needs an owner, an operator and demand, which is why the cold start is demand-first.

**Q40. Isn't there a huge practical gap between "discovery" and "financing"?** [B]
Yes, and we built both ends of it: discovery (Lens, X-ray) and financing (verification, atomic sale, revenue, baskets). The bridge is the interest signal, which routes investor demand to the owner; it is the next feature. After that come a real verification partner and KYC-gated Allowlist transfers.

---

## If asked and we don't know

1. Say what is simulated first: assets, ownership verification, Mock JPY, the verifier role held by the deployer.
2. Say what ships when, in order: interest signal next; then a verification partner with KYC on Allowlist; collateralized lending only after a valuation oracle and legal review. ENSv2: local adapter tested, Sepolia deployment pending. Webhook delivery, Cloud Wallet and TXM: implemented, not exercised live.
3. Never claim a legal classification. "It may fall under FIEA; we avoid it with test-only money and fictional assets; production goes through a licensed partner."
4. Never cite a number outside the verified list. No TAM.

## Rehearse these 5 aloud first

1. The one question: "What exactly became possible because you tokenized it?"
2. Q35: Are you actually tokenizing Tokyo real estate?
3. Q11: Isn't the token a financial instrument?
4. Q23: Why blockchain instead of a database?
5. Q39: Why does putting it on chain activate dormant assets?
