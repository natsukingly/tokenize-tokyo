import { keccak256, stringToHex } from "viem";
import { SPACE_TYPES } from "../catalog";
import type { Asset, Right } from "../model";
import { checkedLabel, spaceNamespace, SPACE_LABELS } from "./spaces";

/** Illustrative only: never treated as an owned or resolved ENS registration. */
export const PREVIEW_PARENT = "tokenizetokyo.eth";
export type NamespaceNode = {
  name: string;
  label: string;
  title: string;
  kind: "City" | "District" | "Asset" | "Space" | "Right";
  children: NamespaceNode[];
  assetId?: string;
  rightId?: string;
  scope?: string;
};
const scopes = Object.keys(SPACE_LABELS) as (keyof typeof SPACE_LABELS)[];
function districtLabel(district: string) {
  const ward = district.split("·").at(-1)?.trim() || "Unspecified";
  const slug = ward
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 50)
    .replace(/-$/, "");
  return {
    ward,
    label: slug || `district-${keccak256(stringToHex(ward)).slice(2, 10)}`,
  };
}

export function namespaceHierarchy(
  assets: Asset[],
  rights: Right[],
  parent = PREVIEW_PARENT,
): NamespaceNode {
  const root: NamespaceNode = {
    name: parent,
    label: parent,
    title:
      parent === PREVIEW_PARENT
        ? "Tokyo · example parent"
        : "Tokyo · configured parent",
    kind: "City",
    children: [],
  };
  for (const asset of assets) {
    const { ward, label } = districtLabel(asset.district);
    const assetRights = rights.filter((right) => right.assetId === asset.id);
    const scopeIndexes = [
      ...new Set(
        assetRights.length
          ? assetRights.map((right) => right.scope)
          : [
              scopes.indexOf(
                SPACE_TYPES[asset.kind].scope as keyof typeof SPACE_LABELS,
              ),
            ],
      ),
    ];
    const spaces: NamespaceNode[] = [];
    for (const index of scopeIndexes) {
      const scope = scopes[index];
      if (!scope) continue;
      try {
        const path = spaceNamespace({
          parent,
          district: label,
          assetId: asset.id,
          scope,
        });
        spaces.push({
          name: path.name,
          label: SPACE_LABELS[scope],
          title: `${scope} scope`,
          kind: "Space",
          assetId: asset.id,
          scope,
          children: assetRights
            .filter((right) => right.scope === index)
            .map((right) => {
              const rightLabel = checkedLabel(`right-${right.id}`);
              return {
                name: `${rightLabel}.${path.name}`,
                label: rightLabel,
                title: `${right.kind} #${right.id}`,
                kind: "Right",
                assetId: asset.id,
                rightId: right.id,
                scope,
                children: [],
              };
            }),
        });
      } catch {
        // Malformed IDs cannot become canonical namespace paths.
      }
    }
    if (!spaces.length) continue;
    let district = root.children.find((node) => node.label === label);
    if (!district) {
      district = {
        name: `${label}.${parent}`,
        label,
        title: ward,
        kind: "District",
        children: [],
      };
      root.children.push(district);
    }
    district.children.push({
      name: `building-${asset.id}.${district.name}`,
      label: `building-${asset.id}`,
      title: asset.name,
      kind: "Asset",
      assetId: asset.id,
      children: spaces,
    });
  }
  root.children.sort((a, b) => a.label.localeCompare(b.label));
  return root;
}
export function flattenNamespaces(node: NamespaceNode): NamespaceNode[] {
  return [node, ...node.children.flatMap(flattenNamespaces)];
}
export function filterNamespaces(
  node: NamespaceNode,
  query: string,
): NamespaceNode | null {
  const match = query.trim().toLowerCase();
  if (
    !match ||
    `${node.label} ${node.title} ${node.name}`.toLowerCase().includes(match)
  )
    return node;
  const children = node.children
    .map((child) => filterNamespaces(child, query))
    .filter((child): child is NamespaceNode => child !== null);
  return children.length ? { ...node, children } : null;
}
