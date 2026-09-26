import {
  EMPTY,
  parseMetadata,
  type Asset,
  type ChainEvent,
  type MarketState,
  type Right,
} from "./model";
const str = (v: unknown) => String(v ?? "");
const sum = (es: ChainEvent[], name: string, key: string) =>
  es
    .filter((e) => e.name === name)
    .reduce((a, e) => a + BigInt(str(e.args[key]) || "0"), 0n)
    .toString();
export function project(
  events: ChainEvent[],
  rightsAddress: string,
): MarketState {
  const state: MarketState = { ...structuredClone(EMPTY), events };
  const has = (name: string, key: string, id: string) =>
    events.some((e) => e.name === name && str(e.args[key]) === id);
  for (const e of events.filter((e) => e.name === "AssetRegistered")) {
    const a = e.args,
      id = str(a.assetId),
      updates = events.filter(
        (e) => e.name === "AssetUpdated" && str(e.args.assetId) === id,
      );
    const uri = str(updates.at(-1)?.args.metadataURI ?? a.metadataURI),
      m = parseMetadata(uri);
    const coordinates =
      Array.isArray(m.coordinates) &&
      m.coordinates.length === 2 &&
      m.coordinates.every((x) => typeof x === "number" && Number.isFinite(x))
        ? (m.coordinates as [number, number])
        : ([139.7671, 35.6812] as [number, number]);
    state.assets.push({
      id,
      issuer: str(a.issuer),
      name: str(m.name) || `Urban asset ${id}`,
      district: str(m.district) || "Tokyo",
      kind:
        (["Rooftop", "Vacant Home", "Idle Land", "Other"] as const)[
          Number(a.assetType)
        ] || "Other",
      coordinates,
      area: Number(m.area) || 0,
      capacity: Number(m.capacity) || 0,
      description:
        str(m.description) || "Demo urban asset. Verification is simulated.",
      status: (
        {
          AssetRegistered: "Draft",
          AssetUpdated: "Draft",
          AssetVerificationRequested: "Pending verification",
          AssetRejected: "Rejected",
          AssetVerified: "Verified",
        } as Record<string, Asset["status"]>
      )[
        events
          .filter(
            (event) =>
              [
                "AssetRegistered",
                "AssetUpdated",
                "AssetVerificationRequested",
                "AssetRejected",
                "AssetVerified",
              ].includes(event.name) && str(event.args.assetId) === id,
          )
          .at(-1)!.name
      ],
      metadataURI: uri,
      geoReference: str(a.geoReference),
      simulated: true,
    } satisfies Asset);
  }
  for (const e of events.filter((e) => e.name === "RightCreated")) {
    const a = e.args,
      id = str(a.rightId),
      verified = events.find(
        (e) => e.name === "RightVerified" && str(e.args.rightId) === id,
      );
    const scope = events.find(
      (e) => e.name === "RightScopeDefined" && str(e.args.rightId) === id,
    )?.args;
    const approved =
      verified?.args.approved === true || verified?.args.approved === "true";
    state.rights.push({
      id,
      assetId: str(a.assetId),
      issuer: str(a.issuer),
      kind:
        (["Usage Right", "Revenue Share", "Lease", "Other"] as const)[
          Number(a.rightType)
        ] || "Other",
      supply: str(a.supply),
      termsURI: str(a.termsURI),
      termsHash: str(a.termsHash),
      startAt: Number(a.startAt),
      endAt: Number(a.endAt),
      scope: Number(scope?.scope ?? (Number(a.rightType) === 1 ? 0 : 1)),
      purpose: str(scope?.purpose),
      exclusive: scope?.exclusive === true || scope?.exclusive === "true",
      policy:
        (["Open", "Allowlist", "Nontransferable"] as const)[
          Number(a.transferPolicy)
        ] || "Nontransferable",
      status: has("RightClosed", "rightId", id)
        ? "Closed"
        : has("RightActivated", "rightId", id)
          ? "Active"
          : verified
            ? approved
              ? "Verified"
              : "Rejected"
            : "Pending verification",
    } satisfies Right);
  }
  for (const e of events.filter((e) => e.name === "ListingCreated")) {
    const a = e.args,
      id = str(a.listingId),
      sold = events
        .filter(
          (e) => e.name === "ListingPurchased" && str(e.args.listingId) === id,
        )
        .reduce((n, e) => n + BigInt(str(e.args.amount)), 0n);
    state.listings.push({
      id,
      seller: str(a.seller),
      token:
        str(a.token).toLowerCase() === rightsAddress.toLowerCase()
          ? "rights"
          : "basket",
      rightId: str(a.rightId),
      remaining: (BigInt(str(a.amount)) - sold).toString(),
      unitPrice: str(a.unitPrice),
      cancelled: has("ListingCancelled", "listingId", id),
    });
  }
  for (const e of events.filter((e) => e.name === "BasketCreated")) {
    const a = e.args;
    state.baskets.push({
      id: str(a.basketId),
      rightIds: (a.rightIds as unknown[]).map(str),
      units: (a.unitsPerShare as unknown[]).map(str),
      name: str(parseMetadata(str(a.metadataURI)).name) || "Tokyo Solar Basket",
    });
  }
  state.metrics = {
    volume: sum(events, "ListingPurchased", "totalPrice"),
    deposited: sum(events, "RevenueDeposited", "amount"),
    claimed: sum(events, "RevenueClaimed", "amount"),
    sales: events.filter((e) => e.name === "ListingPurchased").length,
  };
  return state;
}
