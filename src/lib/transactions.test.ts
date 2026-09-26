import { describe, it, expect } from "vitest";
import { walletTransaction } from "./transactions";
const from = "0x" + "a".repeat(40),
  to = "0x" + "b".repeat(40);
const tx = { from, to, value: "0", data: "0xabcd", gas: 100000, nonce: 4 };
describe("unsigned transaction boundary", () => {
  it("validates recipient/sender and drops stale nonce/gas", () =>
    expect(walletTransaction(tx, from, to)).toEqual({
      from,
      to,
      value: "0x0",
      data: "0xabcd",
    }));
  it.each([
    { ...tx, to: from },
    { ...tx, from: to },
    { ...tx, value: "1" },
    { ...tx, data: "garbage" },
    { ...tx, to: "" },
  ])("rejects mismatched or unexpected transactions", (bad) =>
    expect(() => walletTransaction(bad, from, to)).toThrow(),
  );
});
