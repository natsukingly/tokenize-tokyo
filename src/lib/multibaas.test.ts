import { it, expect, vi, afterEach } from "vitest";
import {
  ContractsApi,
  EventQueriesApi,
  ChainsApi,
} from "@curvegrid/multibaas-sdk";
import {
  queryRows,
  readContract,
  sendViaMultiBaas,
  clients,
} from "./multibaas";
import { eventQuery } from "./queries";
const address = "0x" + "a".repeat(40),
  from = "0x" + "b".repeat(40);
vi.mock("./config", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./config")>();
  return {
    ...actual,
    config: {
      ...actual.config,
      url: "https://local-test.invalid",
      key: "test-only",
      chainId: 31337,
      addresses: {
        ...actual.config.addresses,
        registry: "0x" + "a".repeat(40),
      },
    },
  };
});
afterEach(() => {
  vi.restoreAllMocks();
});
it("fails closed without deployment credentials", () =>
  expect(() => clients("", "")).toThrow("DApp User"));
it("paginates indexed rows instead of silently losing events after page one", async () => {
  const api = vi.spyOn(EventQueriesApi.prototype, "executeArbitraryEventQuery");
  api
    .mockResolvedValueOnce({
      data: {
        result: { rows: Array.from({ length: 50 }, (_, id) => ({ id })) },
      },
    } as never)
    .mockResolvedValueOnce({
      data: { result: { rows: [{ id: 50 }] } },
    } as never);
  const q = eventQuery("AssetRegistered", address);
  expect(await queryRows(q)).toHaveLength(51);
  expect(api).toHaveBeenNthCalledWith(2, q, 50, 50);
});
it("uses the SDK to read integer state without floating point conversion", async () => {
  const api = vi
    .spyOn(ContractsApi.prototype, "callContractFunction")
    .mockResolvedValue({
      data: {
        result: { kind: "MethodCallResponse", output: "90071992547409930" },
      },
    } as never);
  expect(await readContract("registry", "nextAssetId")).toBe(
    "90071992547409930",
  );
  expect(api).toHaveBeenCalledWith(
    address,
    "urbanassetregistry",
    "nextAssetId",
    { args: [], formatInts: "as_strings" },
  );
});
it("composes unsigned SDK transaction, uses browser signing and waits for success", async () => {
  const api = vi
    .spyOn(ContractsApi.prototype, "callContractFunction")
    .mockResolvedValue({
      data: {
        result: {
          kind: "TransactionToSignResponse",
          submitted: false,
          tx: { from, to: address, data: "0xabcd", value: "0" },
        },
      },
    } as never);
  const hash = "0x" + "c".repeat(64);
  const request = vi.fn(async ({ method }) =>
    method === "eth_accounts"
      ? [from]
      : method === "eth_sendTransaction"
        ? hash
        : "0x7a69",
  );
  vi.spyOn(ChainsApi.prototype, "getTransactionReceipt").mockResolvedValue({
    data: { result: { data: { status: "0x1" } } },
  } as never);
  expect(
    await sendViaMultiBaas(
      { request },
      from,
      "registry",
      "requestVerification",
      ["1"],
    ),
  ).toBe(hash);
  expect(api).toHaveBeenCalledWith(
    address,
    "urbanassetregistry",
    "requestVerification",
    { from, args: ["1"], signAndSubmit: false, formatInts: "as_strings" },
  );
  expect(request).toHaveBeenCalledWith({
    method: "eth_sendTransaction",
    params: [{ from, to: address, data: "0xabcd", value: "0x0" }],
  });
});
it("rejects chain mismatch before composition", async () => {
  const api = vi.spyOn(ContractsApi.prototype, "callContractFunction");
  await expect(
    sendViaMultiBaas(
      { request: async () => "0x1" },
      from,
      "registry",
      "registerAsset",
    ),
  ).rejects.toThrow("Switch");
  expect(api).not.toHaveBeenCalled();
});
it("rejects server-submitted writes and reverted browser transactions", async () => {
  const api = vi
    .spyOn(ContractsApi.prototype, "callContractFunction")
    .mockResolvedValue({
      data: { result: { kind: "TransactionToSignResponse", submitted: true } },
    } as never);
  await expect(
    sendViaMultiBaas(
      {
        request: async ({ method }) =>
          method === "eth_accounts" ? [from] : "0x7a69",
      },
      from,
      "registry",
      "registerAsset",
    ),
  ).rejects.toThrow("server-signed");
  api.mockResolvedValue({
    data: {
      result: {
        kind: "TransactionToSignResponse",
        submitted: false,
        tx: { from, to: address, data: "0xabcd", value: "0" },
      },
    },
  } as never);
  const request = vi.fn(async ({ method }) =>
    method === "eth_accounts"
      ? [from]
      : method === "eth_sendTransaction"
        ? "0x" + "c".repeat(64)
        : "0x7a69",
  );
  vi.spyOn(ChainsApi.prototype, "getTransactionReceipt").mockResolvedValue({
    data: { result: { data: { status: "0x0" } } },
  } as never);
  await expect(
    sendViaMultiBaas({ request }, from, "registry", "registerAsset"),
  ).rejects.toThrow("reverted");
});

it("aborts before signing when the account changes during MultiBaas composition", async () => {
  const api = vi
    .spyOn(ContractsApi.prototype, "callContractFunction")
    .mockResolvedValue({
      data: {
        result: {
          kind: "TransactionToSignResponse",
          submitted: false,
          tx: { from, to: address, data: "0xabcd", value: "0" },
        },
      },
    } as never);
  let accountReads = 0;
  const request = vi.fn(async ({ method }) =>
    method === "eth_accounts"
      ? [++accountReads === 1 ? from : address]
      : "0x7a69",
  );
  await expect(
    sendViaMultiBaas({ request }, from, "registry", "registerAsset"),
  ).rejects.toThrow("account changed");
  expect(api).toHaveBeenCalledOnce();
  expect(
    request.mock.calls.some(([arg]) => arg.method === "eth_sendTransaction"),
  ).toBe(false);
});
it("reports the transaction hash immediately and confirms through the configured-chain SDK", async () => {
  const hash = "0x" + "d".repeat(64);
  vi.spyOn(ContractsApi.prototype, "callContractFunction").mockResolvedValue({
    data: {
      result: {
        kind: "TransactionToSignResponse",
        submitted: false,
        tx: { from, to: address, data: "0xabcd", value: "0" },
      },
    },
  } as never);
  vi.spyOn(ChainsApi.prototype, "getTransactionReceipt").mockResolvedValue({
    data: { result: { data: { status: "0x1" } } },
  } as never);
  const progress = vi.fn();
  await sendViaMultiBaas(
    {
      request: async ({ method }) =>
        method === "eth_accounts"
          ? [from]
          : method === "eth_sendTransaction"
            ? hash
            : "0x7a69",
    },
    from,
    "registry",
    "registerAsset",
    [],
    progress,
  );
  expect(progress.mock.calls.map(([p]) => p.phase)).toEqual([
    "preparing",
    "signature",
    "submitted",
    "confirmed",
  ]);
  expect(progress).toHaveBeenCalledWith({ phase: "submitted", hash });
});
