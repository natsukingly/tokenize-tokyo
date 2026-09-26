import archive from "./generated/sepolia-bootstrap.json";
import type { ChainEvent } from "./model";
import type { ContractKey } from "./config";

export interface EventBootstrap {
  chainId: number;
  toBlock: number;
  blockHash: string;
  addresses: Record<string, string>;
  events: ChainEvent[];
  audit: { name: string; id: string; hash: string; block: number }[];
}

/** Initial public Sepolia receipts only. No Curvegrid balances or simulated events. */
export function indexBootstrap(
  chainId: number,
  addresses: Record<ContractKey, string>,
  snapshot: EventBootstrap = archive as EventBootstrap,
): EventBootstrap | null {
  if (chainId !== snapshot.chainId) return null;
  const matches = Object.entries(addresses).map(
    ([key, address]) =>
      address.toLowerCase() === snapshot.addresses[key]?.toLowerCase(),
  );
  if (matches.every((match) => !match)) return null;
  if (!matches.every(Boolean))
    throw new Error(
      "Mixed deployment addresses; cannot load initial chain records.",
    );
  if (
    snapshot.events.some(
      (e) => e.block > snapshot.toBlock || e.source !== "rpc-bootstrap",
    )
  )
    throw new Error("Invalid initial event boundary.");
  return snapshot;
}

export function combineIndexedEvents(
  initial: EventBootstrap | null,
  live: ChainEvent[],
) {
  // Disjoint ranges prevent double counting when a later plan backfills all events.
  return [
    ...(initial?.events || []),
    ...live.filter((e) => !initial || e.block > initial.toBlock),
  ].sort((a, b) => a.block - b.block || (a.logIndex ?? 0) - (b.logIndex ?? 0));
}

export function combineIndexedTotal(
  initial: EventBootstrap | null,
  live: ChainEvent[],
  name: string,
  field: string,
  indexedTotal: string,
) {
  if (!initial) return indexedTotal;
  const sum = (records: ChainEvent[]) =>
    records
      .filter((e) => e.name === name && e.block <= initial.toBlock)
      .reduce((n, e) => n + BigInt(String(e.args[field])), 0n);
  const indexedPast = sum(live),
    archivedPast = sum(initial.events);
  if (indexedPast > BigInt(indexedTotal) || indexedPast > archivedPast)
    throw new Error(
      "Indexer totals disagree with the initial records; retry after indexing.",
    );
  return (BigInt(indexedTotal) - indexedPast + archivedPast).toString();
}
