import type { ChainEvent } from "./model";
import type { RecentTransaction } from "./wallet";
export type TourMode = "buy" | "owner";
export type TourStep =
  | "connect"
  | "gas"
  | "currency"
  | "discover"
  | "purchase"
  | "receipt"
  | "portfolio"
  | "define"
  | "verify"
  | "issue"
  | "publish"
  | "funding";
export const tourSteps = (mode: TourMode, demo: boolean): TourStep[] =>
  mode === "buy"
    ? demo
      ? ["discover", "purchase", "portfolio"]
      : [
          "connect",
          "gas",
          "currency",
          "discover",
          "purchase",
          "receipt",
          "portfolio",
        ]
    : demo
      ? ["define", "verify", "issue", "publish", "funding"]
      : ["connect", "gas", "define", "verify", "issue", "publish", "funding"];
export const eventIdentity = (e: ChainEvent) =>
  `${e.txHash}:${e.name}:${JSON.stringify(e.args)}`;
export function tourEvents(events: ChainEvent[], baseline: Set<string>) {
  return events.filter((e) => !baseline.has(eventIdentity(e)));
}
export function ownTourAction(
  events: ChainEvent[],
  name: "ListingPurchased" | "AssetRegistered",
  account: string,
  demo: boolean,
  transactions: RecentTransaction[],
  startedAt: number,
) {
  if (!account) return undefined;
  const confirmed = new Set(
    transactions
      .filter(
        (tx) =>
          tx.account.toLowerCase() === account.toLowerCase() &&
          tx.phase === "confirmed" &&
          tx.createdAt >= startedAt,
      )
      .map((tx) => tx.hash.toLowerCase()),
  );
  const field = name === "ListingPurchased" ? "buyer" : "issuer";
  return events.find(
    (e) =>
      e.name === name &&
      String(e.args[field]).toLowerCase() === account.toLowerCase() &&
      (demo || confirmed.has(e.txHash.toLowerCase())),
  );
}
