import { it, expect, vi, afterEach } from "vitest";
import { ContractsApi, EventQueriesApi } from "@curvegrid/multibaas-sdk";
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
        result: { rows: Array.from({ length: 500 }, (_, id) => ({ id })) },
      },
    } as never)
    .mockResolvedValueOnce({
      data: { result: { rows: [{ id: 500 }] } },
    } as never);
  const q = eventQuery("AssetRegistered", address);
  expect(await queryRows(q)).toHaveLength(501);
  expect(api).toHaveBeenNthCalledWith(2, q, 500, 500);
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
  const request = vi
    .fn()
    .mockResolvedValueOnce("0x7a69")
    .mockResolvedValueOnce("0xhash")
    .mockResolvedValueOnce({ status: "0x1" });
  expect(
    await sendViaMultiBaas(
      { request },
      from,
      "registry",
      "requestVerification",
      ["1"],
    ),
  ).toBe("0xhash");
  expect(api).toHaveBeenCalledWith(
    address,
    "urbanassetregistry",
    "requestVerification",
    { from, args: ["1"], signAndSubmit: false, formatInts: "as_strings" },
  );
  expect(request).toHaveBeenNthCalledWith(2, {
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
      { request: async () => "0x7a69" },
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
  const request = vi
    .fn()
    .mockResolvedValueOnce("0x7a69")
    .mockResolvedValueOnce("0xhash")
    .mockResolvedValueOnce({ status: "0x0" });
  await expect(
    sendViaMultiBaas({ request }, from, "registry", "registerAsset"),
  ).rejects.toThrow("reverted");
});
