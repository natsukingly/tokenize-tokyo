import type { Address, Hex } from "viem";
import { sepoliaRpc } from "./sepolia-rpc";
import {
  assertWallet,
  isAddress,
  isTxHash,
  type TransactionProgress,
} from "./wallet";
import { walletTransaction, type WalletProvider } from "./transactions";

/** Submit a locally encoded, reviewed call once through the user's wallet. */
export async function sendWalletCall(
  provider: WalletProvider,
  from: string,
  address: string,
  data: string,
  progress?: (value: TransactionProgress) => void,
) {
  if (
    !isAddress(from) ||
    !isAddress(address) ||
    /^0x0{40}$/i.test(address) ||
    !/^0x([0-9a-f]{2}){4,}$/i.test(data)
  )
    throw new Error("Invalid transaction target or calldata.");
  const tx = walletTransaction(
    { from, to: address, data, value: "0" },
    from,
    address,
  );
  progress?.({ phase: "preparing" });
  await assertWallet(provider, from);
  const rpc = await sepoliaRpc();
  const code = await rpc.getCode({ address: address as Address });
  if (!code || code === "0x")
    throw new Error(
      "No contract exists at the configured transaction address.",
    );
  // eth_call is non-mutating and checks permissions/lifecycle before a prompt.
  await rpc.call({
    account: from as Address,
    to: address as Address,
    data: data as Hex,
    value: 0n,
  });
  await assertWallet(provider, from);
  progress?.({ phase: "signature" });
  // No fallback or retry after requesting submission: it may already be mined.
  const hash = String(
    await provider.request({ method: "eth_sendTransaction", params: [tx] }),
  );
  if (!isTxHash(hash))
    throw new Error("Wallet returned an invalid transaction hash.");
  progress?.({ phase: "submitted", hash });
  for (let i = 0; i < 60; i++) {
    let receipt;
    try {
      receipt = await rpc.getTransactionReceipt({ hash: hash as Hex });
    } catch (error) {
      if (
        (error as { name?: string })?.name !== "TransactionReceiptNotFoundError"
      )
        break;
    }
    if (receipt) {
      if (receipt.status !== "success") {
        progress?.({ phase: "reverted", hash });
        throw new Error(
          "Transaction reverted. Open the transaction to inspect the receipt.",
        );
      }
      progress?.({ phase: "confirmed", hash });
      return hash;
    }
    await new Promise((resolve) => setTimeout(resolve, 1500));
  }
  progress?.({ phase: "pending", hash });
  throw new Error(
    "Transaction was submitted; confirmation is still pending. Check the explorer before retrying.",
  );
}
