import { assetKindFromMetadata } from "./catalog";
import {
  EMPTY,
  parseMetadata,
  type Asset,
  type ChainEvent,
  type MarketState,
  type Right,
} from "./model";
const str = (v: unknown) => String(v ?? "");
function indexedArray(value: unknown): unknown[] {
  const result = typeof value === "string" ? JSON.parse(value) : value;
  if (!Array.isArray(result)) throw new Error("Invalid indexed array");
  return result;
}
function bytes32(value: unknown): string {
  if (typeof value === "string" && /^0x[0-9a-f]{64}$/i.test(value))
    return value;
  if (
    Array.isArray(value) ||
    (typeof value === "string" && value.startsWith("["))
  ) {
    const bytes = indexedArray(value);
    if (
      bytes.length !== 32 ||
      bytes.some(
        (v) => !Number.isInteger(v) || Number(v) < 0 || Number(v) > 255,
      )
    )
      throw new Error("Invalid indexed bytes32");
    return (
      "0x" + bytes.map((v) => Number(v).toString(16).padStart(2, "0")).join("")
    );
  }
  return str(value);
}
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
  // Index once so expanding the city does not repeatedly scan every event per asset.
  const byName = new Map<string, ChainEvent[]>();
  const byAsset = new Map<string, ChainEvent[]>();
  const byRight = new Map<string, ChainEvent[]>();
  const byListing = new Map<string, ChainEvent[]>();
  const add = (
    index: Map<string, ChainEvent[]>,
    key: string,
    event: ChainEvent,
  ) => {
    const bucket = index.get(key);
    if (bucket) bucket.push(event);
    else index.set(key, [event]);
  };
  for (const e of events) {
    add(byName, e.name, e);
    if (e.args.assetId !== undefined) add(byAsset, str(e.args.assetId), e);
    if (e.args.rightId !== undefined) add(byRight, str(e.args.rightId), e);
    if (e.args.listingId !== undefined)
      add(byListing, str(e.args.listingId), e);
  }
  const has = (name: string, key: string, id: string) =>
    (byName.get(name) || []).some((e) => str(e.args[key]) === id);
  for (const e of byName.get("AssetRegistered") || []) {
    const a = e.args,
      id = str(a.assetId),
      updates = (byAsset.get(id) || []).filter(
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
      kind: assetKindFromMetadata(Number(a.assetType), m.kind),
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
        (byAsset.get(id) || [])
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
      geoReference: bytes32(a.geoReference),
      simulated: true,
    } satisfies Asset);
  }
  for (const e of byName.get("RightCreated") || []) {
    const a = e.args,
      id = str(a.rightId),
      verified = (byRight.get(id) || []).find(
        (e) => e.name === "RightVerified" && str(e.args.rightId) === id,
      );
    const scope = (byRight.get(id) || []).find(
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
      termsHash: bytes32(a.termsHash),
      startAt: Number(a.startAt),
      endAt: Number(a.endAt),
      scope: Number(scope?.scope ?? (Number(a.rightType) === 1 ? 0 : 1)),
      purpose: bytes32(scope?.purpose),
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
  for (const e of byName.get("ListingCreated") || []) {
    const a = e.args,
      id = str(a.listingId),
      sold = (byListing.get(id) || [])
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
  for (const e of byName.get("BasketCreated") || []) {
    const a = e.args;
    state.baskets.push({
      id: str(a.basketId),
      rightIds: indexedArray(a.rightIds).map(str),
      units: indexedArray(a.unitsPerShare).map(str),
      name:
        str(parseMetadata(str(a.metadataURI)).name) || "Urban Income Basket",
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
