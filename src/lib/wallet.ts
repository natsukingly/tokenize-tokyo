import { config } from "./config";
import type { WalletProvider } from "./transactions";

export const NETWORK_NAME =
  config.chainId === 2017072401
    ? "Curvegrid Testnet"
    : config.chainId === 11155111
      ? "Sepolia"
      : `Testnet ${config.chainId}`;
export const chainHex = () => `0x${config.chainId.toString(16)}`;
export const isAddress = (value: unknown): value is string =>
  typeof value === "string" && /^0x[0-9a-f]{40}$/i.test(value);
export const isTxHash = (value: unknown): value is string =>
  typeof value === "string" && /^0x[0-9a-f]{64}$/i.test(value);
export const transactionUrl = (hash: string) => `/tx/${hash}`;

export function walletError(error: unknown): string {
  const e = error as {
    code?: number;
    message?: string;
    shortMessage?: string;
    response?: { status?: number; data?: { message?: string } };
  };
  if (e?.code === 4001)
    return "Request cancelled in your wallet. Nothing else was sent.";
  if (e?.code === -32002)
    return "A wallet request is already open. Check your wallet extension.";
  const detail = [e?.response?.data?.message, e?.shortMessage, e?.message]
    .filter((value) => typeof value === "string")
    .join(" ");
  if (
    /insufficient funds|insufficient balance for (gas|transfer)/i.test(detail)
  )
    return config.chainId === 2017072401
      ? "Not enough test ETH for network fees. Open your account and choose Get test ETH, then retry. MockJPY cannot pay gas."
      : `Not enough test ETH for network fees. Fund this wallet on ${NETWORK_NAME}, then retry. MockJPY cannot pay gas.`;
  if (e?.response?.status === 403)
    return "MultiBaas access denied. Check the DApp key and allowed website origin.";
  return (
    e?.shortMessage || e?.message || "Wallet request failed. Please try again."
  );
}
export async function switchNetwork(provider: WalletProvider) {
  if (
    Number(
      BigInt(String(await provider.request({ method: "eth_chainId" }))),
    ) === config.chainId
  )
    return;
  try {
    await provider.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: chainHex() }],
    });
  } catch (error) {
    if ((error as { code?: number }).code !== 4902) throw error;
    if (!config.rpc) throw new Error("The testnet RPC is not configured.");
    await provider.request({
      method: "wallet_addEthereumChain",
      params: [
        {
          chainId: chainHex(),
          chainName: NETWORK_NAME,
          nativeCurrency: { name: "Test ETH", symbol: "ETH", decimals: 18 },
          rpcUrls: [config.rpc],
        },
      ],
    });
    await provider.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: chainHex() }],
    });
  }
  if (
    Number(
      BigInt(String(await provider.request({ method: "eth_chainId" }))),
    ) !== config.chainId
  )
    throw new Error(`Switch your wallet to ${NETWORK_NAME}.`);
}
export async function assertWallet(provider: WalletProvider, from: string) {
  const chain = Number(
    BigInt(String(await provider.request({ method: "eth_chainId" }))),
  );
  if (chain !== config.chainId)
    throw new Error(
      `Switch your wallet to ${NETWORK_NAME} (chain ${config.chainId}).`,
    );
  const accounts = (await provider.request({
    method: "eth_accounts",
  })) as string[];
  if (
    !isAddress(accounts?.[0]) ||
    accounts[0].toLowerCase() !== from.toLowerCase()
  )
    throw new Error(
      "Wallet account changed. Review the action again with the connected account.",
    );
}
export type TransactionProgress = {
  phase:
    | "preparing"
    | "signature"
    | "submitted"
    | "confirmed"
    | "reverted"
    | "pending";
  hash?: string;
};
export type RecentTransaction = TransactionProgress & {
  hash: string;
  label: string;
  account: string;
  chainId: number;
  createdAt: number;
};
export const transactionPhase: Record<TransactionProgress["phase"], string> = {
  preparing: "Preparing transaction",
  signature: "Confirm in your wallet",
  submitted: "Submitted · confirming",
  confirmed: "Confirmed",
  reverted: "Reverted",
  pending: "Confirmation pending",
};
