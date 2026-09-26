import type { AssetKind } from "./catalog";
export type Offer = {
  id: string;
  name: string;
  kind: AssetKind;
  mode: "fraction" | "rental";
  underlying: string;
  price: number;
  available: number;
  total: number;
  maxDays: number;
  provider: string;
};
export type FinanceState = {
  version: 1;
  cash: number;
  offers: Offer[];
  positions: { id: string; offerId: string; shares: number }[];
  resales: {
    id: string;
    offerId: string;
    shares: number;
    price: number;
    filled: boolean;
  }[];
  rentals: {
    id: string;
    offerId: string;
    days: number;
    endsAt: number;
    active: boolean;
    ownerRetainsToken: true;
  }[];
  sequence: number;
};
export function initialFinance(): FinanceState {
  return {
    version: 1,
    cash: 100000,
    sequence: 0,
    positions: [],
    resales: [],
    rentals: [],
    offers: [
      {
        id: "fraction-parking",
        name: "Akihabara Parking Right",
        kind: "Parking",
        mode: "fraction",
        underlying: "Demo parking right",
        price: 50,
        available: 600,
        total: 1000,
        maxDays: 0,
        provider: "Demo pool",
      },
      {
        id: "fraction-ad",
        name: "Ningyocho Advertising Right",
        kind: "Advertising",
        mode: "fraction",
        underlying: "Demo advertising right",
        price: 90,
        available: 240,
        total: 1000,
        maxDays: 0,
        provider: "Demo pool",
      },
      {
        id: "fraction-home",
        name: "Kuramae Workshop Right",
        kind: "Vacant Home",
        mode: "fraction",
        underlying: "Demo workshop right",
        price: 80,
        available: 350,
        total: 1000,
        maxDays: 0,
        provider: "Demo pool",
      },
      {
        id: "rental-storage",
        name: "Asakusabashi Storage Access",
        kind: "Storage",
        mode: "rental",
        underlying: "Demo storage usage right",
        price: 800,
        available: 1,
        total: 1,
        maxDays: 30,
        provider: "Demo holder",
      },
      {
        id: "rental-parking",
        name: "Akihabara Parking Access",
        kind: "Parking",
        mode: "rental",
        underlying: "Demo parking usage right",
        price: 600,
        available: 1,
        total: 1,
        maxDays: 14,
        provider: "Demo holder",
      },
      {
        id: "rental-land",
        name: "Yaesu Pop-up Access",
        kind: "Idle Land",
        mode: "rental",
        underlying: "Demo land usage right",
        price: 1200,
        available: 1,
        total: 1,
        maxDays: 7,
        provider: "Demo holder",
      },
    ],
  };
}
const integer = (n: number, max = 1e6) => {
  if (!Number.isSafeInteger(n) || n < 1 || n > max)
    throw new Error("Choose a valid whole amount.");
};
const debit = (s: FinanceState, n: number) => {
  integer(n, 1e12);
  if (s.cash < n) throw new Error("Not enough mock credits.");
  s.cash -= n;
};
function offer(s: FinanceState, id: string, mode: Offer["mode"]) {
  const o = s.offers.find((o) => o.id === id && o.mode === mode);
  if (!o) throw new Error("Offer unavailable.");
  return o;
}
export function buyFraction(input: FinanceState, id: string, shares: number) {
  integer(shares);
  const s = structuredClone(input),
    o = offer(s, id, "fraction");
  if (shares > o.available) throw new Error("Not enough shares.");
  debit(s, shares * o.price);
  o.available -= shares;
  const p = s.positions.find((p) => p.offerId === id);
  if (p) p.shares += shares;
  else
    s.positions.push({ id: "position-" + ++s.sequence, offerId: id, shares });
  return s;
}
export function listFraction(
  input: FinanceState,
  id: string,
  shares: number,
  price: number,
) {
  integer(shares);
  integer(price);
  const s = structuredClone(input),
    p = s.positions.find((p) => p.id === id);
  if (!p || p.shares < shares)
    throw new Error("You cannot list more shares than you own.");
  p.shares -= shares;
  s.resales.push({
    id: "resale-" + ++s.sequence,
    offerId: p.offerId,
    shares,
    price,
    filled: false,
  });
  return s;
}
export function fillResale(input: FinanceState, id: string) {
  const s = structuredClone(input),
    r = s.resales.find((r) => r.id === id && !r.filled);
  if (!r) throw new Error("Resale already settled or unavailable.");
  r.filled = true;
  s.cash += r.shares * r.price;
  return s;
}
export function rentRight(
  input: FinanceState,
  id: string,
  days: number,
  now = Date.now(),
) {
  integer(days);
  const s = structuredClone(input),
    o = offer(s, id, "rental");
  if (days > o.maxDays || o.available < 1)
    throw new Error("This usage period is unavailable.");
  debit(s, days * o.price);
  o.available = 0;
  s.rentals.push({
    id: "rental-" + ++s.sequence,
    offerId: id,
    days,
    endsAt: now + days * 86400000,
    active: true,
    ownerRetainsToken: true,
  });
  return s;
}
export function returnRental(input: FinanceState, id: string) {
  const s = structuredClone(input),
    r = s.rentals.find((r) => r.id === id && r.active);
  if (!r) throw new Error("Rental is already closed.");
  r.active = false;
  offer(s, r.offerId, "rental").available = 1;
  return s;
}
export function createMockOffer(
  input: FinanceState,
  source: { id: string; name: string; kind: AssetKind },
  mode: Offer["mode"],
  price: number,
) {
  integer(price);
  const s = structuredClone(input);
  if (s.offers.some((o) => o.underlying === source.id && o.mode === mode))
    throw new Error("A mock market for this right already exists.");
  s.offers.unshift({
    id: "created-" + ++s.sequence,
    name: source.name,
    kind: source.kind,
    mode,
    underlying: source.id,
    price,
    available: mode === "fraction" ? 1000 : 1,
    total: mode === "fraction" ? 1000 : 1,
    maxDays: 30,
    provider: "Your mock market",
  });
  return s;
}
