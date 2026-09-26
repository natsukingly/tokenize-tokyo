import { describe, expect, it } from "vitest";
import {
  combineIndexedEvents,
  combineIndexedTotal,
  indexBootstrap,
  type EventBootstrap,
} from "./index-bootstrap";
import archive from "./generated/sepolia-bootstrap.json";
import { project } from "./projection";
import type { ContractKey } from "./config";
import type { ChainEvent } from "./model";

const addresses = Object.fromEntries(
  Object.entries(archive.addresses).filter(([key]) => key !== "authority"),
) as Record<ContractKey, string>;
describe("Sepolia initial event archive", () => {
  it("never adds Sepolia records to Curvegrid Testnet or another deployment", () => {
    expect(indexBootstrap(2017072401, addresses)).toBeNull();
    const other = Object.fromEntries(
      Object.keys(addresses).map((k) => [k, "0x" + "ab".repeat(20)]),
    ) as typeof addresses;
    expect(indexBootstrap(11155111, other)).toBeNull();
    expect(() =>
      indexBootstrap(11155111, { ...addresses, rights: other.rights }),
    ).toThrow(/Mixed deployment/);
  });
  it("recovers the existing asset and issued right from real setup logs", () => {
    const initial = indexBootstrap(11155111, addresses)!;
    const state = project(combineIndexedEvents(initial, []), addresses.rights);
    expect(state.assets.find((a) => a.id === "1")?.status).toBe("Verified");
    expect(state.rights.find((r) => r.id === "1")?.supply).toBe("10");
    expect(state.rights.find((r) => r.id === "1")?.status).toBe(
      "Pending verification",
    );
    expect(state.metrics.volume).toBe("0");
    expect(initial.audit.every((e) => /^0x[0-9a-f]{64}$/i.test(e.id))).toBe(
      true,
    );
  });
  it("does not double count an overlapping backfill and keeps future updates", () => {
    const initial = indexBootstrap(11155111, addresses)!;
    const update: ChainEvent = {
      name: "RightVerified",
      contract: "rights",
      args: { rightId: "1", approved: true },
      txHash: "0x" + "cc".repeat(32),
      block: initial.toBlock + 1,
      timestamp: "2026-09-27T00:00:00Z",
      source: "multibaas",
    };
    const merged = combineIndexedEvents(initial, [...initial.events, update]);
    expect(merged).toHaveLength(initial.events.length + 1);
    const state = project(merged, addresses.rights);
    expect(state.assets).toHaveLength(1);
    expect(state.rights[0].status).toBe("Verified");
  });
  it("refuses records outside the captured boundary", () => {
    const malformed = structuredClone(archive) as EventBootstrap;
    malformed.toBlock = malformed.events[0].block - 1;
    expect(() => indexBootstrap(11155111, addresses, malformed)).toThrow(
      /boundary/,
    );
  });
  it("keeps monetary totals exact with no, partial or complete historical indexing", () => {
    const initial = structuredClone(archive) as EventBootstrap;
    const first: ChainEvent = {
      ...initial.events[0],
      name: "ListingPurchased",
      args: { totalPrice: "10" },
    };
    const second = { ...first, args: { totalPrice: "20" } };
    initial.events = [first, second];
    const future = {
      ...first,
      block: initial.toBlock + 1,
      args: { totalPrice: "40" },
    };
    expect(
      combineIndexedTotal(
        initial,
        [future],
        "ListingPurchased",
        "totalPrice",
        "40",
      ),
    ).toBe("70");
    expect(
      combineIndexedTotal(
        initial,
        [first, future],
        "ListingPurchased",
        "totalPrice",
        "50",
      ),
    ).toBe("70");
    expect(
      combineIndexedTotal(
        initial,
        [first, second, future],
        "ListingPurchased",
        "totalPrice",
        "70",
      ),
    ).toBe("70");
    expect(() =>
      combineIndexedTotal(
        initial,
        [first],
        "ListingPurchased",
        "totalPrice",
        "0",
      ),
    ).toThrow(/disagree/);
  });
});
