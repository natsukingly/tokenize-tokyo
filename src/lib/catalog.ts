export const ASSET_KINDS = [
  "Rooftop",
  "Vacant Home",
  "Idle Land",
  "Parking",
  "Storage",
  "Advertising",
  "Other",
] as const;
export type AssetKind = (typeof ASSET_KINDS)[number];
export const SPACE_TYPES: Record<
  AssetKind,
  {
    scope: string;
    purpose: string;
    price: string;
    terms: string;
    color: string;
    symbol: string;
  }
> = {
  Rooftop: {
    scope: "Rooftop",
    purpose: "SOLAR",
    price: "2400",
    terms:
      "Receive a proportional share of revenue actually deposited by this solar project. No guaranteed yield.",
    color: "#d7f985",
    symbol: "☀",
  },
  "Vacant Home": {
    scope: "Interior",
    purpose: "WORKSHOP",
    price: "80000",
    terms:
      "Use this interior as a community workshop for the stated period. No residence or structural alterations. Repairs require issuer approval.",
    color: "#e3b76d",
    symbol: "⌂",
  },
  "Idle Land": {
    scope: "Land",
    purpose: "POP_UP",
    price: "35000",
    terms:
      "Use this plot for a temporary neighborhood market during the stated period. No permanent construction. Return the plot clean.",
    color: "#a7d998",
    symbol: "◇",
  },
  Parking: {
    scope: "Land",
    purpose: "PARKING",
    price: "18000",
    terms:
      "Exclusive use of one parking bay for the stated period. One passenger vehicle; no storage or commercial servicing.",
    color: "#91cafa",
    symbol: "P",
  },
  Storage: {
    scope: "Interior",
    purpose: "STORAGE",
    price: "24000",
    terms:
      "Use this storage unit during the stated period. Dry goods only; no hazardous items or overnight occupation.",
    color: "#c1a9f5",
    symbol: "▣",
  },
  Advertising: {
    scope: "Wall",
    purpose: "ADVERTISING",
    price: "45000",
    terms:
      "Use this wall panel for one approved advertisement during the stated period. Content and installation require issuer approval; no structural modification.",
    color: "#f2aaab",
    symbol: "▤",
  },
  Other: {
    scope: "Whole asset",
    purpose: "COMMUNITY",
    price: "10000",
    terms:
      "Use the specified space only for the agreed purpose and period. Changes require issuer approval.",
    color: "#bfc9b5",
    symbol: "◇",
  },
};
export function assetTypeCode(kind: string) {
  const i = ["Rooftop", "Vacant Home", "Idle Land"].indexOf(kind);
  return i < 0 ? 3 : i;
}
export function assetKindFromMetadata(code: number, kind: unknown): AssetKind {
  if (
    code === 3 &&
    ["Parking", "Storage", "Advertising", "Other"].includes(String(kind))
  )
    return kind as AssetKind;
  return (
    (["Rooftop", "Vacant Home", "Idle Land", "Other"] as const)[code] || "Other"
  );
}
export function defaultsForKind(kind: AssetKind) {
  const t = SPACE_TYPES[kind];
  return {
    kind,
    scope: t.scope,
    purpose: t.purpose,
    right: kind === "Rooftop" ? "Revenue Share" : "Usage Right",
    supply: kind === "Rooftop" ? "100" : "1",
    price: t.price,
    terms: t.terms,
    capacity: kind === "Rooftop" ? "20" : "0",
    exclusive: kind === "Rooftop" ? "No" : "Yes",
  };
}
