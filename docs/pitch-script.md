# TOKENIZE TOKYO — 4-minute finalist script (v2, 2026-09-26)

> **Superseded for recording (2026-09-27):** use the [four-version recording kit](submission-kit/README.md), [general bilingual script](submission-kit/general-script.md), and [sponsor-specific scripts](submission-kit/index.html). The historical script below contains stale environment, ENS and test-count claims; do not read it unchanged for submission.

Decks: `pitch/index.html` (general, 5 slides), `pitch/curvegrid.html` (6 slides: 4 = Programmable rights, 5 = MultiBaas), `pitch/ens.html` (6 slides: 4 = Spatial namespace, 5 = Four layers). Slide numbers below are for the general deck; in the track decks, "Slide 4" below becomes slides 4 and 5, and "Slide 5" becomes slide 6.

Format assumed: 4 min demo + 3 min Q&A. Judging axes: Technicality / Originality / Practicality / Usability / WOW.
Rule for this script: every claim maps to something that exists in the repo. No PLATEAU, no ENS, no numbers other than the three verified ones.

Two sentences the judges must remember:
1. **We don't tokenize buildings. We tokenize what buildings can do.**
2. **Tokyo already has the assets. What it lacks is a market for their unused capacity.**

Before you start: browser on `/` in demo mode, actor = **Owner A**, Explore tab, lens off, deck open in a second window on slide 1. Reset demo first so the state is clean (footer → Reset demo).

## 0:00–0:25 · Slide 1 · Problem and scale
> Tokyo is full of dormant capital. 897 thousand vacant homes, 214 thousand of them not even for rent or sale. 1,300 hectares of unused land inside the 23 wards. Only about 6 percent of detached houses have solar on the roof.
> Tokyo doesn't lack assets. It lacks a market for what those assets could do.

## 0:25–0:40 · Slide 2 · Why there is no market
> Owners have space. Operators know how to use it. Capital wants to fund it. Users want access. Today none of them can transact on a rooftop for ten years, or a ground floor on weekends, without a bespoke contract for the whole property.
> The assets already exist. The market doesn't. So we built one. Let me show you Tokyo.

Switch to the app.

## 0:40–2:55 · Live demo (2 min 15 s)

### Scene 1 · Discover (0:40–1:05) — Usability, WOW #1
Click **Opportunity Lens**. City dims.
> This is central Tokyo with 150 dormant spaces in our demo dataset. Instead of searching a spreadsheet, you search the city itself.
Click **Rooftop**. Only rooftops glow, overlay reads "83 dormant opportunities".
> 83 rooftops that could carry solar. Same lens works for vacant homes and idle land.

### Scene 2 · X-ray (1:05–1:25) — Originality
Click **Nihonbashi Solar Roof** pin, then **City X-ray**.
> One building is not one asset. The roof, the interior, the wall and the land are separate spaces, each with its own time window and usage. That is what we tokenize: an Urban Right = space × time × usage × cash flow.

### Scene 3 · Tokenize and Conflict (1:25–2:05) — Technicality peak
Go to **Tokenize** (actor Owner A). Issue a right on the same rooftop: scope Rooftop, exclusive, period overlapping the existing solar right, purpose "Rooftop restaurant". Click **Issue right for verification**.
Error toast: **REJECTED — Spatial Right Conflict: overlapping exclusive space and time.**
> Same roof, overlapping years, both exclusive. The protocol rejects it on-chain. Two people cannot sell the same rooftop twice. A revenue-share right can still coexist with a usage right, because it doesn't occupy space.

### Scene 4 · Fund and activate (2:05–2:55) — Practicality, WOW #3
Switch actor to **Investor B**. Explore → Nihonbashi Solar Roof → quantity → **Acquire right**.
> An investor buys a share of the solar revenue with test JPY. Primary sale settles on-chain, ERC-20 in, ERC-1155 out, atomically.
Switch to **Demo verifier** → **Activate project**. Back on the map the roof turns green and solar panels appear.
> Dormant, funded, activated. The city changed on screen. Switch to **Activity**: every step is an event, AssetVerified, RightCreated, ListingPurchased, RevenueDeposited, indexed through Curvegrid MultiBaas in live mode.

Switch back to the deck.

## 2:55–3:25 · Slide 3 · What we invented
> We don't tokenize buildings. We tokenize what buildings can do. A physical asset becomes a set of rights, each scoped in space, time and usage, with its own cash flow. Overlapping exclusive rights are impossible by construction. Revenue rights can be pooled into baskets.

## 3:25–3:35 · Slide 4 · Infrastructure (10 s, do not linger)
> 3D Tokyo on MapLibre, the Urban Rights Protocol in six contracts, Curvegrid MultiBaas for event queries, contract calls and webhooks. The six contracts are deployed on Curvegrid Testnet and indexed by MultiBaas today. MultiBaas is what makes a city's worth of heterogeneous rights observable in one dashboard.

## 3:35–3:50 · Slide 5 · Why it matters at scale
> We are not competing for the real estate market. We are creating a market for urban capacity that isn't marketable today. Today rooftops, vacant homes, idle land. Tomorrow revenue baskets, lending, collateral.

## 3:50–4:00 · Closing
> We don't tokenize Tokyo to speculate on it. We tokenize it to put dormant assets back to work. Thank you.

## Timing safety
- If Scene 3 runs long, drop the revenue-coexistence sentence.
- If the map is slow, pre-warm the tab and keep zoom at the default; the lens and X-ray do not need a flyTo.
- Slide 4 is optional under time pressure; Slide 3 and the closing are not.

## Q&A
See `qa-cheatsheet.md`. Expect: why blockchain, who verifies ownership, is it a security, why Curvegrid, what is simulated. Answer "what is simulated" first and plainly: verification, map ownership and JPY are simulated; the contracts, conflict engine and settlement are deployed on Curvegrid Testnet and indexed live by MultiBaas, with 25 Foundry tests behind them.
