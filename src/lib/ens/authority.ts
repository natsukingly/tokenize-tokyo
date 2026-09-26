import {
  createPublicClient,
  http,
  parseAbi,
  encodeAbiParameters,
  keccak256,
  getAddress,
  type Address,
} from "viem";
import { config } from "../config";
import { ENSV2_DEPLOYMENT, parseEnsBinding } from "./deployment";

export const authorityAbi = parseAbi([
  "struct Node { address registry; string label; uint256 resource; address controller; }",
  "struct Binding { uint256 assetId; uint8 scope; address issuer; bytes32 geoReference; uint64 nonce; Node[] path; }",
  "struct Limits { bytes32 purpose; uint8 kind; uint8 policy; bool exclusive; uint64 minStart; uint64 maxEnd; uint64 validUntil; uint256 maxSupply; }",
  "struct Grant { uint64 bindingNonce; Limits limits; uint256 usedSupply; bool enabled; }",
  "function getBinding(bytes32 id) view returns (Binding)",
  "function getGrant(bytes32 id, address operator) view returns (Grant)",
  "function bindingExpiry(bytes32 id) view returns(uint64)",
  "function issuanceAvailable(bytes32 id, address operator) view returns (uint256)",
  "function rightsToken() view returns (address)",
  "function assetRegistry() view returns (address)",
  "function anchor() view returns (address)",
  "function factory() view returns (address)",
  "function userRegistryImplementation() view returns (address)",
  "function grantIssuance(bytes32 id,address operator,Limits limits)",
  "function revokeIssuance(bytes32 id,address operator)",
]);
export const eacAbi = parseAbi([
  "function grantRoles(uint256 id,uint256 roles,address who)",
  "function revokeRoles(uint256 id,uint256 roles,address who)",
  "function hasRoles(uint256 id,uint256 roles,address who) view returns(bool)",
]);
export const delegatedRightsAbi = parseAbi([
  "struct RightRequest { uint256 assetId; uint8 kind; uint256 supply; string terms; bytes32 termsHash; uint64 start; uint64 end; uint8 policy; uint8 scope; bytes32 purpose; bool exclusive; }",
  "function createScopedRightForIssuer(RightRequest q) returns(uint256)",
]);
export function ensBindingConfiguration() {
  return parseEnsBinding({
    authority: process.env.NEXT_PUBLIC_ENSV2_AUTHORITY_ADDRESS,
    parent: process.env.NEXT_PUBLIC_ENSV2_PARENT,
    assetId: process.env.NEXT_PUBLIC_ENSV2_ASSET_ID,
    scope: process.env.NEXT_PUBLIC_ENSV2_SCOPE,
  });
}
export function ensClient() {
  if (config.chainId !== 11155111)
    throw new Error("ENS delegation needs the Sepolia protocol deployment.");
  return createPublicClient({
    transport: http(
      config.rpc || "https://ethereum-sepolia-rpc.publicnode.com",
      { timeout: 15000, retryCount: 1 },
    ),
  });
}
export function bindingId(assetId: string, scope: number) {
  return keccak256(
    encodeAbiParameters(
      [{ type: "uint256" }, { type: "uint8" }],
      [BigInt(assetId), scope],
    ),
  );
}
export async function loadEnsBinding() {
  const setting = ensBindingConfiguration();
  if (!setting) throw new Error("ENS deployment is not configured.");
  const c = ensClient();
  if ((await c.getChainId()) !== 11155111)
    throw new Error("Sepolia RPC required.");
  const block = await c.getBlock();
  const read = (
    functionName:
      | "rightsToken"
      | "assetRegistry"
      | "anchor"
      | "factory"
      | "userRegistryImplementation",
  ) =>
    c.readContract({
      address: setting.authority,
      abi: authorityAbi,
      functionName,
      blockNumber: block.number,
    });
  const [rights, assets, anchor, factory, implementation] = await Promise.all([
    read("rightsToken"),
    read("assetRegistry"),
    read("anchor"),
    read("factory"),
    read("userRegistryImplementation"),
  ]);
  for (const [actual, expected] of [
    [rights, config.addresses.rights],
    [assets, config.addresses.registry],
    [anchor, ENSV2_DEPLOYMENT.ETHRegistry],
    [factory, ENSV2_DEPLOYMENT.VerifiableFactory],
    [implementation, ENSV2_DEPLOYMENT.UserRegistryImpl],
  ])
    if (getAddress(actual) !== getAddress(expected))
      throw new Error(
        "ENS authority does not match the configured Sepolia deployment.",
      );
  const id = bindingId(setting.assetId, setting.scope);
  const binding = await c.readContract({
    address: setting.authority,
    abi: authorityAbi,
    functionName: "getBinding",
    args: [id],
    blockNumber: block.number,
  });
  const expiry = await c.readContract({
    address: setting.authority,
    abi: authorityAbi,
    functionName: "bindingExpiry",
    args: [id],
    blockNumber: block.number,
  });
  if (
    binding.path.length !== 4 ||
    binding.nonce === 0n ||
    binding.path[0].label + ".eth" !== setting.parent
  )
    throw new Error("No registered space binding found.");
  return {
    setting,
    id,
    binding,
    expiry,
    name:
      [...binding.path]
        .reverse()
        .map((n) => n.label)
        .join(".") + ".eth",
    block: block.number,
  };
}
export type LiveEnsBinding = Awaited<ReturnType<typeof loadEnsBinding>>;
export type IssuanceGrant = {
  bindingNonce: bigint;
  limits: {
    purpose: `0x${string}`;
    kind: number;
    policy: number;
    exclusive: boolean;
    minStart: number;
    maxEnd: number;
    validUntil: number;
    maxSupply: bigint;
  };
  usedSupply: bigint;
  enabled: boolean;
};
export async function loadIssuanceGrant(
  live: LiveEnsBinding,
  operator: Address,
) {
  const c = ensClient();
  const grant = await c.readContract({
    address: live.setting.authority,
    abi: authorityAbi,
    functionName: "getGrant",
    args: [live.id, operator],
  });
  // A revoked, expired, detached or changed path is never presented as ready.
  let available = 0n;
  try {
    available = await c.readContract({
      address: live.setting.authority,
      abi: authorityAbi,
      functionName: "issuanceAvailable",
      args: [live.id, operator],
    });
  } catch {
    /* Fail closed. */
  }
  return { grant, available };
}
