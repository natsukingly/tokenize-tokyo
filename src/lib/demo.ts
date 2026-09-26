import { assetTypeCode, SPACE_TYPES, type AssetKind } from "./catalog";
import { parseEther, keccak256, stringToHex } from "viem";
import { z } from "zod";
import { metadataURI, type ChainEvent, type MarketState } from "./model";
import { project } from "./projection";
import type { ContractKey } from "./config";
export const ACTORS = {
  "Owner A": "0x000000000000000000000000000000000000000a",
  "Investor B": "0x000000000000000000000000000000000000000b",
  "Investor C": "0x000000000000000000000000000000000000000c",
  "Demo verifier": "0x000000000000000000000000000000000000000d",
};
export const DEMO_ADDRESSES: Record<ContractKey, string> = {
  registry: "0x0000000000000000000000000000000000000011",
  rights: "0x0000000000000000000000000000000000000012",
  market: "0x0000000000000000000000000000000000000013",
  revenue: "0x0000000000000000000000000000000000000014",
  basket: "0x0000000000000000000000000000000000000015",
  settlement: "0x0000000000000000000000000000000000000016",
};
export { DEMO_SITES } from "./demo-catalog";
import { DEMO_SITES, DEMO_CATALOG_VERSION } from "./demo-catalog";
const KEY = "tokenize-tokyo-demo-v2";
// Only externally changed storage needs a full validation/projection. Each load
// still parses a fresh object, so callers cannot mutate a cached store.
let validatedSnapshot: string | null = null;
type Store = {
  events: ChainEvent[];
  balances: Record<string, string>;
  cash: Record<string, string>;
  claims: Record<string, string>;
  catalogVersion?: number;
  showcaseVersion?: number;
};
const savedAmounts = z.record(z.string(), z.string().regex(/^\d{1,78}$/));
const savedStore = z.object({
  events: z.array(
    z.object({
      contract: z.enum([
        "registry",
        "rights",
        "market",
        "revenue",
        "basket",
        "settlement",
      ]),
      name: z.string(),
      args: z.record(z.string(), z.unknown()),
      block: z.number().int().nonnegative(),
      txHash: z.string(),
      timestamp: z.string(),
    }),
  ),
  balances: savedAmounts,
  cash: savedAmounts,
  claims: savedAmounts,
  catalogVersion: z.number().int().nonnegative().optional(),
  showcaseVersion: z.number().int().nonnegative().optional(),
});
const bkey = (who: string, token: string, id: string) =>
  who.toLowerCase() + ":" + token + ":" + id;
function emit(
  s: Store,
  contract: ContractKey,
  name: string,
  args: Record<string, unknown>,
) {
  const n = s.events.length + 1;
  s.events.push({
    contract,
    name,
    args,
    block: n,
    txHash: keccak256(stringToHex("simulation-" + n)),
    timestamp: new Date().toISOString(),
  });
}
function seed(): Store {
  const s: Store = { events: [], balances: {}, cash: {}, claims: {} };
  for (const who of Object.values(ACTORS))
    s.cash[who] = parseEther("1000000").toString();
  DEMO_SITES.forEach((site, i) => seedSite(s, site, i));
  s.catalogVersion = DEMO_CATALOG_VERSION;
  return s;
}
function seedSite(s: Store, site: (typeof DEMO_SITES)[number], index: number) {
  const eventStart = s.events.length;
  const next = (name: string, key: string) =>
    String(
      Math.max(
        0,
        ...s.events
          .filter((e) => e.name === name)
          .map((e) => Number(e.args[key])),
      ) + 1,
    );
  const aid = next("AssetRegistered", "assetId"),
    id = next("RightCreated", "rightId"),
    listingId = next("ListingCreated", "listingId"),
    issuer = ACTORS["Owner A"],
    solar = site.kind === "Rooftop" || !!site.revenue,
    t = SPACE_TYPES[site.kind];
  emit(s, "registry", "AssetRegistered", {
    assetId: aid,
    issuer,
    geoReference: keccak256(stringToHex("simulated-catalog-" + site.name)),
    metadataURI: metadataURI({ ...site, simulated: true }),
    assetType: assetTypeCode(site.kind),
  });
  emit(s, "registry", "AssetVerificationRequested", { assetId: aid });
  emit(s, "registry", "AssetVerified", {
    assetId: aid,
    verifier: ACTORS["Demo verifier"],
  });
  const days =
    site.kind === "Parking" || site.kind === "Advertising"
      ? 30
      : site.kind === "Storage"
        ? 90
        : 365;
  const terms = metadataURI({
    purpose: site.revenue
      ? `Proportional share of income deposited by this fictional ${site.kind.toLowerCase()} project. No usage permission or guaranteed return.`
      : t.terms,
    evidence: "Simulated verification. Not property ownership.",
  });
  emit(s, "rights", "RightCreated", {
    rightId: id,
    assetId: aid,
    issuer,
    rightType: solar ? 1 : 0,
    supply: solar ? "100" : "1",
    termsURI: terms,
    termsHash: keccak256(stringToHex(terms)),
    startAt:
      Math.floor(Date.now() / 1000) -
      (site.historyDay === undefined ? 100 : 30 * 86400),
    endAt: Math.floor(Date.now() / 1000) + days * 86400,
    transferPolicy: 0,
  });
  emit(s, "rights", "RightScopeDefined", {
    rightId: id,
    assetId: aid,
    scope: ["Rooftop", "Interior", "Wall", "Land", "Whole asset"].indexOf(
      t.scope,
    ),
    purpose: keccak256(stringToHex(t.purpose)),
    exclusive: !solar,
  });
  emit(s, "rights", "RightVerified", { rightId: id, approved: true });
  if (site.activated) {
    // Already-operating demo projects can list rights without a prior fundraise.
    // Activation alone never creates a sale, deposit or claimable revenue.
    emit(s, "rights", "RightActivated", { rightId: id, assetId: aid });
  }
  s.balances[bkey(issuer, "rights", id)] = solar ? "100" : "1";
  emit(s, "market", "ListingCreated", {
    listingId,
    seller: issuer,
    token: DEMO_ADDRESSES.rights,
    rightId: id,
    amount: solar ? "100" : "1",
    unitPrice: parseEther(index === 1 ? "1800" : t.price).toString(),
  });
  if (site.historyDay !== undefined) {
    for (let i = eventStart; i < s.events.length; i++)
      s.events[i].timestamp = new Date(
        Date.now() - 29 * 86400000,
      ).toISOString();
  }
  if (site.historyDay !== undefined && solar) {
    // Explicit fictional activity with matching balances and test-token payments.
    const buyer = "0x00000000000000000000000000000000000000f1";
    const second = "0x00000000000000000000000000000000000000f2";
    const sold = BigInt(site.subscribed || 0);
    const price = parseEther(t.price);
    for (const [who, units] of [
      [buyer, sold / 2n],
      [second, sold - sold / 2n],
    ] as const) {
      if (!units) continue;
      s.cash[who] = (
        BigInt(s.cash[who] || parseEther("1000000000").toString()) -
        units * price
      ).toString();
      s.cash[issuer] = (BigInt(s.cash[issuer]) + units * price).toString();
      s.balances[bkey(who, "rights", id)] = units.toString();
      emit(s, "market", "ListingPurchased", {
        listingId,
        buyer: who,
        seller: issuer,
        token: DEMO_ADDRESSES.rights,
        rightId: id,
        amount: units.toString(),
        totalPrice: (units * price).toString(),
      });
      s.events.at(-1)!.timestamp = new Date(
        Date.now() - site.historyDay * 86400000,
      ).toISOString();
    }
    s.balances[bkey(issuer, "rights", id)] = (100n - sold).toString();
    if (site.activated) {
      for (let week = 0; week <= Math.floor(site.historyDay / 7); week++) {
        const amount = parseEther(String(500 + (index % 9) * 150));
        s.cash[issuer] = (BigInt(s.cash[issuer]) - amount).toString();
        for (const who of [issuer, buyer, second]) {
          const key = bkey(who, "rights", id);
          s.claims[key] = (
            BigInt(s.claims[key] || "0") +
            (amount * BigInt(s.balances[key] || "0")) / 100n
          ).toString();
        }
        emit(s, "revenue", "RevenueDeposited", {
          rightId: id,
          depositor: issuer,
          amount: amount.toString(),
        });
        const daysAgo = site.historyDay - week * 7;
        s.events.at(-1)!.timestamp = new Date(
          Date.now() - daysAgo * 86400000,
        ).toISOString();
      }
    }
  }
}
function load(): Store {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(KEY);
    if (raw) {
      const known = raw === validatedSnapshot;
      const s: Store = known
        ? JSON.parse(raw)
        : savedStore.parse(JSON.parse(raw));
      // Validate numeric event payloads before they reach rendering/analytics.
      const existing =
        !known || (s.catalogVersion || 0) < DEMO_CATALOG_VERSION
          ? project(s.events, DEMO_ADDRESSES.rights).assets
          : [];
      validatedSnapshot = raw;
      if ((s.catalogVersion || 0) < DEMO_CATALOG_VERSION) {
        // Append the new use cases without clearing user-created assets, holdings or history.
        DEMO_SITES.forEach((site, i) => {
          if (!existing.some((a) => a.name === site.name)) seedSite(s, site, i);
        });
        s.catalogVersion = DEMO_CATALOG_VERSION;
        save(s);
      }
      return s;
    }
  } catch {
    // Keep the unreadable snapshot for recovery; never erase a valid history.
    if (raw)
      try {
        localStorage.setItem(`${KEY}:recovery`, raw);
      } catch {}
  }
  const initial = seed();
  save(initial);
  return initial;
}
function save(s: Store) {
  const raw = JSON.stringify(s);
  localStorage.setItem(KEY, raw);
  validatedSnapshot = raw;
}
export function resetDemo() {
  localStorage.removeItem(KEY);
  validatedSnapshot = null;
}

// An explicit, repeat-safe historical scenario. Never used by the live MultiBaas adapter.
export function addDemoActivity(): boolean {
  const initial = load();
  if (initial.showcaseVersion === 1) return false;
  save(initial);
  const owner = ACTORS["Owner A"],
    investor = ACTORS["Investor C"],
    exampleBuyer = "0x000000000000000000000000000000000000000e";
  const started = initial.events.length;
  const now = Date.now(),
    day = 86400000,
    today = Math.floor(now / day) * day;
  const stampNew = (from: number, daysAgo: number) => {
    const s = load();
    const timestamp = new Date(
      Math.min(now, today - daysAgo * day + 10 * 3600000),
    ).toISOString();
    for (let i = from; i < s.events.length; i++)
      s.events[i].timestamp = timestamp;
    save(s);
  };
  try {
    demoCall(owner, "settlement", "mint", [
      owner,
      parseEther("300000").toString(),
    ]);
    demoCall(exampleBuyer, "settlement", "mint", [
      exampleBuyer,
      parseEther("300000").toString(),
    ]);
    const ids: string[] = [],
      listings: string[] = [];
    for (const [kind, name, coordinates] of [
      ["Rooftop", "Example · Kanda Solar Income", [139.7694, 35.6942]],
      ["Parking", "Example · Akihabara Parking Income", [139.7744, 35.6984]],
      [
        "Advertising",
        "Example · Ningyocho Advertising Income",
        [139.7832, 35.6861],
      ],
    ] as const) {
      demoCall(owner, "registry", "registerAsset", [
        keccak256(stringToHex(name)),
        metadataURI({
          name,
          kind,
          coordinates,
          district: "TOKYO · HISTORICAL DEMO",
          area: 100,
          capacity: kind === "Rooftop" ? 20 : 0,
          description:
            "Fictional operating project with simulated trades and deposited revenue. Example history, not real performance.",
          simulated: true,
        }),
        assetTypeCode(kind),
      ]);
      const assetId = demoState(owner).assets.at(-1)!.id;
      demoCall(owner, "registry", "requestVerification", [assetId]);
      demoCall(ACTORS["Demo verifier"], "registry", "verifyAsset", [
        assetId,
        true,
      ]);
      const terms = metadataURI({
        purpose: `Proportional share of revenue deposited by this fictional ${kind.toLowerCase()} project. No usage permission or guaranteed return.`,
        simulated: true,
      });
      demoCall(owner, "rights", "createRight", [
        assetId,
        1,
        "100",
        terms,
        keccak256(stringToHex(terms)),
        Math.floor((today - 30 * day) / 1000),
        Math.floor((now + 365 * day) / 1000),
        0,
      ]);
      const rightId = demoState(owner).rights.at(-1)!.id;
      demoCall(ACTORS["Demo verifier"], "rights", "verifyRight", [
        rightId,
        true,
      ]);
      demoCall(ACTORS["Demo verifier"], "rights", "activateRight", [rightId]);
      demoCall(owner, "market", "createListing", [
        DEMO_ADDRESSES.rights,
        rightId,
        "100",
        parseEther("1000").toString(),
      ]);
      ids.push(rightId);
      listings.push(demoState(owner).listings.at(-1)!.id);
    }
    stampNew(started, 28);
    for (let daysAgo = 27; daysAgo >= 0; daysAgo--) {
      const before = load().events.length;
      for (let i = 0; i < ids.length; i++) {
        demoCall(investor, "market", "purchase", [listings[i], "1"]);
        demoCall(owner, "revenue", "depositRevenue", [
          ids[i],
          parseEther(
            String(120 + i * 45 + ((27 - daysAgo) % 5) * 20),
          ).toString(),
        ]);
      }
      if (daysAgo % 3 === 0) {
        const rightId = ids[Math.floor(daysAgo / 3) % ids.length];
        demoCall(investor, "market", "createListing", [
          DEMO_ADDRESSES.rights,
          rightId,
          "1",
          parseEther("1100").toString(),
        ]);
        demoCall(exampleBuyer, "market", "purchase", [
          demoState(investor).listings.at(-1)!.id,
          "1",
        ]);
        demoCall(investor, "revenue", "claim", [rightId]);
      }
      stampNew(before, daysAgo);
    }
    demoCall(investor, "basket", "createBasket", [
      ids,
      ["1", "1", "1"],
      metadataURI({
        name: "Tokyo Mixed Income Basket · Example",
        simulated: true,
      }),
    ]);
    const basketId = demoState(investor).baskets.at(-1)!.id;
    demoCall(investor, "basket", "depositUnderlying", [basketId, "10"]);
    demoCall(investor, "market", "createListing", [
      DEMO_ADDRESSES.basket,
      basketId,
      "5",
      parseEther("3500").toString(),
    ]);
    demoCall(exampleBuyer, "market", "purchase", [
      demoState(investor).listings.at(-1)!.id,
      "2",
    ]);
    for (const id of ids)
      demoCall(owner, "revenue", "depositRevenue", [
        id,
        parseEther("500").toString(),
      ]);
    const complete = load();
    complete.showcaseVersion = 1;
    save(complete);
    return true;
  } catch (error) {
    save(initial);
    throw error;
  }
}
export function demoState(account: string): MarketState {
  const s = load(),
    state = project(s.events, DEMO_ADDRESSES.rights);
  state.cash = s.cash[account] || "0";
  for (const token of ["rights", "basket"])
    for (const item of token === "rights" ? state.rights : state.baskets) {
      state.balances[token + ":" + item.id] =
        s.balances[bkey(account, token, item.id)] || "0";
      state.claimable[token + ":" + item.id] =
        s.claims[bkey(account, token, item.id)] || "0";
    }
  return state;
}
export function demoCall(
  account: string,
  contract: ContractKey,
  method: string,
  args: unknown[],
): string {
  const s = load(),
    state = project(s.events, DEMO_ADDRESSES.rights);
  const [a, b, c, d] = args;
  const id = String(a);
  const require = (yes: unknown, message: string) => {
    if (!yes) throw new Error(message);
  };
  const verifier = () =>
    require(account ===
      ACTORS[
        "Demo verifier"
      ], "Switch to Demo verifier to verify or activate.");
  const balance = (who: string, token: string, id: string) =>
    BigInt(s.balances[bkey(who, token, id)] || "0");
  const move = (
    who: string,
    to: string,
    token: string,
    id: string,
    amount: bigint,
  ) => {
    require(amount > 0n &&
      balance(who, token, id) >= amount, "Insufficient rights");
    s.balances[bkey(who, token, id)] = (
      balance(who, token, id) - amount
    ).toString();
    s.balances[bkey(to, token, id)] = (
      balance(to, token, id) + amount
    ).toString();
    emit(
      s,
      token === "rights" ? "rights" : "basket",
      token === "rights" ? "TransferSingle" : "BasketTransferSingle",
      { from: who, to, id, value: amount.toString(), operator: account },
    );
  };
  const pay = (from: string, to: string, amount: bigint) => {
    const available = BigInt(s.cash[from] || "0");
    require(amount > 0n &&
      available >= amount, "Insufficient Mock JPY. Use the test faucet.");
    s.cash[from] = (available - amount).toString();
    s.cash[to] = (BigInt(s.cash[to] || "0") + amount).toString();
  };
  const mint = (token: string, id: string, amount: bigint) => {
    s.balances[bkey(account, token, id)] = (
      balance(account, token, id) + amount
    ).toString();
  };
  const asset = state.assets.find((x) => x.id === id),
    right = state.rights.find((x) => x.id === id);
  const conflict = (
    assetId: string,
    scope: number,
    start: number,
    end: number,
    exclusive: boolean,
  ) =>
    state.rights.find(
      (r) =>
        r.assetId === assetId &&
        r.kind !== "Revenue Share" &&
        ["Verified", "Active"].includes(r.status) &&
        (r.exclusive || exclusive) &&
        (r.scope === scope || scope === 4 || r.scope === 4) &&
        start < r.endAt &&
        r.startAt < end,
    );
  if (method === "approve" || method === "setApprovalForAll")
    return "simulation-approval";
  if (contract === "settlement" && method === "mint") {
    s.cash[String(a)] = (
      BigInt(s.cash[String(a)] || "0") + BigInt(String(b))
    ).toString();
  } else if (contract === "registry" && method === "registerAsset") {
    emit(s, "registry", "AssetRegistered", {
      assetId: String(state.assets.length + 1),
      issuer: account,
      geoReference: a,
      metadataURI: b,
      assetType: c,
    });
  } else if (contract === "registry" && method === "requestVerification") {
    require(asset?.issuer === account &&
      asset.status === "Draft", "Only draft issuer can submit");
    emit(s, "registry", "AssetVerificationRequested", { assetId: id });
  } else if (contract === "registry" && method === "verifyAsset") {
    verifier();
    require(asset?.status === "Pending verification", "Not pending");
    require(!b ||
      !state.assets.some(
        (x) =>
          x.id !== id &&
          x.status === "Verified" &&
          x.geoReference === asset?.geoReference,
      ), "Canonical space already verified");
    emit(s, "registry", b ? "AssetVerified" : "AssetRejected", {
      assetId: id,
      verifier: account,
    });
  } else if (contract === "rights" && method === "createScopedRight") {
    const q = a as unknown[];
    const aid = String(q[0]),
      source = state.assets.find((x) => x.id === aid);
    require(source?.issuer === account &&
      source.status === "Verified", "Verified issuer required");
    const start = Number(q[5]),
      end = Number(q[6]),
      scope = Number(q[8]),
      exclusive = Boolean(q[10]);
    require(!exclusive ||
      BigInt(String(q[2])) === 1n, "Exclusive usage is indivisible");
    require(Number(q[1]) === 1 ||
      !conflict(
        aid,
        scope,
        start,
        end,
        exclusive,
      ), "REJECTED — Spatial Right Conflict: overlapping exclusive space and time.");
    const rid = String(state.rights.length + 1);
    emit(s, "rights", "RightCreated", {
      rightId: rid,
      assetId: aid,
      issuer: account,
      rightType: q[1],
      supply: q[2],
      termsURI: q[3],
      termsHash: q[4],
      startAt: start,
      endAt: end,
      transferPolicy: q[7],
    });
    emit(s, "rights", "RightScopeDefined", {
      rightId: rid,
      assetId: aid,
      scope,
      purpose: q[9],
      exclusive,
    });
    mint("rights", rid, BigInt(String(q[2])));
  } else if (contract === "rights" && method === "createRight") {
    require(asset?.issuer === account &&
      asset.status ===
        "Verified", "A verified asset and its issuer are required");
    const rid = String(state.rights.length + 1);
    require(BigInt(String(c)) > 0n, "Supply must be positive");
    emit(s, "rights", "RightCreated", {
      rightId: rid,
      assetId: a,
      issuer: account,
      rightType: b,
      supply: c,
      termsURI: d,
      termsHash: args[4],
      startAt: args[5],
      endAt: args[6],
      transferPolicy: args[7],
    });
    mint("rights", rid, BigInt(String(c)));
  } else if (contract === "rights" && method === "verifyRight") {
    verifier();
    require(right?.status === "Pending verification", "Not pending");
    require(!b ||
      right?.kind === "Revenue Share" ||
      !conflict(
        right!.assetId,
        right!.scope,
        right!.startAt,
        right!.endAt,
        right!.exclusive,
      ), "REJECTED — Spatial Right Conflict");
    emit(s, "rights", "RightVerified", { rightId: id, approved: b });
  } else if (contract === "rights" && method === "activateRight") {
    verifier();
    require(right?.status === "Verified", "Not verified");
    emit(s, "rights", "RightActivated", {
      rightId: id,
      assetId: right?.assetId,
    });
  } else if (contract === "market" && method === "createListing") {
    const token = String(a) === DEMO_ADDRESSES.rights ? "rights" : "basket",
      rid = String(b),
      r = state.rights.find((x) => x.id === rid);
    require(token === "basket" ||
      ((r?.status === "Verified" || r?.status === "Active") &&
        r.policy !== "Nontransferable"), "Unverified or restricted right");
    require(balance(account, token, rid) >= BigInt(String(c)) &&
      BigInt(String(c)) > 0n &&
      BigInt(String(d)) > 0n, "Invalid quantity or price");
    emit(s, "market", "ListingCreated", {
      listingId: String(state.listings.length + 1),
      seller: account,
      token: a,
      rightId: rid,
      amount: c,
      unitPrice: d,
    });
  } else if (contract === "market" && method === "purchase") {
    const l = state.listings.find((x) => x.id === id),
      amount = BigInt(String(b));
    require(l &&
      !l.cancelled &&
      l.seller !== account &&
      amount > 0n &&
      amount <= BigInt(l.remaining), "Invalid listing");
    pay(account, l!.seller, amount * BigInt(l!.unitPrice));
    move(l!.seller, account, l!.token, l!.rightId, amount);
    emit(s, "market", "ListingPurchased", {
      listingId: id,
      buyer: account,
      seller: l!.seller,
      token: DEMO_ADDRESSES[l!.token],
      rightId: l!.rightId,
      amount: String(b),
      totalPrice: (amount * BigInt(l!.unitPrice)).toString(),
    });
  } else if (contract === "market" && method === "cancelListing") {
    const l = state.listings.find((x) => x.id === id);
    require(l?.seller === account &&
      !l.cancelled, "Not an active seller listing");
    emit(s, "market", "ListingCancelled", { listingId: id, seller: account });
  } else if (contract === "revenue" && method === "depositRevenue") {
    require(right?.kind === "Revenue Share" &&
      right.status === "Active", "Activate the solar project first");
    const amount = BigInt(String(b));
    pay(account, DEMO_ADDRESSES.revenue, amount);
    const supply = BigInt(right!.supply);
    for (const [key, quantity] of Object.entries(s.balances)) {
      if (key.endsWith(":rights:" + id))
        s.claims[key] = (
          BigInt(s.claims[key] || "0") +
          (amount * BigInt(quantity)) / supply
        ).toString();
    }
    // Distribute custodial earnings to current basket holders, preserving previously accrued claims.
    for (const basket of state.baskets.filter((x) => x.rightIds.includes(id))) {
      const key = bkey(DEMO_ADDRESSES.basket, "rights", id),
        earned = BigInt(s.claims[key] || "0");
      const holders = Object.entries(s.balances).filter(([k]) =>
          k.endsWith(":basket:" + basket.id),
        ),
        total = holders.reduce((n, [, v]) => n + BigInt(v), 0n);
      if (total > 0n) {
        for (const [k, v] of holders)
          s.claims[k] = (
            BigInt(s.claims[k] || "0") +
            (earned * BigInt(v)) / total
          ).toString();
        s.claims[key] = "0";
      }
    }
    emit(s, "revenue", "RevenueDeposited", {
      rightId: id,
      operator: account,
      amount: String(b),
    });
  } else if (method === "claim" || method === "claimRevenue") {
    const token = contract === "revenue" ? "rights" : "basket",
      key = bkey(account, token, id),
      amount = BigInt(s.claims[key] || "0");
    require(amount > 0n, "No deposited revenue to claim");
    pay(DEMO_ADDRESSES.revenue, account, amount);
    s.claims[key] = "0";
    emit(
      s,
      contract,
      token === "rights" ? "RevenueClaimed" : "BasketRevenueClaimed",
      {
        [token === "rights" ? "rightId" : "basketId"]: id,
        holder: account,
        amount: amount.toString(),
      },
    );
  } else if (contract === "basket" && method === "createBasket") {
    const ids = a as string[],
      units = b as string[];
    require(ids.length >= 2 &&
      new Set(ids).size ===
        ids.length, "Select at least two distinct revenue rights");
    for (let i = 0; i < ids.length; i++) {
      const r = state.rights.find((x) => x.id === ids[i]);
      require(r?.kind === "Revenue Share" &&
        r.policy === "Open" &&
        (r.status === "Verified" || r.status === "Active") &&
        balance(account, "rights", ids[i]) >= BigInt(units[i]) &&
        !state.baskets.some((x) =>
          x.rightIds.includes(ids[i]),
        ), "Incompatible or already pooled underlying");
    }
    emit(s, "basket", "BasketCreated", {
      basketId: String(state.baskets.length + 1),
      creator: account,
      rightIds: ids,
      unitsPerShare: units,
      metadataURI: c,
    });
  } else if (
    contract === "basket" &&
    (method === "depositUnderlying" || method === "mintBasketShares")
  ) {
    const basket = state.baskets.find((x) => x.id === id),
      shares = BigInt(String(b));
    require(basket && shares > 0n, "Invalid basket");
    basket!.rightIds.forEach((rid, i) => {
      const amount = shares * BigInt(basket!.units[i]);
      move(account, DEMO_ADDRESSES.basket, "rights", rid, amount);
      emit(s, "basket", "UnderlyingDeposited", {
        basketId: id,
        holder: account,
        rightId: rid,
        amount: amount.toString(),
      });
    });
    mint("basket", id, shares);
    emit(s, "basket", "BasketMinted", {
      basketId: id,
      holder: account,
      shares: shares.toString(),
    });
  } else if (contract === "basket" && method === "redeem") {
    const basket = state.baskets.find((x) => x.id === id),
      shares = BigInt(String(b));
    require(basket &&
      shares > 0n &&
      balance(account, "basket", id) >= shares, "Insufficient basket shares");
    s.balances[bkey(account, "basket", id)] = (
      balance(account, "basket", id) - shares
    ).toString();
    basket!.rightIds.forEach((rid, i) =>
      move(
        DEMO_ADDRESSES.basket,
        account,
        "rights",
        rid,
        shares * BigInt(basket!.units[i]),
      ),
    );
    emit(s, "basket", "BasketRedeemed", {
      basketId: id,
      holder: account,
      shares: shares.toString(),
    });
  } else throw new Error("Unsupported simulation action: " + method);
  save(s);
  return s.events.at(-1)?.txHash || "simulation";
}
