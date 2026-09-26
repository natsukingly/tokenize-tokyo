import type { WalletProvider } from "./transactions";

export type ManagedWallet = {
  address: string;
  walletClientType: string;
  switchChain(chainId: number): Promise<unknown>;
  getEthereumProvider(): Promise<WalletProvider>;
};

/** Never bind an SDK's default account in place of the account the user selected. */
export async function connectManagedWallet(
  wallet: ManagedWallet,
  chainId: number,
  isCurrent: () => boolean = () => true,
) {
  const current = () => {
    if (!isCurrent()) throw new Error("Wallet connection cancelled.");
  };
  if (!/^0x[\da-f]{40}$/i.test(wallet.address))
    throw new Error("Invalid wallet address.");
  current();
  await wallet.switchChain(chainId);
  current();
  const provider = await wallet.getEthereumProvider();
  current();
  const [accounts, chain] = await Promise.all([
    provider.request({ method: "eth_accounts" }),
    provider.request({ method: "eth_chainId" }),
  ]);
  current();
  if (
    !Array.isArray(accounts) ||
    typeof accounts[0] !== "string" ||
    accounts[0].toLowerCase() !== wallet.address.toLowerCase()
  )
    throw new Error("Wallet did not return the selected account.");
  if (Number(BigInt(String(chain))) !== chainId)
    throw new Error("Wallet is connected to a different network.");
  return {
    id: `${wallet.walletClientType}:${wallet.address.toLowerCase()}`,
    name:
      wallet.walletClientType === "privy"
        ? "Privy wallet"
        : wallet.walletClientType,
    expectedAccount: wallet.address,
    provider,
  };
}
