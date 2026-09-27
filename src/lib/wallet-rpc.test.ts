import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ContractsApi, ChainsApi } from "@curvegrid/multibaas-sdk";
import { decodeFunctionData, getAddress, parseAbi, zeroHash } from "viem";
import { sendViaMultiBaas, sendVerifiedCallViaMultiBaas } from "./multibaas";
import { sendWalletCall } from "./wallet-rpc";

const rpc = vi.hoisted(() => ({
  getCode: vi.fn(),
  call: vi.fn(),
  getTransactionReceipt: vi.fn(),
}));
vi.mock("./sepolia-rpc", () => ({
  usesSepoliaRpc: () => true,
  sepoliaRpc: async () => rpc,
}));
vi.mock("./config", async (original) => ({
  ...(await original<typeof import("./config")>()),
  config: {
    chainId: 11155111,
    rpc: "https://rpc.invalid",
    addresses: {
      registry: "0x" + "a".repeat(40),
      settlement: "0x" + "c".repeat(40),
    },
  },
}));
const from = "0x" + "b".repeat(40),
  target = "0x" + "a".repeat(40),
  hash = "0x" + "d".repeat(64);
let current: string, chain: string;
const request = vi.fn(
  async ({
    method,
  }: {
    method: string;
    params?: unknown[];
  }): Promise<unknown> => {
    if (method === "eth_chainId") return chain;
    if (method === "eth_accounts") return [current];
    if (method === "eth_sendTransaction") return hash;
    throw new Error("Unexpected wallet request: " + method);
  },
);
beforeEach(() => {
  current = from;
  chain = "0xaa36a7";
  request.mockClear();
  rpc.getCode.mockReset().mockResolvedValue("0x6000");
  rpc.call.mockReset().mockResolvedValue({ data: "0x" });
  rpc.getTransactionReceipt
    .mockReset()
    .mockResolvedValue({ status: "success" });
  vi.spyOn(ContractsApi.prototype, "callContractFunction").mockRejectedValue({
    response: { status: 429 },
  });
  vi.spyOn(ChainsApi.prototype, "getTransactionReceipt").mockRejectedValue({
    response: { status: 429 },
  });
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});
const submissions = () =>
  request.mock.calls.filter(([r]) => r.method === "eth_sendTransaction");

it("registers using exact locally encoded arguments with no MultiBaas composition or receipt call", async () => {
  const geo = "0x" + "e".repeat(64),
    metadata = 'data:application/json,{"name":"Roof"}';
  const progress = vi.fn();
  expect(
    await sendViaMultiBaas(
      { request },
      from,
      "registry",
      "registerAsset",
      [geo, metadata, 0],
      progress,
    ),
  ).toBe(hash);
  const tx = submissions()[0][0].params![0] as {
    from: string;
    to: string;
    value: string;
    data: `0x${string}`;
  };
  expect(tx).toMatchObject({ from, to: target, value: "0x0" });
  expect(
    decodeFunctionData({
      abi: parseAbi(["function registerAsset(bytes32,string,uint8)"]),
      data: tx.data,
    }).args,
  ).toEqual([geo, metadata, 0]);
  expect(rpc.call).toHaveBeenCalledWith({
    account: from,
    to: target,
    data: tx.data,
    value: 0n,
  });
  expect(ContractsApi.prototype.callContractFunction).not.toHaveBeenCalled();
  expect(ChainsApi.prototype.getTransactionReceipt).not.toHaveBeenCalled();
  expect(progress.mock.calls.map(([p]) => p.phase)).toEqual([
    "preparing",
    "signature",
    "submitted",
    "confirmed",
  ]);
  expect(submissions()).toHaveLength(1);
});

it("approves only the requested spender and exact amount, preserving integer precision", async () => {
  const amount = "9007199254740993123456789";
  await sendViaMultiBaas({ request }, from, "settlement", "approve", [
    target,
    amount,
  ]);
  const tx = submissions()[0][0].params![0] as { data: `0x${string}` };
  expect(
    decodeFunctionData({
      abi: parseAbi(["function approve(address,uint256)"]),
      data: tx.data,
    }).args,
  ).toEqual([getAddress(target), BigInt(amount)]);
});

it("uses precisely the reviewed ENS target and calldata", async () => {
  await sendVerifiedCallViaMultiBaas({ request }, from, {
    address: target,
    label: "resolver",
    method: "setText",
    args: [],
    data: "0x12345678",
  });
  expect(submissions()[0][0].params![0]).toEqual({
    from,
    to: target,
    value: "0x0",
    data: "0x12345678",
  });
  expect(ContractsApi.prototype.callContractFunction).not.toHaveBeenCalled();
});

it("stops before a wallet prompt when simulation rejects contract authorization or lifecycle", async () => {
  rpc.call.mockRejectedValue(new Error("Verifier required"));
  await expect(
    sendViaMultiBaas({ request }, from, "registry", "verifyAsset", ["1", true]),
  ).rejects.toThrow("Verifier required");
  expect(submissions()).toHaveLength(0);
});

it("rejects an account change during preflight and a wrong wallet network", async () => {
  rpc.call.mockImplementation(async () => {
    current = target;
    return {};
  });
  await expect(
    sendWalletCall({ request }, from, target, "0x12345678"),
  ).rejects.toThrow("account changed");
  current = from;
  chain = "0x1";
  await expect(
    sendWalletCall({ request }, from, target, "0x12345678"),
  ).rejects.toThrow("Switch");
  expect(submissions()).toHaveLength(0);
});

it("rejects absent bytecode, invalid calldata and actions outside the explicit core ABI", async () => {
  rpc.getCode.mockResolvedValue("0x");
  await expect(
    sendWalletCall({ request }, from, target, "0x12345678"),
  ).rejects.toThrow("No contract");
  await expect(
    sendWalletCall({ request }, from, target, "0x123"),
  ).rejects.toThrow("Invalid transaction");
  await expect(
    sendViaMultiBaas({ request }, from, "registry", "grantRole", [
      zeroHash,
      from,
    ]),
  ).rejects.toThrow();
  expect(submissions()).toHaveLength(0);
});

it("does not fall back or submit again after the wallet rejects", async () => {
  const rejected = Object.assign(new Error("User rejected"), { code: 4001 });
  const wallet = {
    request: vi.fn(async (r: { method: string; params?: unknown[] }) => {
      if (r.method === "eth_sendTransaction") throw rejected;
      return request(r);
    }),
  };
  await expect(sendWalletCall(wallet, from, target, "0x12345678")).rejects.toBe(
    rejected,
  );
  expect(
    wallet.request.mock.calls.filter(
      ([r]) => r.method === "eth_sendTransaction",
    ),
  ).toHaveLength(1);
  expect(rpc.getTransactionReceipt).not.toHaveBeenCalled();
  expect(ContractsApi.prototype.callContractFunction).not.toHaveBeenCalled();
});

it("keeps the submitted hash pending when receipt lookup fails, without resubmission", async () => {
  rpc.getTransactionReceipt.mockRejectedValue(new Error("RPC offline"));
  const progress = vi.fn();
  await expect(
    sendWalletCall({ request }, from, target, "0x12345678", progress),
  ).rejects.toThrow("was submitted");
  expect(progress).toHaveBeenLastCalledWith({ phase: "pending", hash });
  expect(submissions()).toHaveLength(1);
});

it("waits for the original transaction receipt without relying on the wallet's current network", async () => {
  vi.useFakeTimers();
  rpc.getTransactionReceipt.mockRejectedValueOnce({
    name: "TransactionReceiptNotFoundError",
  });
  const result = sendWalletCall({ request }, from, target, "0x12345678");
  await vi.advanceTimersByTimeAsync(1);
  chain = "0x1";
  await vi.advanceTimersByTimeAsync(1500);
  expect(await result).toBe(hash);
  expect(rpc.getTransactionReceipt).toHaveBeenLastCalledWith({ hash });
  expect(submissions()).toHaveLength(1);
});

it("reports a mined revert and does not proceed as if approval succeeded", async () => {
  rpc.getTransactionReceipt.mockResolvedValue({ status: "reverted" });
  const progress = vi.fn();
  await expect(
    sendWalletCall({ request }, from, target, "0x12345678", progress),
  ).rejects.toThrow("reverted");
  expect(progress).toHaveBeenLastCalledWith({ phase: "reverted", hash });
  expect(submissions()).toHaveLength(1);
});
