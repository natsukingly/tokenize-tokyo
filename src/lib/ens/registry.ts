import {
  getAddress,
  parseAbi,
  zeroAddress,
  type Address,
  type PublicClient,
} from "viem";
import { ENSV2_CHAIN_ID, checkedLabel, namespaceIdentity } from "./spaces";

// Minimal ABI checked against ensdomains/contracts-v2 at ENSV2_REFERENCE_COMMIT.
// This adapter is a read-only diagnostic, not an issuance authorization oracle.
export const ensRegistryAbi = parseAbi([
  "function getState(uint256 anyId) view returns ((uint8 status, uint64 expiry, address latestOwner, uint256 tokenId, uint256 resource) state)",
  "function getSubregistry(string label) view returns (address)",
  "function getResolver(string label) view returns (address)",
  "function getParent() view returns (address parent, string label)",
  "function roles(uint256 anyId, address account) view returns (uint256)",
]);

export type NamespaceState = {
  status: number;
  expiry: bigint;
  latestOwner: Address;
  tokenId: bigint;
  resource: bigint;
};
export type RegistryReader = {
  chainId(): Promise<number>;
  snapshot(): Promise<{ number: bigint; timestamp: bigint }>;
  state(
    registry: Address,
    labelhash: bigint,
    block: bigint,
  ): Promise<NamespaceState>;
  subregistry(
    registry: Address,
    label: string,
    block: bigint,
  ): Promise<Address>;
  resolver(registry: Address, label: string, block: bigint): Promise<Address>;
  parent(registry: Address, block: bigint): Promise<readonly [Address, string]>;
  roles(
    registry: Address,
    labelhash: bigint,
    account: Address,
    block: bigint,
  ): Promise<bigint>;
};

export function viemRegistryReader(client: PublicClient): RegistryReader {
  return {
    chainId: () => client.getChainId(),
    snapshot: async () => {
      const block = await client.getBlock();
      return { number: block.number, timestamp: block.timestamp };
    },
    state: (address, id, blockNumber) =>
      client.readContract({
        address,
        abi: ensRegistryAbi,
        functionName: "getState",
        args: [id],
        blockNumber,
      }),
    subregistry: (address, label, blockNumber) =>
      client.readContract({
        address,
        abi: ensRegistryAbi,
        functionName: "getSubregistry",
        args: [label],
        blockNumber,
      }),
    resolver: (address, label, blockNumber) =>
      client.readContract({
        address,
        abi: ensRegistryAbi,
        functionName: "getResolver",
        args: [label],
        blockNumber,
      }),
    parent: (address, blockNumber) =>
      client.readContract({
        address,
        abi: ensRegistryAbi,
        functionName: "getParent",
        blockNumber,
      }),
    roles: (address, id, account, blockNumber) =>
      client.readContract({
        address,
        abi: ensRegistryAbi,
        functionName: "roles",
        args: [id, account],
        blockNumber,
      }),
  };
}

export async function inspectNamespace(
  reader: RegistryReader,
  input: { anchor: Address; labels: string[]; operator?: Address },
) {
  if ((await reader.chainId()) !== ENSV2_CHAIN_ID)
    throw new Error(
      "ENSv2 prototype requires Sepolia; cross-chain authority is disabled",
    );
  if (!input.labels.length || input.labels.length > 8)
    throw new Error(
      "Provide a bounded root-to-leaf path including the controlled parent label",
    );
  input.labels.forEach(checkedLabel);
  const snapshot = await reader.snapshot();
  let registry = getAddress(input.anchor);
  if (registry === zeroAddress)
    throw new Error("Missing trusted registry anchor");
  const entries = [];
  for (const [index, label] of input.labels.entries()) {
    const identity = namespaceIdentity(registry, label);
    const state = await reader.state(
      registry,
      BigInt(identity.labelhash),
      snapshot.number,
    );
    if (
      state.status !== 2 ||
      state.expiry <= snapshot.timestamp ||
      state.latestOwner === zeroAddress
    )
      throw new Error(
        `Namespace ${label} is unregistered, reserved or expired`,
      );
    const [subregistry, resolver] = await Promise.all([
      reader.subregistry(registry, label, snapshot.number),
      reader.resolver(registry, label, snapshot.number),
    ]);
    entries.push({ ...identity, ...state, subregistry, resolver });
    if (index < input.labels.length - 1) {
      if (subregistry === zeroAddress)
        throw new Error(`Namespace ${label} has no attached subregistry`);
      const [parent, parentLabel] = await reader.parent(
        subregistry,
        snapshot.number,
      );
      if (getAddress(parent) !== registry || parentLabel !== label)
        throw new Error(`Canonical parent mismatch for ${label}`);
      registry = getAddress(subregistry);
    }
  }
  const leaf = entries[entries.length - 1];
  const explicitNamespaceRoles = input.operator
    ? await reader.roles(
        leaf.registry,
        BigInt(leaf.labelhash),
        getAddress(input.operator),
        snapshot.number,
      )
    : undefined;
  return {
    chainId: ENSV2_CHAIN_ID,
    blockNumber: snapshot.number,
    blockTimestamp: snapshot.timestamp,
    entries,
    explicitNamespaceRoles,
    // A scoped EAC bitmap says nothing about our separate issuance / verifier roles.
    authority: "namespace-inspection-only" as const,
  };
}

export const ENS_OPERATOR_ROLE = 1n << 24n; // Official name-scoped SET_RESOLVER.
export function namespaceDelegationCall(
  action: "grant" | "revoke",
  registry: Address,
  label: string,
  operator: Address,
) {
  if (action !== "grant" && action !== "revoke")
    throw new Error("Unknown delegation action");
  const identity = namespaceIdentity(registry, label);
  const account = getAddress(operator);
  if (account === zeroAddress || identity.registry === zeroAddress)
    throw new Error("Zero delegation address");
  return {
    chainId: ENSV2_CHAIN_ID,
    address: identity.registry,
    method: action === "grant" ? "grantRoles" : "revokeRoles",
    args: [
      BigInt(identity.labelhash).toString(),
      ENS_OPERATOR_ROLE.toString(),
      account,
    ],
    signAndSubmit: false as const,
  };
}
