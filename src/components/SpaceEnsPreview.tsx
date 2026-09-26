import { ArrowUpRight, Network } from "lucide-react";
import { flattenNamespaces, namespaceHierarchy } from "@/lib/ens/hierarchy";
import type { Asset, Right } from "@/lib/model";
import styles from "./SpaceEnsPreview.module.css";
import { ensBindingConfiguration } from "@/lib/ens/authority";
import { config } from "@/lib/config";

export default function SpaceEnsPreview({
  asset,
  rights,
  onInspect,
  demo = true,
}: {
  asset: Asset;
  rights: Right[];
  onInspect: (name: string) => void;
  demo?: boolean;
}) {
  let setting = null;
  if (!demo && config.chainId === 11155111) {
    try {
      setting = ensBindingConfiguration();
    } catch {}
  }
  const nodes = flattenNamespaces(
    namespaceHierarchy([asset], rights, setting?.parent),
  );
  const space =
    nodes.find((n) => n.kind === "Space") ||
    nodes.find((n) => n.kind === "Asset");
  if (!space) return null;
  return (
    <section className={styles.preview} aria-label="Space ENS name">
      <div>
        <span>
          <Network size={13} /> ENS
        </span>
        <small>
          {setting?.assetId === asset.id
            ? "Inspect Sepolia binding"
            : "Unregistered preview"}
        </small>
      </div>
      <button onClick={() => onInspect(space.name)} title="View in ENS Index">
        <code>{space.name}</code>
        <ArrowUpRight size={14} />
      </button>
      <button className={styles.link} onClick={() => onInspect(space.name)}>
        View in ENS Index <ArrowUpRight size={12} />
      </button>
    </section>
  );
}
