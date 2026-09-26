import type { Asset, Listing, MarketState, Right } from "./model";
export type Campaign = {
  asset: Asset;
  right: Right;
  listing: Listing;
  offered: bigint;
  sold: bigint;
  target: bigint;
  raised: bigint;
  supporters: number;
  percent: number;
  status: "Open" | "Fully subscribed" | "Closed";
};
// One fixed-price issuer offering per listing. Secondary trades never fund it.
// Original quantity comes from indexed ListingCreated, not mutable inventory.
export function fundingCampaigns(
  state: MarketState,
  now = Date.now(),
): Campaign[] {
  return state.listings.flatMap((listing) => {
    if (listing.token !== "rights") return [];
    const right = state.rights.find((r) => r.id === listing.rightId);
    const asset = state.assets.find((a) => a.id === right?.assetId);
    if (
      !right ||
      !asset ||
      listing.seller.toLowerCase() !== right.issuer.toLowerCase()
    )
      return [];
    const created = state.events.find(
      (e) =>
        e.name === "ListingCreated" && String(e.args.listingId) === listing.id,
    );
    if (!created) return []; // No invented target when the index is incomplete.
    const offered = BigInt(String(created.args.amount)),
      price = BigInt(listing.unitPrice);
    if (offered <= 0n || price <= 0n) return [];
    const sales = state.events.filter(
      (e) =>
        e.name === "ListingPurchased" &&
        String(e.args.listingId) === listing.id,
    );
    const sold = sales.reduce((n, e) => n + BigInt(String(e.args.amount)), 0n);
    const raised = sales.reduce(
      (n, e) => n + BigInt(String(e.args.totalPrice)),
      0n,
    );
    const target = offered * price;
    const available =
      !listing.cancelled &&
      ["Verified", "Active"].includes(right.status) &&
      right.endAt > now / 1000 &&
      BigInt(listing.remaining) > 0n;
    return [
      {
        asset,
        right,
        listing,
        offered,
        sold,
        target,
        raised,
        supporters: new Set(
          sales.map((e) => String(e.args.buyer).toLowerCase()),
        ).size,
        percent: Number((raised * 10000n) / target) / 100,
        status:
          sold >= offered ? "Fully subscribed" : available ? "Open" : "Closed",
      } satisfies Campaign,
    ];
  });
}

/** Fundable issuer revenue offers, one visible project per asset. */
export function openFundingProjects(campaigns: Campaign[]): Campaign[] {
  const projects = new Map<string, Campaign>();
  const ordered = campaigns
    .filter(
      (c) =>
        c.status === "Open" &&
        c.asset.status === "Verified" &&
        c.right.kind === "Revenue Share" &&
        c.right.policy !== "Nontransferable",
    )
    .sort(
      (a, b) =>
        b.percent - a.percent ||
        b.supporters - a.supporters ||
        a.listing.id.localeCompare(b.listing.id, "en", { numeric: true }),
    );
  for (const c of ordered)
    if (!projects.has(c.asset.id)) projects.set(c.asset.id, c);
  return [...projects.values()];
}

/** A small discovery set, chosen by subscription progress and asset variety. */
export function fundingPicks(projects: Campaign[], limit = 3): Campaign[] {
  const picks: Campaign[] = [];
  const kinds = new Set<string>();
  for (const c of projects) {
    if (picks.length === limit) break;
    if (!kinds.has(c.asset.kind)) {
      picks.push(c);
      kinds.add(c.asset.kind);
    }
  }
  for (const c of projects) {
    if (picks.length === limit) break;
    if (!picks.includes(c)) picks.push(c);
  }
  return picks;
}
