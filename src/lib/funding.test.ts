import { describe, expect, it } from "vitest";
import { parseEther } from "viem";
import { fundingCampaigns, openFundingProjects, fundingPicks } from "./funding";
import { EMPTY, type MarketState, type ChainEvent } from "./model";
const event = (name: string, args: Record<string, unknown>): ChainEvent => ({
  name,
  args,
  contract: "market",
  block: 1,
  timestamp: new Date().toISOString(),
  txHash: "0x1",
});
const state = (): MarketState => ({
  ...EMPTY,
  assets: [
    {
      id: "a",
      issuer: "owner",
      status: "Verified",
    } as MarketState["assets"][number],
  ],
  rights: [
    {
      id: "r",
      assetId: "a",
      issuer: "owner",
      status: "Verified",
      kind: "Revenue Share",
      endAt: Date.now() / 1000 + 1000,
    } as MarketState["rights"][number],
  ],
  listings: [
    {
      id: "1",
      seller: "owner",
      token: "rights",
      rightId: "r",
      unitPrice: parseEther("50").toString(),
      remaining: "80",
      cancelled: false,
    },
    {
      id: "2",
      seller: "buyer",
      token: "rights",
      rightId: "r",
      unitPrice: parseEther("60").toString(),
      remaining: "5",
      cancelled: false,
    },
  ],
  events: [
    event("ListingCreated", { listingId: "1", amount: "100" }),
    event("ListingPurchased", {
      listingId: "1",
      amount: "10",
      totalPrice: parseEther("500").toString(),
      buyer: "0xabc",
    }),
    event("ListingPurchased", {
      listingId: "1",
      amount: "10",
      totalPrice: parseEther("500").toString(),
      buyer: "0xABC",
    }),
    event("ListingPurchased", {
      listingId: "2",
      amount: "5",
      totalPrice: parseEther("300").toString(),
      buyer: "0xdef",
    }),
  ],
});
describe("issuer funding projection", () => {
  it("shows only eligible open income projects and picks diverse assets without duplicates", () => {
    const base = fundingCampaigns(state())[0];
    const projects = openFundingProjects([
      {
        ...base,
        asset: { ...base.asset, id: "roof", kind: "Rooftop" },
        percent: 85,
      },
      {
        ...base,
        asset: { ...base.asset, id: "roof", kind: "Rooftop" },
        percent: 50,
      },
      {
        ...base,
        asset: { ...base.asset, id: "roof2", kind: "Rooftop" },
        percent: 80,
      },
      {
        ...base,
        asset: { ...base.asset, id: "parking", kind: "Parking" },
        percent: 40,
      },
      {
        ...base,
        asset: { ...base.asset, id: "wall", kind: "Advertising" },
        percent: 10,
      },
      { ...base, right: { ...base.right, kind: "Usage Right" } },
      { ...base, status: "Fully subscribed" },
      { ...base, right: { ...base.right, policy: "Nontransferable" } },
      { ...base, asset: { ...base.asset, status: "Draft" } },
    ]);
    expect(projects).toHaveLength(4);
    expect(fundingPicks(projects).map((c) => c.asset.id)).toEqual([
      "roof",
      "parking",
      "wall",
    ]);
  });
  it("uses original offer target, excludes secondary sales and counts distinct wallets", () => {
    const c = fundingCampaigns(state());
    expect(c).toHaveLength(1);
    expect(c[0]).toMatchObject({
      target: parseEther("5000"),
      raised: parseEther("1000"),
      percent: 20,
      sold: 20n,
      supporters: 1,
      status: "Open",
    });
  });
  it("closes cancelled or expired offers without erasing raised funds", () => {
    const s = state();
    s.listings[0].cancelled = true;
    expect(fundingCampaigns(s)[0]).toMatchObject({
      status: "Closed",
      raised: parseEther("1000"),
    });
    s.listings[0].cancelled = false;
    s.rights[0].endAt = 1;
    expect(fundingCampaigns(s)[0].status).toBe("Closed");
  });
  it("does not invent a target when the index has no creation event", () => {
    const s = state();
    s.events = s.events.filter((e) => e.name !== "ListingCreated");
    expect(fundingCampaigns(s)).toEqual([]);
  });
});
