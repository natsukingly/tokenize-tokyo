import { expect, it, vi } from "vitest";
import { switchNetwork, walletError, isTxHash } from "./wallet";
import { config } from "./config";
vi.mock("./config", () => ({
  config: { chainId: 2017072401, rpc: "https://test.invalid/rpc" },
}));
it("adds the configured test chain only when the wallet does not know it", async () => {
  let chain = "0x1",
    registered = false;
  const request = vi.fn(async ({ method, params }) => {
    if (method === "eth_chainId") return chain;
    if (method === "wallet_addEthereumChain") {
      registered = true;
      return null;
    }
    if (method === "wallet_switchEthereumChain") {
      if (!registered) throw { code: 4902 };
      chain = params[0].chainId;
    }
  });
  await switchNetwork({ request });
  expect(Number(BigInt(chain))).toBe(config.chainId);
  expect(
    request.mock.calls.filter(([r]) => r.method === "wallet_addEthereumChain"),
  ).toHaveLength(1);
});
it("does not override a cancelled network request", async () => {
  const request = vi.fn(async ({ method }) => {
    if (method === "eth_chainId") return "0x1";
    throw { code: 4001 };
  });
  await expect(switchNetwork({ request })).rejects.toEqual({ code: 4001 });
  expect(request).toHaveBeenCalledTimes(2);
  expect(walletError({ code: 4001 })).toMatch("cancelled");
});
it("only links real transaction hashes", () => {
  expect(isTxHash("0x" + "f".repeat(64))).toBe(true);
  expect(isTxHash("simulated-1")).toBe(false);
});
