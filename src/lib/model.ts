import type { AssetKind } from "./catalog";
export type { AssetKind } from "./catalog";
export type AssetStatus =
  "Draft" | "Pending verification" | "Verified" | "Rejected";
export type RightStatus =
  "Pending verification" | "Verified" | "Active" | "Closed" | "Rejected";
export interface Asset {
  id: string;
  issuer: string;
  name: string;
  district: string;
  kind: AssetKind;
  coordinates: [number, number];
  area: number;
  capacity: number;
  description: string;
  status: AssetStatus;
  metadataURI: string;
  geoReference: string;
  simulated: boolean;
}
export interface Right {
  id: string;
  assetId: string;
  issuer: string;
  kind: "Revenue Share" | "Usage Right" | "Lease" | "Other";
  supply: string;
  termsURI: string;
  termsHash: string;
  startAt: number;
  endAt: number;
  policy: "Open" | "Allowlist" | "Nontransferable";
  status: RightStatus;
  scope: number;
  purpose: string;
  exclusive: boolean;
}
export interface Listing {
  id: string;
  seller: string;
  token: "rights" | "basket";
  rightId: string;
  remaining: string;
  unitPrice: string;
  cancelled: boolean;
}
export interface Basket {
  id: string;
  rightIds: string[];
  units: string[];
  name: string;
}
export interface ChainEvent {
  source?: "rpc-bootstrap" | "multibaas";
  logIndex?: number;
  name: string;
  contract:
    "registry" | "rights" | "market" | "revenue" | "basket" | "settlement";
  args: Record<string, unknown>;
  block: number;
  txHash: string;
  timestamp: string;
}
export interface MarketState {
  assets: Asset[];
  rights: Right[];
  listings: Listing[];
  baskets: Basket[];
  events: ChainEvent[];
  metrics: {
    volume: string;
    deposited: string;
    claimed: string;
    sales: number;
  };
  balances: Record<string, string>;
  claimable: Record<string, string>;
  cash: string;
}
export const EMPTY: MarketState = {
  assets: [],
  rights: [],
  listings: [],
  baskets: [],
  events: [],
  metrics: { volume: "0", deposited: "0", claimed: "0", sales: 0 },
  balances: {},
  claimable: {},
  cash: "0",
};
export function metadataURI(value: unknown) {
  return "data:application/json," + encodeURIComponent(JSON.stringify(value));
}
export function compactMetadataURI(value: unknown) {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  if (bytes.length > 12000)
    throw new Error("Project details are too long for inline demo metadata.");
  return "data:application/json;base64," + btoa(String.fromCharCode(...bytes));
}
export function parseMetadata(uri: string): Record<string, unknown> {
  // No arbitrary fetch/SSRF. Demo uses bounded inline metadata; IPFS links remain inspectable.
  if (
    (!uri.startsWith("data:application/json,") &&
      !uri.startsWith("data:application/json;base64,")) ||
    uri.length > 16384
  )
    return {};
  try {
    const text = uri.startsWith("data:application/json;base64,")
      ? new TextDecoder("utf-8", { fatal: true }).decode(
          Uint8Array.from(atob(uri.slice(29)), (c) => c.charCodeAt(0)),
        )
      : decodeURIComponent(uri.slice(22));
    const value: unknown = JSON.parse(text);
    return value !== null && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}
export function short(value: string) {
  return value.startsWith("0x")
    ? value.slice(0, 6) + "…" + value.slice(-4)
    : value;
}
