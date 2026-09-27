import {
  createPublicClient,
  http,
  parseAbi,
  type Abi,
  type Address,
} from "viem";
import { sepolia } from "viem/chains";
import { config, type ContractKey } from "./config";

const roles =
  "function hasRole(bytes32 role,address account) view returns(bool)";
const balances =
  "function balanceOfBatch(address[] accounts,uint256[] ids) view returns(uint256[])";
const claim =
  "function claimable(uint256 id,address holder) view returns(uint256)";
const abis: Record<ContractKey, Abi> = {
  registry: parseAbi([
    roles,
    "struct UrbanAsset { address issuer; bytes32 geoReference; string metadataURI; uint8 assetType; uint8 status; }",
    "function getAsset(uint256 id) view returns(UrbanAsset)",
  ]),
  rights: parseAbi([balances]),
  basket: parseAbi([balances, claim]),
  revenue: parseAbi([claim]),
  settlement: parseAbi([
    "function balanceOf(address account) view returns(uint256)",
  ]),
  market: [],
};
export type CoreRead = {
  contract: ContractKey;
  method: string;
  args: unknown[];
};

export function supportsBatchedReads(calls: CoreRead[]) {
  return (
    config.chainId === sepolia.id &&
    !!config.rpc &&
    calls.every((call) =>
      abis[call.contract].some(
        (item) => item.type === "function" && item.name === call.method,
      ),
    )
  );
}

let client: ReturnType<typeof createReader> | undefined;
let verifiedChain: Promise<void> | undefined;
function createReader() {
  return createPublicClient({
    chain: sepolia,
    transport: http(config.rpc, { timeout: 10000, retryCount: 1 }),
  });
}
function strings(value: unknown): unknown {
  if (typeof value === "bigint") return value.toString();
  if (Array.isArray(value)) return value.map(strings);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, strings(item)]),
    );
  return value;
}

/** Only whitelisted view calls. No wallet, signing or transaction transport. */
export async function readCoreBatch(calls: CoreRead[]): Promise<unknown[]> {
  if (!calls.length) return [];
  if (!supportsBatchedReads(calls))
    throw new Error("Unsupported batched contract read.");
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
  const result = await rpc.multicall({
    contracts: calls.map((call) => ({
      address: config.addresses[call.contract] as Address,
      abi: abis[call.contract],
      functionName: call.method,
      args: call.args,
    })),
    allowFailure: false,
    batchSize: 16384,
  });
  return result.map(strings);
}
