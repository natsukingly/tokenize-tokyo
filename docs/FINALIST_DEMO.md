# Finalist presentation

Local entry: http://127.0.0.1:3000/present

The current [bilingual script](submission-kit/pitch-current/general.md) targets 3:55, leaving five seconds before the four-minute limit. The opening uses the four current slides. The simulator follows one new rooftop through separate asset and right review, issuance, a ten-unit purchase, activation, a 10,000 mJPY deposit, a 1,000 mJPY claim and a two-unit resale offer. No real transaction is sent.

## Present

- Use left/right arrows for slides. From the logo, right arrow opens the demo.
- S returns to the last opening slide. D returns to the same demo state. A opens the animated architecture. Alt+1 / Alt+2 / Alt+3 work while an input is focused.
- In the architecture, arrows or Space move through issuance, trading, bundles and income. P plays one sequence, 0 returns to the overview, and N shows notes. Leaving the diagram stops autoplay and preserves its current state.
- H shows or hides the presentation controls. They are hidden initially.
- The demo stays mounted when slides are shown. No action is replayed on return.
- Start guided demo, then Open prepared project. Follow the highlighted action in the application and use Continue when it completes. Terms acceptance remains a manual checkbox.
- Role changes and example inputs are prepared. Actions still use the application's existing handlers and simulation engine. The guide waits for events from the current project rather than historical activity.
- Evidence links open separate, recorded public Sepolia receipts in a new tab. Close that tab to return. Do not describe these as the transaction just simulated.

## Evidence

Sources: [hosted CloudWallet purchase](../deployments/card-checkout-hosted-verification.json), [card checkout implementation](CARD_CHECKOUT.md) and [public scenario receipts](../deployments/sepolia-demo-receipts.json).

- [CloudWallet card purchase](https://sepolia.etherscan.io/tx/0x8e5d49e8f3e84ccd479e039dbd2501fb1592c38455e6d12d1e930a1322dfffbc): a hosted Stripe test checkout triggered the deployed webhook. The operator CloudWallet submitted the Sepolia transaction and paid gas; one right reached the buyer. The buyer needed no purchase signature or gas funding.
- [Purchase](https://sepolia.etherscan.io/tx/0xb09ca5256562dfd44d3cd9aa8843d64188ef0f0604eb1f83c5bdb8c6c6f8b9b3): `roof/purchase`.
- [Revenue claim](https://sepolia.etherscan.io/tx/0x5dc6545942d2ff6ea504954feaf4d50d13135c3fcc9db4cdab6c34319370e09e): `roof/claim`.

The recorded runs have different quantities and addresses from the browser simulation. They establish separate contract execution examples, not the identity or ownership of the fictional property. The guide provides all three links; the four-minute main script opens the CloudWallet purchase receipt. Explain the deployed workflow first, then identify tutorial mode briefly. Gasless purchase refers to card checkout; it does not describe every application action. Stripe payments are in test mode, while the Sepolia delivery is a confirmed blockchain transaction.

## Restart and slides

Reload `/present` to restart the presentation, or choose Quick tour → Finalist demo inside `/demo`. Starting another run adds a new fictional project at an unused demo coordinate; it does not reset existing browser data. Reloading during a run resets guide progress, so use S/D to switch instead.

Architecture source: `docs/submission-kit/architecture/index.html`. Run its `render.mjs` after diagram edits to update `public/pitch/architecture`. [Diagram and narration](submission-kit/architecture/README.md). The Curvegrid script uses it after the 3D reveal; the common production direction returns to the overview.

Slide source: `docs/submission-kit/intro/visual-v3/index.html`. Run its `render-slides.mjs` after slide edits. It writes both review PNGs and `public/pitch/intro/slide-1.png` through `slide-4.png` for `/present`. No video work runs.

Only `/demo` and the static `/pitch/architecture/index.html` allow same-origin framing. The general frame-denial policy remains in effect for wallet, explorer and other pages. This enables the simulator's modal dialogs to remain isolated inside the presenter while retaining their state.
