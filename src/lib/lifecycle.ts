import type { MarketState } from "./model";
/** Funding measures issued units sold by the issuer, not a certification of project economics. */
export function assetStage(
  assetId: string,
  state: MarketState,
  hasListing: boolean,
  rightsAddress: string,
  now = Date.now() / 1000,
) {
  const rights = state.rights.filter(
    (r) =>
      r.assetId === assetId &&
      ["Verified", "Active"].includes(r.status) &&
      r.endAt > now,
  );
  if (rights.some((r) => r.status === "Active" && r.startAt <= now))
    return "Active";
  let partial = false;
  for (const r of rights) {
    const sold = state.events
      .filter(
        (e) =>
          e.name === "ListingPurchased" &&
          String(e.args.token).toLowerCase() === rightsAddress.toLowerCase() &&
          String(e.args.rightId) === r.id &&
          String(e.args.seller).toLowerCase() === r.issuer.toLowerCase(),
      )
      .reduce((n, e) => n + BigInt(String(e.args.amount)), 0n);
    if (sold >= BigInt(r.supply) && BigInt(r.supply) > 0n) return "Funded";
    partial ||= sold > 0n;
  }
  return partial ? "Funding" : hasListing ? "Available" : "Dormant";
}
