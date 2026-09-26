import { it, expect } from "vitest";
import { assetStage } from "./lifecycle";
import { EMPTY, type Right, type MarketState } from "./model";
const right = {
  id: "1",
  assetId: "1",
  issuer: "0xowner",
  supply: "100",
  status: "Verified",
  endAt: 2000,
  startAt: 1,
} as Right;
function state(sold: string): MarketState {
  return {
    ...structuredClone(EMPTY),
    rights: [right],
    events: [
      {
        name: "ListingPurchased",
        contract: "market",
        block: 1,
        txHash: "0xtx",
        timestamp: "",
        args: {
          seller: "0xowner",
          token: "0xrights",
          rightId: "1",
          amount: sold,
        },
      },
    ],
  };
}
it("keeps funded and operating as separate milestones", () => {
  expect(assetStage("1", state("100"), false, "0xrights", 1000)).toBe("Funded");
});
it("does not mark a partial primary purchase as fully funded", () => {
  expect(assetStage("1", state("20"), true, "0xrights", 1000)).toBe("Funding");
});
it("secondary trades and expired rights do not inflate activation or funding", () => {
  const s = state("100");
  s.events[0].args.seller = "0xinvestor";
  expect(assetStage("1", s, false, "0xrights", 1000)).toBe("Dormant");
  expect(assetStage("1", state("100"), false, "0xrights", 3000)).toBe(
    "Dormant",
  );
});
it("counts an active right only during its operating period", () => {
  const s = state("0");
  s.rights = [{ ...right, status: "Active" }];
  expect(assetStage("1", s, true, "0xrights", 1000)).toBe("Active");
  expect(assetStage("1", s, true, "0xrights", 0)).toBe("Available");
});
