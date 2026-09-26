import { it, expect } from "vitest";
import { project } from "./projection";
import { eventQuery } from "./queries";
import type { ChainEvent } from "./model";
const address = "0x" + "a".repeat(40);
const e = (name: string, args: Record<string, unknown>): ChainEvent => ({
  name,
  args,
  contract: "registry",
  block: 1,
  txHash: "0x1",
  timestamp: "",
});
it("requires deployment scoping in every event query", () => {
  expect(eventQuery("AssetRegistered", address).events[0].filter?.value).toBe(
    address,
  );
  expect(() => eventQuery("bogus", address)).toThrow();
  expect(() => eventQuery("AssetRegistered", "")).toThrow();
  expect(
    eventQuery("ListingPurchased", address, { field: "totalPrice", op: "add" })
      .events[0].select[0].aggregator,
  ).toBe("add");
  expect(
    eventQuery("AssetRegistered", address, undefined, {
      fieldType: "input",
      inputIndex: 1,
      operator: "equal",
      value: address,
    }).events[0].filter?.rule,
  ).toBe("and");
});
it("projects primary and cancelled partial orders without double-counting volume", () => {
  const events = [
    e("AssetRegistered", {
      assetId: "1",
      issuer: address,
      assetType: "0",
      metadataURI: "",
      geoReference: "geo",
    }),
    e("AssetVerified", { assetId: "1" }),
    e("RightCreated", {
      rightId: "1",
      assetId: "1",
      issuer: address,
      rightType: 1,
      supply: 100,
      startAt: 1,
      endAt: 2000000000,
      transferPolicy: 0,
    }),
    e("RightVerified", { rightId: "1", approved: true }),
    e("RightActivated", { rightId: "1" }),
    e("ListingCreated", {
      listingId: "1",
      seller: address,
      token: address,
      rightId: "1",
      amount: "100",
      unitPrice: "1000000000000000000",
    }),
    e("ListingPurchased", {
      listingId: "1",
      amount: "25",
      totalPrice: "25000000000000000000",
    }),
    e("ListingCancelled", { listingId: "1" }),
  ];
  const s = project(events, address);
  expect(s.assets[0].status).toBe("Verified");
  expect(s.rights[0].status).toBe("Active");
  expect(s.listings[0].remaining).toBe("75");
  expect(s.listings[0].cancelled).toBe(true);
  expect(s.metrics.volume).toBe("25000000000000000000");
});
it("preserves rejection, closure, metadata updates and basket composition", () => {
  const uri =
    "data:application/json," +
    encodeURIComponent(
      JSON.stringify({
        name: "Updated space",
        district: "KANDA",
        coordinates: [139.7, 35.6],
        area: 200,
        capacity: 20,
      }),
    );
  const data = [
    e("AssetRegistered", {
      assetId: 1,
      issuer: address,
      assetType: 1,
      metadataURI: "",
      geoReference: "geo",
    }),
    e("AssetUpdated", { assetId: 1, metadataURI: uri }),
    e("AssetRejected", { assetId: 1 }),
    e("AssetRegistered", { assetId: 2, issuer: address, assetType: 99 }),
    e("AssetVerificationRequested", { assetId: 2 }),
    e("AssetRegistered", { assetId: 3, issuer: address, assetType: 2 }),
    e("RightCreated", {
      rightId: 1,
      assetId: 1,
      rightType: 0,
      transferPolicy: 1,
      supply: 1,
    }),
    e("RightScopeDefined", {
      rightId: 1,
      scope: 1,
      purpose: "WORKSHOP",
      exclusive: "true",
    }),
    e("RightVerified", { rightId: 1, approved: false }),
    e("RightCreated", {
      rightId: 2,
      assetId: 2,
      rightType: 1,
      transferPolicy: 0,
      supply: 10,
    }),
    e("RightVerified", { rightId: 2, approved: "true" }),
    e("RightClosed", { rightId: 2 }),
    e("RightCreated", {
      rightId: 3,
      assetId: 3,
      rightType: 99,
      transferPolicy: 99,
      supply: 1,
    }),
    e("RightCreated", {
      rightId: 4,
      assetId: 3,
      rightType: 1,
      transferPolicy: 0,
      supply: 1,
    }),
    e("RightVerified", { rightId: 4, approved: true }),
    e("ListingCreated", {
      listingId: 1,
      token: "basket-address",
      rightId: 1,
      amount: 5,
      unitPrice: 100,
    }),
    e("BasketCreated", {
      basketId: 1,
      rightIds: [2, 4],
      unitsPerShare: [1, 2],
      metadataURI: uri,
    }),
    e("RevenueDeposited", { amount: 100 }),
    e("RevenueClaimed", { amount: 50 }),
  ];
  const s = project(data, address);
  expect(s.assets.map((a) => a.status)).toEqual([
    "Rejected",
    "Pending verification",
    "Draft",
  ]);
  expect(s.assets[0].name).toBe("Updated space");
  expect(s.assets[0].coordinates).toEqual([139.7, 35.6]);
  expect(s.rights.map((r) => r.status)).toEqual([
    "Rejected",
    "Closed",
    "Pending verification",
    "Verified",
  ]);
  expect(s.rights[0].exclusive).toBe(true);
  expect(s.baskets[0].units).toEqual(["1", "2"]);
  expect(s.listings[0].token).toBe("basket");
  expect(s.metrics.claimed).toBe("50");
});
it("handles empty city and unknown metadata references explicitly", () =>
  expect(project([], address).assets).toEqual([]));

it("uses the latest lifecycle transition when rejected assets are revised and resubmitted", () => {
  const history = [
    e("AssetRegistered", { assetId: 1, issuer: address, assetType: 0 }),
    e("AssetVerificationRequested", { assetId: 1 }),
    e("AssetRejected", { assetId: 1 }),
  ];
  history.push(e("AssetUpdated", { assetId: 1, metadataURI: "" }));
  expect(project(history, address).assets[0].status).toBe("Draft");
  history.push(e("AssetVerificationRequested", { assetId: 1 }));
  expect(project(history, address).assets[0].status).toBe(
    "Pending verification",
  );
});
