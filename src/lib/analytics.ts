import { ASSET_KINDS } from "./catalog";
import type { MarketState } from "./model";

const equal = (a: unknown, b: unknown) =>
  String(a).toLowerCase() === String(b).toLowerCase();
export function marketAnalytics(
  state: MarketState,
  rightsAddress: string,
  now = Date.now(),
  period: "daily" | "weekly" = "daily",
) {
  const current = state.rights.filter(
    (r) => ["Verified", "Active"].includes(r.status) && r.endAt > now / 1000,
  );
  const active = new Set(
    current
      .filter((r) => r.status === "Active" && r.startAt <= now / 1000)
      .map((r) => r.assetId),
  );
  const allocated = new Set<string>();
  let primaryVolume = 0n,
    secondaryVolume = 0n,
    basketVolume = 0n,
    unmatchedVolume = 0n;
  const netPrimary = new Map<string, bigint>();
  const today = Math.floor(now / 86400000) * 86400000;
  const weekly = period === "weekly";
  const count = weekly ? 4 : 7;
  const step = (weekly ? 7 : 1) * 86400000;
  const currentStart = weekly
    ? today - ((new Date(today).getUTCDay() + 6) % 7) * 86400000
    : today;
  const daily = Array.from({ length: count }, (_, i) => ({
    day: new Date(currentStart - (count - 1 - i) * step)
      .toISOString()
      .slice(0, 10),
    volume: 0n,
    revenue: 0n,
  }));
  const revenueRights = new Set<string>();
  for (const event of state.events) {
    const date = Date.parse(event.timestamp);
    const bucket = Number.isFinite(date)
      ? daily.find(
          (d) => date >= Date.parse(d.day) && date < Date.parse(d.day) + step,
        )
      : undefined;
    if (event.name === "RevenueDeposited") {
      const amount = BigInt(String(event.args.amount));
      if (amount > 0n) revenueRights.add(String(event.args.rightId));
      if (bucket) bucket.revenue += amount;
    }
    if (event.name !== "ListingPurchased") continue;
    const amount = BigInt(String(event.args.amount));
    const value = BigInt(String(event.args.totalPrice));
    if (bucket) bucket.volume += value;
    const listing = state.listings.find(
      (l) => l.id === String(event.args.listingId),
    );
    if (listing?.token === "basket") {
      basketVolume += value;
      continue;
    }
    const right = state.rights.find((r) => r.id === String(event.args.rightId));
    if (!equal(event.args.token, rightsAddress) || !right) {
      unmatchedVolume += value;
      continue;
    }
    const fromIssuer = equal(event.args.seller, right.issuer);
    const toIssuer = equal(event.args.buyer, right.issuer);
    if (fromIssuer) primaryVolume += value;
    else secondaryVolume += value;
    netPrimary.set(
      right.id,
      (netPrimary.get(right.id) || 0n) +
        (fromIssuer ? amount : 0n) -
        (toIssuer ? amount : 0n),
    );
  }
  for (const right of current)
    if (
      BigInt(right.supply) > 0n &&
      (netPrimary.get(right.id) || 0n) >= BigInt(right.supply)
    )
      allocated.add(right.assetId);
  const fundedWaiting = [...allocated].filter((id) => !active.has(id));
  const noRevenue = new Set(
    current
      .filter(
        (r) =>
          active.has(r.assetId) &&
          r.status === "Active" &&
          r.kind === "Revenue Share" &&
          !revenueRights.has(r.id),
      )
      .map((r) => r.assetId),
  );
  const deposited = BigInt(state.metrics.deposited),
    withdrawn = BigInt(state.metrics.claimed);
  return {
    primaryVolume,
    secondaryVolume,
    basketVolume,
    unmatchedVolume,
    daily,
    registered: state.assets.length,
    verified: state.assets.filter((a) => a.status === "Verified").length,
    active: active.size,
    fundedWaiting: fundedWaiting.length,
    reviewQueue:
      state.assets.filter((a) => a.status === "Pending verification").length +
      state.rights.filter((r) => r.status === "Pending verification").length,
    activeWithoutRevenue: noRevenue.size,
    activeArea: state.assets
      .filter((a) => active.has(a.id))
      .reduce((sum, a) => sum + a.area, 0),
    activeCapacity: state.assets
      .filter((a) => active.has(a.id))
      .reduce((sum, a) => sum + a.capacity, 0),
    deposited,
    withdrawn,
    remainingRevenue: deposited >= withdrawn ? deposited - withdrawn : null,
    categories: ASSET_KINDS.map((kind) => {
      const assets = state.assets.filter((a) => a.kind === kind);
      return {
        kind,
        total: assets.length,
        active: assets.filter((a) => active.has(a.id)).length,
      };
    }),
  };
}
