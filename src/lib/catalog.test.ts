import { afterEach, beforeEach, it, expect, vi } from "vitest";
import {
  ACTORS,
  DEMO_SITES,
  DEMO_ADDRESSES,
  demoState,
  demoCall,
  addDemoActivity,
} from "./demo";
import { assetKindFromMetadata, assetTypeCode } from "./catalog";
import { marketAnalytics } from "./analytics";
import { metadataURI } from "./model";
import { CORE_DEMO_SITES } from "./demo-catalog";
import { fundingCampaigns, openFundingProjects } from "./funding";
const values = new Map<string, string>();
beforeEach(() => {
  values.clear();
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => values.get(k) || null,
    setItem: (k: string, v: string) => values.set(k, v),
    removeItem: (k: string) => values.delete(k),
  });
});
afterEach(() => vi.unstubAllGlobals());
it("adds consistent historical income examples without overwriting holdings or duplicating activity", () => {
  demoCall(ACTORS["Investor B"], "market", "purchase", ["1", "10"]);
  const before = demoState(ACTORS["Investor B"]);
  expect(addDemoActivity()).toBe(true);
  const after = demoState(ACTORS["Investor B"]);
  expect(after.balances["rights:1"]).toBe("10");
  expect(after.cash).toBe(before.cash);
  expect(after.assets.length).toBe(before.assets.length + 3);
  const data = marketAnalytics(after, DEMO_ADDRESSES.rights);
  expect(data.daily.every((d) => d.volume > 0n && d.revenue > 0n)).toBe(true);
  expect(data.secondaryVolume).toBeGreaterThan(0n);
  expect(data.basketVolume).toBeGreaterThan(0n);
  expect(data.withdrawn).toBeGreaterThan(0n);
  const composer = demoState(ACTORS["Investor C"]);
  const basket = composer.baskets.at(-1)!;
  expect(basket.name).toBe("Tokyo Mixed Income Basket · Example");
  expect(composer.balances[`basket:${basket.id}`]).toBe("8");
  expect(BigInt(composer.claimable[`basket:${basket.id}`])).toBeGreaterThan(0n);
  expect(
    new Set(
      basket.rightIds.map(
        (id) =>
          after.assets.find(
            (a) => a.id === after.rights.find((r) => r.id === id)?.assetId,
          )?.kind,
      ),
    ),
  ).toEqual(new Set(["Rooftop", "Parking", "Advertising"]));
  const events = after.events.length;
  expect(addDemoActivity()).toBe(false);
  expect(demoState(ACTORS["Investor B"]).events).toHaveLength(events);
});
it("preserves the on-chain type enum and accepts only recognized Other subtypes", () => {
  expect(assetTypeCode("Parking")).toBe(3);
  expect(assetKindFromMetadata(3, "Storage")).toBe("Storage");
  expect(assetKindFromMetadata(0, "Parking")).toBe("Rooftop");
  expect(assetKindFromMetadata(3, "Unknown")).toBe("Other");
});
it("offers seven asset categories with non-solar usage rights and scope-specific terms", () => {
  const s = demoState(ACTORS["Investor B"]);
  expect(new Set(s.assets.map((a) => a.kind)).size).toBe(7);
  for (const a of s.assets
    .slice(0, CORE_DEMO_SITES.length)
    .filter((a) => a.kind !== "Rooftop")) {
    const r = s.rights.find((r) => r.assetId === a.id)!;
    expect(r.kind).toBe("Usage Right");
    expect(r.supply).toBe("1");
    expect(r.exclusive).toBe(true);
    expect(a.capacity).toBe(0);
  }
  expect(CORE_DEMO_SITES).toHaveLength(53);
  expect(DEMO_SITES).toHaveLength(265);
});
it("includes operating solar and reuse examples without inventing revenue or purchases", () => {
  const s = demoState(ACTORS["Investor B"]);
  const activeIds = new Set(
    s.rights.filter((r) => r.status === "Active").map((r) => r.assetId),
  );
  const activeAssets = s.assets
    .slice(0, CORE_DEMO_SITES.length)
    .filter((a) => activeIds.has(a.id));
  expect(activeAssets).toHaveLength(4);
  expect(new Set(activeAssets.map((a) => a.kind))).toEqual(
    new Set(["Rooftop", "Vacant Home", "Storage"]),
  );
  expect(
    activeAssets.every((a) => a.simulated && /simulated/i.test(a.description)),
  ).toBe(true);
  expect(s.rights.find((r) => r.id === "1")?.status).toBe("Verified");
  expect(s.rights.find((r) => r.id === "2")?.status).toBe("Verified");
  const analytics = marketAnalytics(s, DEMO_ADDRESSES.rights);
  expect(analytics.active).toBeGreaterThan(4);
  expect(analytics.activeArea).toBeGreaterThan(720);
  expect(analytics.activeCapacity).toBeGreaterThan(100);
  // Original projects still have no deposits; added examples use funded deposits.
  for (const a of activeAssets) {
    const right = s.rights.find((r) => r.assetId === a.id)!;
    expect(
      s.events.some(
        (e) =>
          e.name === "RevenueDeposited" && String(e.args.rightId) === right.id,
      ),
    ).toBe(false);
  }
  expect(BigInt(s.metrics.volume)).toBeGreaterThan(0n);
  expect(BigInt(s.metrics.deposited)).toBeGreaterThan(0n);
  expect(Object.values(s.claimable).every((value) => value === "0")).toBe(true);
});

it("adds activated samples to a saved version 3 demo without resetting user work", () => {
  demoCall(ACTORS["Investor B"], "market", "purchase", ["1", "10"]);
  const key = "tokenize-tokyo-demo-v2";
  const saved = JSON.parse(values.get(key)!);
  saved.catalogVersion = 3;
  saved.events = saved.events.filter(
    (event: { args: Record<string, unknown> }) =>
      Number(
        event.args.assetId || event.args.rightId || event.args.listingId || 0,
      ) <= 49,
  );
  // A user-created asset already occupies the next ID in the old catalog.
  saved.events.push({
    name: "AssetRegistered",
    contract: "registry",
    block: saved.events.length + 1,
    txHash: "simulation-user-asset",
    timestamp: new Date().toISOString(),
    args: {
      assetId: "50",
      issuer: ACTORS["Owner A"],
      assetType: 0,
      geoReference: `0x${"1".repeat(64)}`,
      metadataURI: metadataURI({
        name: "My saved rooftop",
        coordinates: [139.77, 35.69],
      }),
    },
  });
  values.set(key, JSON.stringify(saved));
  const migrated = demoState(ACTORS["Investor B"]);
  expect(migrated.assets).toHaveLength(DEMO_SITES.length + 1);
  expect(migrated.assets.find((a) => a.id === "50")?.name).toBe(
    "My saved rooftop",
  );
  expect(migrated.balances["rights:1"]).toBe("10");
  expect(migrated.cash).toBe(saved.cash[ACTORS["Investor B"]]);
  expect(migrated.listings.find((l) => l.id === "1")?.remaining).toBe("90");
  expect(migrated.rights.filter((r) => r.status === "Active")).toHaveLength(57);
  expect(new Set(migrated.assets.map((a) => a.id)).size).toBe(
    DEMO_SITES.length + 1,
  );
  expect(demoState(ACTORS["Investor B"]).events).toEqual(migrated.events);
});
it("catalog migration retains holdings and appends missing examples only once", () => {
  demoCall(ACTORS["Investor B"], "market", "purchase", ["1", "10"]);
  const key = "tokenize-tokyo-demo-v2",
    raw = JSON.parse(values.get(key)!);
  raw.catalogVersion = 2;
  raw.events = raw.events.filter(
    (e: { args: Record<string, unknown> }) =>
      Number(e.args.assetId || e.args.rightId || e.args.listingId || 0) <= 7,
  );
  values.set(key, JSON.stringify(raw));
  const s = demoState(ACTORS["Investor B"]);
  expect(s.balances["rights:1"]).toBe("10");
  expect(s.assets).toHaveLength(DEMO_SITES.length);
  expect(demoState(ACTORS["Investor B"]).assets).toHaveLength(
    DEMO_SITES.length,
  );
});

it("fivefold examples preserve custody, settlement, and diverse funding progress", () => {
  const owner = demoState(ACTORS["Owner A"]);
  const buyer = demoState("0x00000000000000000000000000000000000000f1");
  const other = demoState("0x00000000000000000000000000000000000000f2");
  const campaigns = fundingCampaigns(owner);
  const open = openFundingProjects(campaigns);
  expect(new Set(open.map((c) => c.asset.kind)).size).toBeGreaterThan(3);
  expect(open.some((c) => c.percent === 85)).toBe(true);
  expect(open.some((c) => c.percent === 0)).toBe(true);
  expect(campaigns.some((c) => c.status === "Fully subscribed")).toBe(true);
  for (const r of owner.rights.slice(53)) {
    const balance = (s: typeof owner) =>
      BigInt(s.balances[`rights:${r.id}`] || "0");
    expect(balance(owner) + balance(buyer) + balance(other)).toBe(
      BigInt(r.supply),
    );
    const deposited = owner.events
      .filter(
        (e) => e.name === "RevenueDeposited" && String(e.args.rightId) === r.id,
      )
      .reduce((sum, e) => sum + BigInt(String(e.args.amount)), 0n);
    const claims = [owner, buyer, other].reduce(
      (sum, s) => sum + BigInt(s.claimable[`rights:${r.id}`] || "0"),
      0n,
    );
    expect(claims).toBe(deposited);
  }
});
