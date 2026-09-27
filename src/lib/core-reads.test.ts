import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ContractsApi, EventQueriesApi } from "@curvegrid/multibaas-sdk";
import archive from "./generated/sepolia-bootstrap.json";

const rpc = vi.hoisted(() => ({
  getChainId: vi.fn(),
  multicall: vi.fn(),
}));
vi.mock("viem", async (importOriginal) => ({
  ...(await importOriginal<typeof import("viem")>()),
  createPublicClient: () => rpc,
}));
// Use the deployment's bootstrap plus a paginated index fixture. Balances
// below come from the mocked RPC, not events. No network is contacted.
vi.mock("./config", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./config")>();
  const archive = await import("./generated/sepolia-bootstrap.json");
  return {
    ...actual,
    config: {
      ...actual.config,
      chainId: 11155111,
      url: "https://fixture.multibaas.com",
      key: "test-only",
      rpc: "https://rpc.invalid",
      addresses: archive.default.addresses,
    },
  };
});
const holder = "0x1111111111111111111111111111111111111111";
beforeEach(() => {
  vi.resetModules();
  rpc.getChainId.mockReset().mockResolvedValue(11155111);
  rpc.multicall.mockReset();
});
afterEach(() => vi.restoreAllMocks());

it("loads 100 rights and accrued revenue without quota-limited SDK contract reads", async () => {
  const sdk = vi
    .spyOn(ContractsApi.prototype, "callContractFunction")
    .mockRejectedValue({ response: { status: 429 } });
  const index = vi
    .spyOn(EventQueriesApi.prototype, "executeArbitraryEventQuery")
    .mockImplementation(async (query, offset = 0, limit = 50) => {
      const name = query.events[0].eventName;
      const sample = archive.events.find((e) => e.name === "RightCreated")!;
      const rows =
        name === "RightCreated"
          ? Array.from({ length: 99 }, (_, i) => ({
              ...sample.args,
              rightId: String(i + 2),
              block: archive.toBlock + 1,
            }))
          : name === "BasketCreated"
            ? [
                {
                  basketId: "1",
                  rightIds: ["1"],
                  unitsPerShare: ["1"],
                  block: archive.toBlock + 1,
                },
              ]
            : [];
      return {
        data: { result: { rows: rows.slice(offset, offset + limit) } },
      } as never;
    });
  const precise = 900719925474099312345678901n;
  rpc.multicall.mockImplementation(async ({ contracts }) =>
    contracts.map((call: { functionName: string; args: unknown[] }) => {
      if (call.functionName === "balanceOf") return precise;
      if (call.functionName === "balanceOfBatch")
        return (call.args[1] as unknown[]).map(() => 0n);
      if (call.functionName === "getAsset") return { status: 2 };
      return precise;
    }),
  );
  const { loadMarket } = await import("./multibaas");
  const state = await loadMarket(holder);
  expect(state.rights).toHaveLength(100);
  expect(state.cash).toBe(String(precise));
  expect(Object.keys(state.balances)).toHaveLength(101);
  expect(Object.values(state.balances).every((v) => v === "0")).toBe(true);
  // A former holder with zero balance must still see claimable revenue.
  expect(Object.keys(state.claimable)).toHaveLength(101);
  expect(
    Object.values(state.claimable).every((v) => v === String(precise)),
  ).toBe(true);
  expect(sdk).not.toHaveBeenCalled();
  expect(index).toHaveBeenCalled();
  const accountBatches = rpc.multicall.mock.calls.filter(([batch]) =>
    batch.contracts.some(
      (call: { functionName: string }) => call.functionName === "balanceOf",
    ),
  );
  expect(accountBatches).toHaveLength(1);
  expect(accountBatches[0][0].allowFailure).toBe(false);
});

it("preserves boolean permissions, named tuples, arrays and uint256 precision", async () => {
  rpc.multicall.mockResolvedValue([
    true,
    { status: 2, metadataURI: "data:test", amount: 2n ** 255n },
    [0n, 2n ** 128n],
  ]);
  const { readCoreBatch } = await import("./core-reads");
  const result = await readCoreBatch([
    { contract: "registry", method: "hasRole", args: [] },
    { contract: "registry", method: "getAsset", args: [] },
    { contract: "rights", method: "balanceOfBatch", args: [] },
  ]);
  expect(result).toEqual([
    true,
    { status: 2, metadataURI: "data:test", amount: String(2n ** 255n) },
    ["0", String(2n ** 128n)],
  ]);
});

it("rejects the wrong RPC chain before reading balances and can recover", async () => {
  rpc.getChainId.mockResolvedValueOnce(1);
  const { readCoreBatch } = await import("./core-reads");
  const calls = [
    { contract: "settlement" as const, method: "balanceOf", args: [holder] },
  ];
  await expect(readCoreBatch(calls)).rejects.toThrow("wrong network");
  expect(rpc.multicall).not.toHaveBeenCalled();
  rpc.multicall.mockResolvedValue([1n]);
  expect(await readCoreBatch(calls)).toEqual(["1"]);
});

it("does not send writes or nonexistent rights.hasRole through the reader", async () => {
  const { readCoreBatch } = await import("./core-reads");
  await expect(
    readCoreBatch([{ contract: "settlement", method: "transfer", args: [] }]),
  ).rejects.toThrow("Unsupported");
  await expect(
    readCoreBatch([{ contract: "rights", method: "hasRole", args: [] }]),
  ).rejects.toThrow("Unsupported");
  expect(rpc.getChainId).not.toHaveBeenCalled();
  expect(rpc.multicall).not.toHaveBeenCalled();
});

it("rejects failed multicalls instead of returning fabricated zero balances", async () => {
  rpc.multicall.mockRejectedValue(new Error("execution reverted"));
  const { readCoreBatch } = await import("./core-reads");
  await expect(
    readCoreBatch([
      { contract: "settlement", method: "balanceOf", args: [holder] },
    ]),
  ).rejects.toThrow("execution reverted");
  expect(rpc.multicall.mock.calls[0][0].allowFailure).toBe(false);
});
