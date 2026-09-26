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
