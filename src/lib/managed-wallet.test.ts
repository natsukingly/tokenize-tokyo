import { describe, expect, it, vi } from "vitest";
import { connectManagedWallet } from "./managed-wallet";
import type { WalletProvider } from "./transactions";

const account = "0x1111111111111111111111111111111111111111";
const other = "0x2222222222222222222222222222222222222222";
function fixture() {
  const request = vi.fn(
    async ({ method }: { method: string }): Promise<unknown> =>
      method === "eth_chainId" ? "0xaa36a7" : [account],
  );
  const provider: WalletProvider = { request };
  const wallet = {
    address: account,
    walletClientType: "privy",
    switchChain: vi.fn(async () => {}),
    getEthereumProvider: vi.fn(async () => provider),
  };
  return { wallet, provider, request };
}
describe("managed wallet connection", () => {
  it("binds the explicitly selected account after switching to the app chain", async () => {
    const { wallet, provider } = fixture();
    const result = await connectManagedWallet(wallet, 11155111);
    expect(wallet.switchChain).toHaveBeenCalledWith(11155111);
    expect(result.provider).toBe(provider);
    expect(result.name).toBe("Privy wallet");
  });
  it("never substitutes another account returned by the provider", async () => {
    const { wallet, request } = fixture();
    request.mockImplementation(async ({ method }) =>
      method === "eth_chainId" ? "0xaa36a7" : [other],
    );
    await expect(connectManagedWallet(wallet, 11155111)).rejects.toThrow(
      "selected account",
    );
  });
  it("rejects a declined or ineffective network switch", async () => {
    const { wallet, request } = fixture();
    request.mockImplementation(async ({ method }) =>
      method === "eth_chainId" ? "0x1" : [account],
    );
    await expect(connectManagedWallet(wallet, 11155111)).rejects.toThrow(
      "network",
    );
    wallet.switchChain.mockRejectedValueOnce(new Error("User rejected"));
    await expect(connectManagedWallet(wallet, 11155111)).rejects.toThrow(
      "User rejected",
    );
  });
  it("does not connect a wallet after cancellation during its async prompt", async () => {
    const { wallet } = fixture();
    let active = true;
    wallet.switchChain.mockImplementation(async () => {
      active = false;
    });
    await expect(
      connectManagedWallet(wallet, 11155111, () => active),
    ).rejects.toThrow("cancelled");
    expect(wallet.getEthereumProvider).not.toHaveBeenCalled();
  });
  it("rejects disconnection during provider loading", async () => {
    const { wallet, provider } = fixture();
    let active = true;
    wallet.getEthereumProvider.mockImplementation(async () => {
      active = false;
      return provider;
    });
    await expect(
      connectManagedWallet(wallet, 11155111, () => active),
    ).rejects.toThrow("cancelled");
  });
  it("rejects malformed accounts and chain responses", async () => {
    const { wallet, request } = fixture();
    wallet.address = "not-an-address";
    await expect(connectManagedWallet(wallet, 11155111)).rejects.toThrow(
      "address",
    );
    wallet.address = account;
    request.mockResolvedValue("bad");
    await expect(connectManagedWallet(wallet, 11155111)).rejects.toThrow();
  });
  it("labels external wallets separately from the embedded wallet", async () => {
    const { wallet } = fixture();
    wallet.walletClientType = "metamask";
    expect((await connectManagedWallet(wallet, 11155111)).name).toBe(
      "metamask",
    );
  });
});
