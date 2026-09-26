import { getAddress, keccak256, stringToHex, type Address } from "viem";
import { normalize } from "viem/ens";

export const ENSV2_CHAIN_ID = 11155111;
export const ENSV2_REFERENCE_COMMIT =
  "71a3b7339dbc55ab47667abdfe8303bac4f4c24e";
export const SPACE_LABELS = {
  Rooftop: "rooftop",
  Interior: "interior",
  Wall: "wall",
  Land: "land",
  "Whole asset": "whole",
} as const;

// Generated labels deliberately use a small ASCII alphabet. No address or arbitrary
// resolver record is treated as proof that someone controls a physical asset.
export function checkedLabel(value: string): string {
  if (!/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(value))
    throw new Error("Use a lowercase ASCII namespace label (1–63 characters)");
  return value;
}

export function spaceNamespace(input: {
  parent: string;
  district: string;
  assetId: string;
  scope: keyof typeof SPACE_LABELS;
}) {
  const parent = normalize(input.parent);
  if (!parent.endsWith(".eth") || parent.split(".").some((part) => !part))
    throw new Error(
      "Configure an actually controlled ENS parent ending in .eth",
    );
  if (
    !/^[1-9][0-9]*$/.test(input.assetId) ||
    BigInt(input.assetId) >= 2n ** 256n
  )
    throw new Error("Invalid asset ID");
  const district = checkedLabel(input.district);
  const asset = checkedLabel(`building-${input.assetId}`);
  const scope = SPACE_LABELS[input.scope];
  if (!scope) throw new Error("Unsupported spatial scope");
  // Root-to-leaf path BELOW the configured parent, not fabricated resolution.
  const labels = [district, asset, scope];
  return {
    parent,
    labels,
    name: [...labels].reverse().join(".") + "." + parent,
  };
}

export function namespaceIdentity(registry: Address, label: string) {
  checkedLabel(label);
  return {
    chainId: ENSV2_CHAIN_ID,
    registry: getAddress(registry),
    label,
    labelhash: keccak256(stringToHex(label)),
  };
}
