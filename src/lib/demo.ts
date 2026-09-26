import { parseEther, keccak256, stringToHex } from "viem";
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
export const DEMO_SITES = [
  {
    name: "Nihonbashi Solar Roof",
    district: "NIHONBASHI · CHUO",
    coordinates: [139.7748, 35.6842] as [number, number],
    area: 420,
    capacity: 72,
    description:
      "An underused rooftop can become a neighborhood source of clean energy.",
    kind: "Rooftop",
  },
  {
    name: "Kanda Community Solar",
    district: "KANDA · CHIYODA",
    coordinates: [139.769, 35.694] as [number, number],
    area: 310,
    capacity: 48,
    description:
      "Turn unused roof space into a community-funded solar project.",
    kind: "Rooftop",
  },
  {
    name: "Kuramae Makers House",
    district: "KURAMAE · TAITO",
    coordinates: [139.7892, 35.7034] as [number, number],
    area: 96,
    capacity: 0,
    description:
      "A simulated vacant space, reimagined as a neighborhood workshop. No residential or property ownership is sold.",
    kind: "Vacant Home",
  },
];
const KEY = "tokenize-tokyo-demo-v2";
type Store = {
  events: ChainEvent[];
  balances: Record<string, string>;
  cash: Record<string, string>;
  claims: Record<string, string>;
};
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
  DEMO_SITES.forEach((site, i) => {
    const id = String(i + 1),
      issuer = ACTORS["Owner A"];
    emit(s, "registry", "AssetRegistered", {
      assetId: id,
      issuer,
      geoReference: keccak256(stringToHex("simulated-" + id)),
      metadataURI: metadataURI({ ...site, simulated: true }),
      assetType: i === 2 ? 1 : 0,
    });
    emit(s, "registry", "AssetVerificationRequested", { assetId: id });
    emit(s, "registry", "AssetVerified", {
      assetId: id,
      verifier: ACTORS["Demo verifier"],
    });
    emit(s, "rights", "RightCreated", {
      rightId: id,
      assetId: id,
      issuer,
      rightType: i === 2 ? 0 : 1,
      supply: i === 2 ? "1" : "100",
      termsURI: metadataURI({
        purpose:
          i === 2
            ? "Community workshop only; no structural alterations. Repairs require issuer approval."
            : "Proportional share of settlement tokens actually deposited. No guaranteed return.",
        evidence: "Simulated verification. Not property ownership.",
      }),
      termsHash: keccak256(stringToHex("demo-terms-" + id)),
      startAt: Math.floor(Date.now() / 1000) - 100,
      endAt: Math.floor(Date.now() / 1000) + 365 * 86400,
      transferPolicy: 0,
    });
    emit(s, "rights", "RightScopeDefined", {
      rightId: id,
      assetId: id,
      scope: i === 2 ? 1 : 0,
      purpose: keccak256(stringToHex(i === 2 ? "WORKSHOP" : "SOLAR")),
      exclusive: i === 2,
    });
    emit(s, "rights", "RightVerified", { rightId: id, approved: true });
    s.balances[bkey(issuer, "rights", id)] = i === 2 ? "1" : "100";
    emit(s, "market", "ListingCreated", {
      listingId: id,
      seller: issuer,
      token: DEMO_ADDRESSES.rights,
      rightId: id,
      amount: i === 2 ? "1" : "100",
      unitPrice: parseEther(
        i === 2 ? "80000" : i === 0 ? "2400" : "1800",
      ).toString(),
    });
  });
  return s;
}
function load(): Store {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as Store;
  } catch {}
  return seed();
}
function save(s: Store) {
  localStorage.setItem(KEY, JSON.stringify(s));
}
export function resetDemo() {
  localStorage.removeItem(KEY);
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
        ids.length, "Select at least two distinct solar rights");
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
