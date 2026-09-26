import { getAddress, type Address } from "viem";
import { ENSV2_REFERENCE_COMMIT } from "./spaces";

// Official Sepolia deployment artifacts at this exact revision, not ENSv1.
export const ENSV2_DEPLOYMENT = {
  sourceCommit: ENSV2_REFERENCE_COMMIT,
  ETHRegistry: "0x657ea849311d3d5823348dded7c2aaafb3ede09e",
  VerifiableFactory: "0x9e726eb570beb6bceb495ab8cda7df517d4e841c",
  UserRegistryImpl: "0xa80338aaa8d23831cea25e858d1774534abb0263",
  PermissionedResolverImpl: "0x14f09fd05d4585759e54844dc9b00147131cf243",
  UniversalResolverV2: "0x5d25c1d6acbb71b7a28aa7899618a3412a8303e3",
  ETHRegistrar: "0xabe76f6c8dfced81aa5a2bb8034202a7136b94ca",
  MockUSDC: "0x16f95d91dba7da3aca778ec053df0ff6c6a8aa8e",
} as const;

export type EnsBindingConfig = {
  authority: Address;
  parent: string;
  assetId: string;
  scope: number;
};
export function parseEnsBinding(input: {
  authority?: string;
  parent?: string;
  assetId?: string;
  scope?: string;
}): EnsBindingConfig | null {
  if (!input.authority && !input.parent && !input.assetId) return null;
  const scope = Number(input.scope || "0");
  if (
    !input.authority ||
    !input.parent ||
    !/^[1-9][0-9]*$/.test(input.assetId || "") ||
    !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.eth$/.test(input.parent) ||
    !Number.isInteger(scope) ||
    scope < 0 ||
    scope > 4
  )
    throw new Error("Incomplete ENS deployment configuration");
  return {
    authority: getAddress(input.authority),
    parent: input.parent,
    assetId: input.assetId!,
    scope,
  };
}
