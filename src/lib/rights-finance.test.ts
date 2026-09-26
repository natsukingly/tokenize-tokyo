import { describe, expect, it, vi, beforeEach } from "vitest";
import { decodeFunctionData } from "viem";
const mocks = vi.hoisted(() => ({
  call: vi.fn(),
  send: vi.fn(),
  queries: vi.fn(),
}));
vi.mock("./multibaas", () => ({
  clients: () => ({ contracts: { callContractFunction: mocks.call } }),
  sendAtMultiBaas: mocks.send,
  queryRows: mocks.queries,
}));
vi.mock("./config", () => ({
  config: {
    chainId: 31337,
    addresses: {
      rights: "0x1111111111111111111111111111111111111111",
      revenue: "0x2222222222222222222222222222222222222222",
      settlement: "0x3333333333333333333333333333333333333333",
    },
  },
}));
import {
  positiveUnits,
  payment,
  tuple,
  fractionAbi,
  financeIntent,
  sendFinanceIntent,
  financeEligibility,
  validateFinanceDeployment,
  loadFinance,
  loadFinanceActivity,
  financeAddresses,
} from "./rights-finance";
import type { Right } from "./model";

describe("real rights finance", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  it("rejects fractional, negative, unsafe and zero quantities", () => {
    for (const input of [
      "",
      "0",
      "-1",
      "1.1",
      "1e4",
      " 2",
      "1000000000000000001",
    ])
      expect(() => positiveUnits(input, 1000000000000000000n)).toThrow();
    expect(positiveUnits("1000", 1000n)).toBe(1000n);
    expect(() => positiveUnits("1001", 1000n)).toThrow();
    expect(payment("0.001")).toBe(1000000000000000n);
    expect(() => payment("1.0000000000000000001")).toThrow();
    expect(() => payment("0")).toThrow();
  });
  it("normalizes SDK tuple objects and arrays without losing bigint precision", () => {
    expect(
      tuple(
        ["9007199254740993", "1000", "1"],
        ["rightId", "sharesPerUnit", "underlyingUnits"],
      ).rightId,
    ).toBe("9007199254740993");
    expect(tuple({ rightId: "1" }, ["rightId"]).rightId).toBe("1");
    expect(() => tuple(null, ["rightId"])).toThrow();
    expect(() => tuple([], ["rightId"])).toThrow();
  });
  it("only wraps open revenue rights and rents exclusive usage rights", () => {
    const r = {
      kind: "Revenue Share",
      status: "Active",
      policy: "Open",
      endAt: 200,
      exclusive: false,
    } as Right;
    expect(financeEligibility(r, "fraction", 100)).toBe(true);
    expect(
      financeEligibility({ ...r, policy: "Allowlist" }, "fraction", 100),
    ).toBe(false);
    expect(financeEligibility(r, "fraction", 200)).toBe(false);
    expect(
      financeEligibility(
        { ...r, kind: "Usage Right", exclusive: true },
        "rental",
        100,
      ),
    ).toBe(true);
    expect(financeEligibility(r, "rental", 100)).toBe(false);
    expect(
      financeEligibility(
        { ...r, status: "Pending verification" },
        "fraction",
        100,
      ),
    ).toBe(false);
  });
  it("rejects unconfigured extension addresses before sending", () => {
    expect(() =>
      financeIntent("fraction", "redeem", [1n, 1000n], {
        fraction: "",
        rental: "",
      }),
    ).toThrow(/configured/);
  });
  it("encodes the exact reviewed quantity and passes expected calldata to the wallet adapter", async () => {
    const address = "0x4444444444444444444444444444444444444444";
    const intent = financeIntent("fraction", "createPool", [1n, 2n, 1000n], {
      fraction: address,
      rental: address,
    });
    const decoded = decodeFunctionData({ abi: fractionAbi, data: intent.data });
    expect(decoded.functionName).toBe("createPool");
    expect(decoded.args).toEqual([1n, 2n, 1000n]);
    mocks.send.mockResolvedValue("0xhash");
    const provider = { request: vi.fn() };
    await sendFinanceIntent(
      provider,
      "0x5555555555555555555555555555555555555555",
      intent,
    );
    expect(mocks.send).toHaveBeenCalledWith(
      provider,
      expect.any(String),
      address,
      "fractionvault",
      "createPool",
      ["1", "2", "1000"],
      undefined,
      intent.data,
    );
  });
  it("rejects extension contracts pointing at another protocol", async () => {
    mocks.call.mockResolvedValue({
      data: {
        result: {
          kind: "MethodCallResponse",
          output: "0x9999999999999999999999999999999999999999",
        },
      },
    });
    await expect(
      validateFinanceDeployment({
        fraction: "0x4444444444444444444444444444444444444444",
        rental: "0x5555555555555555555555555555555555555555",
      }),
    ).rejects.toThrow(/different protocol/);
  });
  it("never substitutes sandbox balances when extensions are unavailable", async () => {
    await expect(
      loadFinance(undefined, { fraction: "", rental: "" }),
    ).rejects.toThrow(/configured/);
    expect(mocks.call).not.toHaveBeenCalled();
    expect(financeAddresses).toHaveProperty("fraction");
  });
  const addresses = {
    fraction: "0x4444444444444444444444444444444444444444",
    rental: "0x5555555555555555555555555555555555555555",
  };
  function respond(counter = "2") {
    mocks.call.mockImplementation(async (_address, _label, method) => {
      const values: Record<string, unknown> = {
        rights: "0x1111111111111111111111111111111111111111",
        paymentToken: "0x3333333333333333333333333333333333333333",
        revenue: "0x2222222222222222222222222222222222222222",
        nextPoolId: counter,
        nextListingId: "2",
        nextOfferId: "2",
        getPool: { rightId: "1", sharesPerUnit: "1000", underlyingUnits: "2" },
        balanceOf: "500",
        claimable: "1250000000000000000",
        getListing: ["1", addresses.rental, "400", "1000000000000000", false],
        getOffer: [
          "2",
          addresses.rental,
          "1000000000000000000",
          "30",
          addresses.fraction,
          "2000000000",
          false,
        ],
        userOf: addresses.fraction,
        available: "false",
        withdrawable: false,
      };
      return {
        data: {
          result: { kind: "MethodCallResponse", output: values[method] },
        },
      };
    });
  }
  it("reads custody, personal income, offers and chain-authoritative rental status", async () => {
    respond();
    const state = await loadFinance(addresses.rental, addresses);
    expect(state.pools[0]).toMatchObject({
      balance: "500",
      claimable: "1250000000000000000",
      underlyingUnits: "2",
    });
    expect(state.listings[0]).toMatchObject({
      cancelled: false,
      remaining: "400",
    });
    expect(state.rentals[0]).toMatchObject({
      available: false,
      withdrawable: false,
      user: addresses.fraction,
    });
    const anonymous = await loadFinance(undefined, addresses);
    expect(anonymous.pools[0].balance).toBe("0");
    expect(anonymous.pools[0].claimable).toBe("0");
  });
  it("fails visibly for invalid API data or an oversized catalog", async () => {
    mocks.call.mockResolvedValue({
      data: { result: { kind: "TransactionToSignResponse" } },
    });
    await expect(loadFinance(undefined, addresses)).rejects.toThrow(
      /Unexpected/,
    );
    respond("202");
    await expect(loadFinance(undefined, addresses)).rejects.toThrow(
      /200-entry/,
    );
  });
  it("queries finance activity only at extension addresses and filters invalid hashes", async () => {
    mocks.queries.mockResolvedValue([
      { hash: "0x" + "a".repeat(64), block: "15" },
      { hash: "not-a-hash", block: "99" },
    ]);
    const rows = await loadFinanceActivity(addresses);
    expect(rows).toHaveLength(11);
    expect(rows.every((r) => r.block === 15)).toBe(true);
    expect(mocks.queries.mock.calls[0][0].events[0].filter.value).toBe(
      addresses.fraction,
    );
    expect(await loadFinanceActivity({ fraction: "", rental: "" })).toEqual([]);
  });
});
