import { createPublicClient, http } from "viem";
import { sepolia } from "viem/chains";
import { config } from "./config";

export const usesSepoliaRpc = () =>
  config.chainId === sepolia.id && !!config.rpc;
let client: ReturnType<typeof createReader> | undefined;
let verifiedChain: Promise<void> | undefined;
function createReader() {
  return createPublicClient({
    chain: sepolia,
    transport: http(config.rpc, { timeout: 10000, retryCount: 1 }),
  });
}

/** Read/simulation client only. Wallet submission never goes through this transport. */
export async function sepoliaRpc() {
  if (!usesSepoliaRpc()) throw new Error("Sepolia RPC is not configured.");
  const rpc = (client ||= createReader());
  verifiedChain ||= rpc
    .getChainId()
    .then((chainId) => {
      if (chainId !== config.chainId)
        throw new Error("The read RPC is connected to the wrong network.");
    })
    .catch((error) => {
      verifiedChain = undefined;
      throw error;
    });
  await verifiedChain;
  return rpc;
}
