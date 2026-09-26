# TOKENIZE TOKYO — finalist pitch

**最新の推奨構成は [ひとつの屋根が、事業・権利・収益になる](DEMO_SCENARIO.md) です。** 以下は競合検出・稼働開始を中心にした旧シナリオの記録です。公開アプリのモード、ENSの進捗、画面名には古い記述があるため、そのまま提出用台本には使わないでください。現在の公開メインは実テストネット、`/demo`はシミュレーションです。ENSは公開Sepoliaで委任発行まで検証済みで、公開UI接続が残っています。

**Remember this:** “We don't tokenize buildings. We tokenize what a city can do.”

The [five-slide deck](pitch/index.html) follows **problem → product → invention → scale**. The product gets **2 minutes 15 seconds**, beginning at 0:40. Revenue accounting, basket operations and sponsor details stay in Q&A instead of becoming extra main-demo clicks.

The [Tokyo 2026 official guide](https://ethglobal.com/events/tokyo2026/info/details) specifies four minutes of demo plus three minutes of Q&A and five judging categories. This is a timed script, not proof that a human rehearsal has finished within four minutes. The browser at port 3000 simulates transactions. Separately, six Solidity contracts are deployed on Curvegrid Testnet; 448 scripted transactions and 630 indexed events were checked through MultiBaas. ENSv2 has a locally tested read adapter, but registration/delegated issuance are pending. PLATEAU remains planned.

## Run the presentation

1. Start `npm run dev` and open the app in a separate, fresh browser profile. Keep that profile open for preparation and presentation. Do not reset an existing user's demo data.
2. Open [the deck](pitch/index.html). **← / →** changes slides, **N** opens notes, **D** opens `http://127.0.0.1:3000`, **T** starts/pauses the optional four-minute clock, **R** resets it. The clock continues while the app tab is in front; it never advances slides or submits transactions.
3. Start the clock with the first sentence. At slide 3, switch to the app. Return to the deck at **2:55**, press → for slide 4, and end on slide 5.

| Time      | Screen                  | One thing to prove                                                   |
| --------- | ----------------------- | -------------------------------------------------------------------- |
| 0:00–0:25 | 1 · Problem             | Existing urban capacity is underused.                                |
| 0:25–0:40 | 2 · Solution            | A place can offer a specific right.                                  |
| 0:40–1:05 | App · Discover          | Search the city and see the relevant scope.                          |
| 1:05–1:50 | App · Define            | Issue a roof-specific use with a period and purpose.                 |
| 1:50–2:10 | App · Conflict          | A competing exclusive use is rejected.                               |
| 2:10–2:55 | App · Fund and activate | Buying funds the right; an independent operator action activates it. |
| 2:55–3:25 | 4 · Innovation          | Space × Time × Usage × Rights, enforced by a common protocol.        |
| 3:25–3:50 | 5 · Scale               | One rights model supports multiple assets and later markets.         |
| 3:50–4:00 | 5 · Closing             | Put dormant assets back to work.                                     |

## English narration

### 0:00–0:25 — Problem

> Tokyo already has the assets. What it lacks is a market for their unused capacity. Almost nine hundred thousand homes are vacant. The city also has unused land and roofs without solar panels. These are dated city statistics, not properties listed on our platform. The assets already exist. The market doesn't.

### 0:25–0:40 — Solution

> TOKENIZE TOKYO turns unused urban capacity into programmable rights that anyone can discover, fund and trade. A roof offers solar access and revenue rights. A vacant home offers workshop access. Let’s search the city.

### 0:40–1:05 — Discover

> These are fictional demo sites on a real basemap. Instead of searching a spreadsheet, you search the city itself. Filter for roofs with available rights. X-ray shows the roof, interior and wall as separate scopes in one building. Each can have a different use.

### 1:05–1:50 — Define

> The owner has already submitted this asset for demo verification. Now we define what this roof can provide: exclusive solar use, for a fixed period. This grants roof access, not ownership of the building. The verifier reviews the right separately. A solar revenue share can coexist with that usage right; it represents deposited income, not access to the roof.

### 1:50–2:10 — Conflict

> What if the owner tries to offer the same roof to a restaurant for overlapping dates? Spatial Right Conflict. The competing exclusive use is rejected. The Solidity protocol enforces this rule; this browser rehearsal simulates the same rejection.

### 2:10–2:55 — Fund and activate

> Now another user buys the revenue shares with test currency. The primary allocation is sold, and the project becomes Funded. That does not mean panels have been installed. Activation is a separate verifier action. In this simulated project, that action changes the map: the roof turns active and solar panels appear. This is the transition we want to make visible—from available capacity to productive use.

### 2:55–3:25 — Innovation

> We don't tokenize buildings. We tokenize what a city can do. The primitive is space, time, usage and rights. Contracts enforce verification, conflicts, trades and revenue accounting. Curvegrid indexes our actual testnet transactions and composes them for signing. ENS scoped issuance delegation and PLATEAU geometry are next steps. Today's map uses OpenStreetMap.

### 3:25–3:50 — Scale

> The same protocol supports roofs, vacant homes, idle land, parking, storage and advertising. Rights can then enter other markets. Revenue baskets and resale work in the local protocol. Fractional shares and rental access have separate interactive mocks. Funds, loans and collateral are future extensions. We’re creating a market for urban capacity that is hard to access today.

### 3:50–4:00 — Closing

> We don't tokenize Tokyo to speculate on it. We tokenize it to put dormant assets back to work.

## Exact app actions

### Prepare once in the fresh browser profile, before starting the clock

- Keep **Nihonbashi Solar Roof** (asset 1) and its seeded **Revenue Share #1**, with all 100 units still on the primary listing. Investor B starts with enough valueless mJPY for this demo. Do not activate the project yet.
- As **Owner A**, go to **Tokenize → Working on → Nihonbashi Solar Roof**. Use **Create another right → Usage Right → Terms & advanced settings** to create an **Interior / WORKSHOP** right. Set plain usage terms, one exclusive unit and a valid period. Issue it, switch to **Demo verifier**, and **Demo verify right**. Repeat for **Wall / ADVERTISING**. Both use the existing canonical scope model; there is no surveyed “2F” boundary.
- Do not issue the exclusive rooftop usage right yet; that is the live definition step. Keep the seeded revenue listing separate.
- Return as **Investor B** to **Explore**, with all stages selected. Preload the map tiles. This prepared verification state is part of the demo setup, not an action to claim happened during the presentation.

### Discover — 25 seconds

1. Select **Rooftop**, then **Lifecycle filter → Available**. The current UI has these controls; there is no separate “Verified + Funding Open” checkbox set. Existing tradable listings are verifier-approved.
2. Optionally toggle **Opportunity Lens** briefly: its many opportunity dots are a separate fictional candidate dataset, not verified listings or MultiBaas query results. The count is not platform adoption.
3. Switch to **City X-ray** and select Nihonbashi. The prepared roof, interior and wall scopes appear in one building. Keep narration on the space, not the form fields.

### Define — 45 seconds

1. Switch **Demo role → Owner A**, then **Tokenize → Working on → Nihonbashi Solar Roof**.
2. **Create another right → Usage Right**. Use today as start and a date ten years later as end; this rehearsal uses current dates. The deck’s 2027–2037 interval is an illustrative example.
3. Expand **Terms & advanced settings**, set **Rooftop**, **SOLAR**, **Exclusive usage: Yes**, and plain roof-access terms. Click **Review & publish → Issue right**.
4. Switch to **Demo verifier**, click **Demo verify right**, then switch back to **Owner A**. Right verification is distinct from asset verification.

### Conflict — 20 seconds

1. **Create another right**. Keep the same period, rooftop scope and exclusive usage. Change the purpose to **RESTAURANT**.
2. **Review & publish → Issue right**. Pause on **Spatial Right Conflict**. A rejected issuance must not create a token or a listing.

### Fund and activate — 45 seconds

1. Switch to **Investor B → Explore**. Change lifecycle to **All stages** now; otherwise a successfully funded asset would disappear from the Available filter.
2. Select Nihonbashi, review the terms, enter **100** under **Purchase quantity**, then **Acquire right**. Show **Funded**. In this prototype Funded means all issued units were sold by the issuer, not that real installation costs were independently certified.
3. Switch to **Demo verifier → Tokenize → Working on → Nihonbashi → Manage right → Revenue Share #1**. Click **Activate project**.
4. Return to **Explore** with X-ray on. Show **Active** and the panel geometry. Activation is simulated; do not imply that a purchase installed real hardware.

## Three-minute Q&A

Use [the short answers first](qa-cheatsheet.md); expand only when asked. Keep these screens ready:

- **Ownership / PLATEAU:** the UI’s simulated-verification notice; spatial data does not prove authority.
- **Why blockchain / conflicts:** `UrbanRightToken.findConflict` and the verified-asset linkage. Protection applies within this protocol, not to arbitrary external listings or legal contracts.
- **Revenue / secondary trading:** `RevenueVault` tests and Portfolio. A buyer does not receive the seller’s previously accrued revenue.
- **Curvegrid:** SDK / query / webhook code and the current connection status. Do not show simulated hashes as explorer receipts.
- **ENS:** the [namespace design](ENSV2_DESIGN.md) and [pitch content](pitch/ENS_IMPLEMENTATION.md). Name control, issuance permission and verifier authority are separate. Read adapter locally tested; delegated issuance is not implemented. Any aspirational “ENS Live” slide must be corrected or backed by real Sepolia evidence before presenting.
- **Financial potential:** Markets’ fractional and rental mock, then the actual local BasketVault custody path. No loan, collateral or guaranteed liquidity is implied.

## Reproducible rehearsal and recovery

Run `npx playwright test tests/pitch-demo.spec.ts --workers=1`. It uses an isolated browser context, prepares the interior/wall through normal UI actions, executes the roof/conflict/funding/activation flow, checks state transitions and captures screenshots in `test-results/`. Automated runtime is not a human speaking-time measurement.

If tiles fail, use the **Markets → All assets** directory and explain the unavailable map. Screenshots are backup evidence, not a live transaction. If a transaction stalls, describe the current state and move to the architecture slide; never switch to simulated mode without saying so. A completed human rehearsal remains necessary before presenting.

## Extended financial demo / Q&A (separate from the four-minute pitch)

1. **Explore / Markets → All assets**: show roofs, parking, advertising and vacant-home usage; select one revenue right and explain that it is not property ownership.
2. **Portfolio**: show units held, claimable deposited revenue, then claim. Explain that earlier accrued revenue remains with the seller after a transfer.
3. **Secondary sale**: list part of the holding; another actor purchases. The payment goes to the selling holder, not back to project funding.
4. **Compose**: a holder selects two compatible solar revenue rights, creates a fixed basket and deposits underlying units. Minted basket shares have actual custody backing in the deployed contract.
5. **Basket sale / redemption**: another actor purchases a basket share; redeem returns the underlying rights rather than promising cash liquidity. Show three real testnet basket scenarios in the receipt file if demonstrating with the browser simulation.
6. **Overview**: compare primary capital with secondary/Basket turnover and tokenized with activated assets. Follow the deposited/withdrawn money instead of showing an invented APY.
7. **Future markets**: show the explicitly labelled fractional/rental mocks. Explain the next step: joint governance of a held right and collateral-backed lending. Neither legal co-ownership nor a lending protocol is implemented.

Real-chain evidence: [receipts](../deployments/testnet-demo-receipts.json) and [verification](../deployments/testnet-demo-verification.json). In MultiBaas, **Blockchain → TX Explorer**, search the hash, inspect function/events. Do not paste simulated browser hashes into the explorer.

## Statistics and judging sources

Checked on 2026-09-26:

| Slide value   | Meaning and source                                                                                                                                                                                                                                                                     |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 896.5K        | 896,500 vacant homes in Tokyo, 2023; 214,200 exclude rental, sale and secondary homes. [TMG housing context, printed p.24](https://www.juutakuseisaku.metro.tokyo.lg.jp/documents/d/juutakuseisaku/r7-2_juuseishin_sannkou2#page=25). These are not all off-market or available.       |
| 1,303 ha      | Tokyo’s 23 wards, 2021, the survey category **未利用地等** (“unused land, etc.”). [TMG land-use survey](https://www.toshiseibi.metro.tokyo.lg.jp/about/chousa/tochi_c/tochi_kekka_r3). This is not a count of marketable plots.                                                        |
| 6.01%         | Panel installation rate for **detached houses**, FY2022, not all buildings or all suitable roofs. [TMG solar survey, printed p.1](https://www.kankyo.metro.tokyo.lg.jp/documents/d/kankyo/2026-01-08-111239-896#page=2). The suggested 6.8% was not verified for this population/year. |
| 4 + 3 minutes | Demo plus Q&A; Technicality, Originality, Practicality, Usability and WOW Factor. [ETHGlobal Tokyo 2026 guide](https://ethglobal.com/events/tokyo2026/info/details).                                                                                                                   |

Do not sum these different measures into TAM. They motivate the problem; they do not establish usable supply, customer demand or verified social impact.
