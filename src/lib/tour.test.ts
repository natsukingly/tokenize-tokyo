import { expect, it } from "vitest";
import { eventIdentity, ownTourAction, tourEvents, tourSteps } from "./tour";
import type { ChainEvent } from "./model";
import type { RecentTransaction } from "./wallet";
const buyer = "0x" + "a".repeat(40),
  other = "0x" + "b".repeat(40);
const purchase = (
  account: string,
  hash = "0x" + "c".repeat(64),
): ChainEvent => ({
  name: "ListingPurchased",
  contract: "market",
  args: { buyer: account, rightId: "1" },
  block: 20,
  txHash: hash,
  timestamp: "",
});
const tx = {
  hash: purchase(buyer).txHash,
  label: "purchase · market",
  phase: "confirmed",
  account: buyer,
  chainId: 2017072401,
  createdAt: 200,
} satisfies RecentTransaction;
it("separates real-wallet onboarding and receipts from simulation steps", () => {
  expect(tourSteps("buy", false)).toEqual([
    "connect",
    "gas",
    "currency",
    "discover",
    "purchase",
    "receipt",
    "portfolio",
  ]);
  expect(tourSteps("buy", true)).toEqual(["discover", "purchase", "portfolio"]);
  expect(tourSteps("owner", false)).toContain("funding");
});
it("ignores unrelated city activity, pending approvals and purchases before the tour", () => {
  expect(
    ownTourAction(
      [purchase(other)],
      "ListingPurchased",
      buyer,
      false,
      [tx],
      100,
    ),
  ).toBeUndefined();
  expect(
    ownTourAction(
      [purchase(buyer)],
      "ListingPurchased",
      buyer,
      false,
      [{ ...tx, phase: "submitted" }],
      100,
    ),
  ).toBeUndefined();
  expect(
    ownTourAction(
      [purchase(buyer)],
      "ListingPurchased",
      buyer,
      false,
      [tx],
      300,
    ),
  ).toBeUndefined();
  expect(
    ownTourAction(
      [purchase(buyer)],
      "ListingPurchased",
      buyer,
      false,
      [tx],
      100,
    )?.txHash,
  ).toBe(tx.hash);
});
it("uses event identity, so insertion/reordering cannot replay earlier progress", () => {
  const before = purchase(buyer),
    after = purchase(buyer, "0x" + "d".repeat(64));
  expect(tourEvents([after, before], new Set([eventIdentity(before)]))).toEqual(
    [after],
  );
  expect(
    ownTourAction(
      [purchase(other), after],
      "ListingPurchased",
      buyer,
      true,
      [],
      100,
    ),
  ).toBe(after);
});
