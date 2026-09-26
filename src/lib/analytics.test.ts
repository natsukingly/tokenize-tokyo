import { describe, expect, it } from "vitest";
import { marketAnalytics } from "./analytics";
import { EMPTY, type MarketState, type ChainEvent } from "./model";
const token = "0x0000000000000000000000000000000000000011";
const now = Date.parse("2026-09-26T12:00:00Z");
function fixture(): MarketState {
  return {
    ...structuredClone(EMPTY),
    assets: [
      {
        id: "1",
        issuer: "owner",
        name: "Roof",
        district: "Tokyo",
        kind: "Rooftop",
        coordinates: [139, 35],
        area: 100,
        capacity: 20,
        description: "Demo",
        status: "Verified",
        metadataURI: "",
        geoReference: "",
        simulated: true,
      },
    ],
    rights: [
      {
        id: "1",
        assetId: "1",
        issuer: "owner",
        kind: "Revenue Share",
        supply: "100",
        termsURI: "",
        termsHash: "",
        startAt: now / 1000 - 100,
        endAt: now / 1000 + 1000,
        policy: "Open",
        status: "Verified",
        scope: 0,
        purpose: "SOLAR",
        exclusive: false,
      },
    ],
    listings: [
      {
        id: "1",
        seller: "owner",
        token: "rights",
        rightId: "1",
        remaining: "0",
        unitPrice: "10",
        cancelled: false,
      },
    ],
  };
}
function event(
  name: string,
  args: Record<string, unknown>,
  timestamp = "2026-09-26T11:00:00Z",
): ChainEvent {
  return {
    name,
    args,
    timestamp,
    block: 1,
    txHash: "0x01",
    contract: "market",
  };
}
describe("decision dashboard", () => {
  it.each([
    ["12h", 12],
    ["24h", 24],
  ] as const)(
    "groups %s by hour across midnight using the exact rolling window",
    (period, hours) => {
      const s = fixture();
      const clock = Date.parse("2026-09-26T02:30:00Z");
      const cutoff = clock - hours * 3600000;
      for (const [time, amount] of [
        [cutoff - 1, "900"],
        [cutoff, "100"],
        [Math.ceil(cutoff / 3600000) * 3600000, "50"],
        [clock - 60000, "25"],
        [clock + 1, "800"],
      ] as const) {
        s.events.push(
          event(
            "RevenueDeposited",
            { rightId: "1", amount },
            new Date(time).toISOString(),
          ),
        );
        s.events.push(
          event(
            "ListingPurchased",
            { amount: "1", totalPrice: amount },
            new Date(time).toISOString(),
          ),
        );
      }
      s.events.push(
        event("RevenueDeposited", { rightId: "1", amount: "700" }, "invalid"),
      );
      const bins = marketAnalytics(s, token, clock, period).daily;
      expect(bins).toHaveLength(hours + 1);
      expect(bins[0].start).toBe(cutoff);
      expect(bins[0].revenue).toBe(100n);
      expect(bins[1].revenue).toBe(50n);
      expect(bins.at(-1)?.revenue).toBe(25n);
      expect(bins.reduce((sum, bin) => sum + bin.volume, 0n)).toBe(175n);
      expect(bins.at(-1)?.cumulativeRevenue).toBe(175n);
      expect(bins.some((bin) => bin.volume === 0n)).toBe(true);
      expect(bins.some((bin) => bin.day.startsWith("2026-09-25"))).toBe(true);
      expect(bins.some((bin) => bin.day.startsWith("2026-09-26"))).toBe(true);
    },
  );
  it("attributes deposited income to physical asset types without counting vault transfers as new income", () => {
    const s = fixture();
    s.assets.push({
      ...s.assets[0],
      id: "2",
      name: "Parking",
      kind: "Parking",
    });
    s.rights.push(
      { ...s.rights[0], id: "2" },
      { ...s.rights[0], id: "3", assetId: "2" },
    );
    s.events.push(
      event(
        "RevenueDeposited",
        { rightId: "1", amount: "100" },
        "2026-01-01T00:00:00Z",
      ),
      event("RevenueDeposited", { rightId: "2", amount: "200" }),
      event("RevenueDeposited", { rightId: "3", amount: "600" }),
      event("RevenueDeposited", { rightId: "99", amount: "50" }),
      event("RevenueClaimed", { rightId: "1", amount: "100" }),
      event("BasketRevenueClaimed", { basketId: "1", amount: "100" }),
    );
    const result = marketAnalytics(s, token, now);
    expect(result.revenueAssets).toBe(2);
    expect(result.revenueComposition.filter((c) => c.amount > 0n)).toEqual([
      { kind: "Rooftop", amount: 300n },
      { kind: "Parking", amount: 600n },
      { kind: "Unclassified", amount: 50n },
    ]);
    expect(result.categories.reduce((n, c) => n + c.total, 0)).toBe(2);
  });
  it("accumulates only deposits inside the displayed period and preserves zero-activity days", () => {
    const s = fixture();
    s.events.push(
      event(
        "RevenueDeposited",
        { rightId: "1", amount: "900" },
        "2026-09-19T23:59:59Z",
      ),
      event(
        "RevenueDeposited",
        { rightId: "1", amount: "100" },
        "2026-09-20T00:00:00Z",
      ),
      event(
        "RevenueDeposited",
        { rightId: "1", amount: "50" },
        "2026-09-26T11:00:00Z",
      ),
    );
    expect(
      marketAnalytics(s, token, now).daily.map((d) => d.cumulativeRevenue),
    ).toEqual([100n, 100n, 100n, 100n, 100n, 100n, 150n]);
    const empty = marketAnalytics(structuredClone(EMPTY), token, now);
    expect(empty.revenueAssets).toBe(0);
    expect(empty.revenueComposition.every((c) => c.amount === 0n)).toBe(true);
    expect(empty.daily.every((d) => d.cumulativeRevenue === 0n)).toBe(true);
  });
  it("groups weekly activity on UTC Mondays without filling empty periods", () => {
    const s = fixture();
    s.events.push(
      event(
        "RevenueDeposited",
        { rightId: "1", amount: "100" },
        "2026-09-20T23:59:59Z",
      ),
    );
    s.events.push(
      event(
        "RevenueDeposited",
        { rightId: "1", amount: "200" },
        "2026-09-21T00:00:00Z",
      ),
    );
    const bins = marketAnalytics(s, token, now, "weekly").daily;
    expect(bins.map((b) => b.day)).toEqual([
      "2026-08-31",
      "2026-09-07",
      "2026-09-14",
      "2026-09-21",
    ]);
    expect(bins.map((b) => b.revenue)).toEqual([0n, 0n, 100n, 200n]);
  });
  it("separates primary capital, secondary turnover and Basket turnover", () => {
    const s = fixture();
    s.events.push(
      event("ListingPurchased", {
        token,
        rightId: "1",
        listingId: "1",
        seller: "owner",
        buyer: "B",
        amount: "100",
        totalPrice: "1000",
      }),
      event("ListingPurchased", {
        token,
        rightId: "1",
        listingId: "2",
        seller: "B",
        buyer: "C",
        amount: "10",
        totalPrice: "120",
      }),
    );
    s.listings.push({ ...s.listings[0], id: "3", token: "basket" });
    s.events.push(
      event("ListingPurchased", {
        token: "basket",
        listingId: "3",
        seller: "B",
        buyer: "C",
        amount: "1",
        totalPrice: "500",
      }),
    );
    const result = marketAnalytics(s, token, now);
    expect([
      result.primaryVolume,
      result.secondaryVolume,
      result.basketVolume,
    ]).toEqual([1000n, 120n, 500n]);
    expect(result.fundedWaiting).toBe(1);
    expect(result.active).toBe(0);
    expect(result.daily[6].volume).toBe(1620n);
  });
  it("does not treat an issuer buying back units, or selling to themselves, as new full allocation", () => {
    const s = fixture();
    s.events.push(
      event("ListingPurchased", {
        token,
        rightId: "1",
        seller: "owner",
        buyer: "B",
        amount: "100",
        totalPrice: "1000",
      }),
      event("ListingPurchased", {
        token,
        rightId: "1",
        seller: "B",
        buyer: "owner",
        amount: "20",
        totalPrice: "200",
      }),
    );
    expect(marketAnalytics(s, token, now).fundedWaiting).toBe(0);
    s.events.push(
      event("ListingPurchased", {
        token,
        rightId: "1",
        seller: "owner",
        buyer: "owner",
        amount: "100",
        totalPrice: "1000",
      }),
    );
    expect(marketAnalytics(s, token, now).fundedWaiting).toBe(0);
  });
  it("counts one active physical asset once across multiple rights and excludes expiry", () => {
    const s = fixture();
    s.rights[0].status = "Active";
    s.rights.push({ ...s.rights[0], id: "2" });
    const result = marketAnalytics(s, token, now);
    expect([
      result.active,
      result.activeArea,
      result.activeCapacity,
      result.activeWithoutRevenue,
    ]).toEqual([1, 100, 20, 1]);
    expect(marketAnalytics(s, token, now + 2000000).active).toBe(0);
  });
  it("does not invent yield and calls out incomplete withdrawal aggregates", () => {
    const s = fixture();
    s.metrics.deposited = "500";
    s.metrics.claimed = "200";
    expect(marketAnalytics(s, token, now).remainingRevenue).toBe(300n);
    s.metrics.claimed = "600";
    expect(marketAnalytics(s, token, now).remainingRevenue).toBeNull();
    s.events.push(
      event(
        "RevenueDeposited",
        { rightId: "1", amount: "500" },
        "2026-01-01T00:00:00Z",
      ),
    );
    expect(
      marketAnalytics(s, token, now).daily.every((d) => d.revenue === 0n),
    ).toBe(true);
  });
});
