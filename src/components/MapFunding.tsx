import { ArrowUpRight } from "lucide-react";
import { formatEther } from "viem";
import { fundingPicks, type Campaign } from "@/lib/funding";
import AssetIcon from "./AssetIcon";
import styles from "./MapFunding.module.css";

export default function MapFunding({
  projects,
  onView,
}: {
  projects: Campaign[];
  onView: (id: string) => void;
}) {
  return (
    <section aria-label="Funding project picks" className={styles.picks}>
      <p>
        Open revenue offers, chosen by funding progress and a mix of asset
        types.
      </p>
      {fundingPicks(projects).map((c) => (
        <button key={c.listing.id} onClick={() => onView(c.asset.id)}>
          <div className={styles.title}>
            <AssetIcon kind={c.asset.kind} size={18} />
            <strong>{c.asset.name}</strong>
            <ArrowUpRight size={15} />
          </div>
          <div className={styles.meta}>
            <span>{c.asset.kind}</span>
            <b>{Math.round(c.percent)}% subscribed</b>
          </div>
          <div className={styles.track}>
            <span style={{ width: `${Math.min(100, c.percent)}%` }} />
          </div>
          <small>
            {Number(formatEther(BigInt(c.listing.unitPrice))).toLocaleString(
              "en-US",
            )}{" "}
            mJPY / unit · View project
          </small>
        </button>
      ))}
      {!projects.length && <p>No open funding projects match your filters.</p>}
    </section>
  );
}
