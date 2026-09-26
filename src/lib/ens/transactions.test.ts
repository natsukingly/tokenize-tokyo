import { it, expect, vi, afterEach } from "vitest";
import { ContractsApi, ChainsApi } from "@curvegrid/multibaas-sdk";
import { sendVerifiedCallViaMultiBaas } from "../multibaas";
import { encodeFunctionData, zeroHash } from "viem";
import { authorityAbi } from "./authority";
import { positionalArguments } from "./call";
const from = "0x" + "b".repeat(40),
  address = "0x" + "a".repeat(40),
  hash = "0x" + "c".repeat(64);
vi.mock("../config", () => ({
  config: {
    chainId: 11155111,
    url: "https://test.invalid",
    key: "test",
    addresses: {},
  },
  labels: {},
}));
afterEach(() => vi.restoreAllMocks());
it("converts named structs to positional MultiBaas tuples without changing the signed intent", () => {
  const args = [
    zeroHash,
    from,
    {
      purpose: zeroHash,
      kind: 1,
      policy: 0,
      exclusive: false,
      minStart: 1n,
      maxEnd: 100n,
      validUntil: 99n,
      maxSupply: 100n,
    },
  ];
  const converted = positionalArguments(authorityAbi, "grantIssuance", args);
  expect(converted[2]).toEqual([
    zeroHash,
    1,
    0,
    false,
    "1",
    "100",
    "99",
    "100",
  ]);
  expect(
    encodeFunctionData({
      abi: authorityAbi,
      functionName: "grantIssuance",
      args: converted as never,
    }),
  ).toBe(
    encodeFunctionData({
      abi: authorityAbi,
      functionName: "grantIssuance",
      args: args as never,
    }),
  );
});
it("rejects altered ENS calldata before asking the wallet to sign", async () => {
  vi.spyOn(ContractsApi.prototype, "callContractFunction").mockResolvedValue({
    data: {
      result: {
        kind: "TransactionToSignResponse",
        submitted: false,
        tx: { from, to: address, value: "0", data: "0x1234" },
      },
    },
  } as never);
  const request = vi.fn(async ({ method }) =>
    method === "eth_accounts" ? [from] : "0xaa36a7",
  );
  await expect(
    sendVerifiedCallViaMultiBaas({ request }, from, {
      address,
      label: "ensuserregistry",
      method: "grantRoles",
      args: [],
      data: "0x5678",
    }),
  ).rejects.toThrow("reviewed ENS action");
  expect(
    request.mock.calls.some(([call]) => call.method === "eth_sendTransaction"),
  ).toBe(false);
});
it("signs only the reviewed target and waits for a successful receipt", async () => {
  vi.spyOn(ContractsApi.prototype, "callContractFunction").mockResolvedValue({
    data: {
      result: {
        kind: "TransactionToSignResponse",
        submitted: false,
        tx: { from, to: address, value: "0", data: "0x1234" },
      },
    },
  } as never);
  vi.spyOn(ChainsApi.prototype, "getTransactionReceipt").mockResolvedValue({
    data: { result: { data: { status: "0x1" } } },
  } as never);
  const request = vi.fn(async ({ method }) =>
    method === "eth_accounts"
      ? [from]
      : method === "eth_sendTransaction"
        ? hash
        : "0xaa36a7",
  );
  expect(
    await sendVerifiedCallViaMultiBaas({ request }, from, {
      address,
      label: "ensuserregistry",
      method: "grantRoles",
      args: [],
      data: "0x1234",
    }),
  ).toBe(hash);
});
