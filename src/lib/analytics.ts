import { ASSET_KINDS } from "./catalog";
import type { MarketState } from "./model";

export type ActivityPeriod = "12h" | "24h" | "daily" | "weekly";

const equal = (a: unknown, b: unknown) =>
  String(a).toLowerCase() === String(b).toLowerCase();
export function marketAnalytics(
  state: MarketState,
  rightsAddress: string,
  now = Date.now(),
  period: ActivityPeriod = "daily",
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
  const hourly = period === "12h" || period === "24h";
  const weekly = period === "weekly";
  const hours = period === "12h" ? 12 : 24;
  const count = hourly ? hours + 1 : weekly ? 4 : 7;
  const step = hourly ? 3600000 : (weekly ? 7 : 1) * 86400000;
  const currentStart = hourly
    ? Math.floor(now / step) * step
    : weekly
      ? today - ((new Date(today).getUTCDay() + 6) % 7) * 86400000
      : today;
  const windowStart = hourly ? now - hours * step : -Infinity;
  const daily = Array.from({ length: count }, (_, i) => {
    const boundary = currentStart - (count - 1 - i) * step;
    const start = Math.max(boundary, windowStart);
    return {
      day: new Date(start).toISOString().slice(0, hourly ? 24 : 10),
      start,
      end: boundary + step,
      volume: 0n,
      revenue: 0n,
    };
  });
  const revenueRights = new Set<string>();
  const revenueAssets = new Set<string>();
  const revenueComposition = [...ASSET_KINDS, "Unclassified" as const].map(
    (kind) => ({ kind, amount: 0n }),
  );
  const rightsById = new Map(state.rights.map((r) => [r.id, r]));
  const assetsById = new Map(state.assets.map((a) => [a.id, a]));
  for (const event of state.events) {
    const date = Date.parse(event.timestamp);
    const bucket =
      Number.isFinite(date) && date <= now
        ? daily.find((d) => date >= d.start && date < d.end)
        : undefined;
    if (event.name === "RevenueDeposited") {
      const amount = BigInt(String(event.args.amount));
      if (amount > 0n) {
        const id = String(event.args.rightId);
        revenueRights.add(id);
        const asset = assetsById.get(rightsById.get(id)?.assetId || "");
        if (asset) revenueAssets.add(asset.id);
        revenueComposition.find(
          (c) => c.kind === (asset?.kind || "Unclassified"),
        )!.amount += amount;
      }
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
  let cumulativeRevenue = 0n;
  return {
    primaryVolume,
    secondaryVolume,
    basketVolume,
    unmatchedVolume,
    daily: daily.map((day) => {
      cumulativeRevenue += day.revenue;
      return { ...day, cumulativeRevenue };
    }),
    revenueAssets: revenueAssets.size,
    revenueComposition,
    openListings: state.listings.filter(
      (l) => !l.cancelled && BigInt(l.remaining) > 0n,
    ).length,
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
