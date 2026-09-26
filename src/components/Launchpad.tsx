"use client";
import { useState } from "react";
import { ArrowUpRight, Plus } from "lucide-react";
import { formatEther } from "viem";
import { fundingCampaigns, type Campaign } from "@/lib/funding";
import type { MarketState } from "@/lib/model";
import MapThumbnail from "./MapThumbnail";
import styles from "./Launchpad.module.css";
const money = (value: bigint) =>
  Number(formatEther(value)).toLocaleString("en-US", {
    maximumFractionDigits: 2,
  });
export function FundingProgress({ campaign: c }: { campaign: Campaign }) {
  return (
    <div
      className={styles.progress}
      aria-label={`Funding progress for listing ${c.listing.id}`}
    >
      <div className={styles.amount}>
        <b>
          {money(c.raised)} <small>mJPY raised</small>
        </b>
        <span>
          {c.percent.toLocaleString("en-US", { maximumFractionDigits: 1 })}%
        </span>
      </div>
      <div
        className={styles.track}
        role="progressbar"
        aria-label="Offer subscribed"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.min(100, c.percent)}
      >
        <span style={{ width: `${Math.min(100, c.percent)}%` }} />
      </div>
      <div className={styles.labels}>
        <span>{money(c.target)} mJPY full subscription</span>
        <span>{c.supporters} supporting wallets</span>
      </div>
    </div>
  );
}
export default function Launchpad({
  market,
  demo,
  onView,
  onCreate,
}: {
  market: MarketState;
  demo: boolean;
  onView: (assetId: string) => void;
  onCreate: () => void;
}) {
  const [filter, setFilter] = useState("Open");
  const campaigns = fundingCampaigns(market).filter(
    (c) =>
      filter === "All offers" ||
      (filter === "Revenue shares"
        ? c.right.kind === "Revenue Share" && c.status === "Open"
        : c.status === "Open"),
  );
  return (
    <section className={styles.launchpad} aria-label="RWA launchpad">
      <div className={styles.intro}>
        <div>
          <h2>Fund a space’s next chapter.</h2>
          <p>Verified rights → fixed-price launch → community funding</p>
        </div>
        <button className="secondary" onClick={onCreate}>
          <Plus size={16} />
          Launch a right
        </button>
      </div>
      <p className={styles.disclosure}>
        {demo ? "Simulated fundraising in mJPY. " : "Test-token fundraising. "}
        Buyers receive the listed right; payments go directly to the issuer. No
        escrow, deadline or automatic refund if the offer is not fully
        subscribed. Funding does not prove activation.
      </p>
      <div className={styles.toolbar}>
        <label>
          Show
          <select
            aria-label="Launchpad filter"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            <option>Open</option>
            <option>Revenue shares</option>
            <option>All offers</option>
          </select>
        </label>
        <span>
          {campaigns.length} issuer offers ·{" "}
          {demo ? "Demo events" : "MultiBaas Event Queries"}
        </span>
      </div>
      <div className={styles.cards}>
        {campaigns.map((c) => (
          <article className={styles.card} key={c.listing.id}>
            <div className={styles.identity}>
              <MapThumbnail
                kind={c.asset.kind}
                coordinates={c.asset.coordinates}
              />
              <div>
                <span>
                  {c.asset.kind} · {c.status}
                </span>
                <h3>{c.asset.name}</h3>
                <small>{c.asset.district}</small>
              </div>
            </div>
            <div className={styles.right}>
              <b>{c.right.kind}</b>
              <span>
                {c.offered.toString()} offered ·{" "}
                {money(BigInt(c.listing.unitPrice))} mJPY / unit
              </span>
            </div>
            <FundingProgress campaign={c} />
            <p className={styles.terms}>
              {c.right.kind === "Revenue Share"
                ? "Receive a share of revenue actually deposited by the project. No guaranteed return."
                : "Acquire the stated time-limited usage permission. No passive income is included."}
            </p>
            <button
              className="secondary wide"
              onClick={() => onView(c.asset.id)}
            >
              Review rights & {c.status === "Open" ? "participate" : "history"}
              <ArrowUpRight size={16} />
            </button>
          </article>
        ))}
      </div>
      {!campaigns.length && (
        <p className="empty compact">
          No offers in this view. Tokenize and verify a right to launch an
          issuer offer.
        </p>
      )}
      <small className="map-preview-credit">
        Demo locations · ©{" "}
        <a
          href="https://www.openstreetmap.org/copyright"
          target="_blank"
          rel="noreferrer"
        >
          OpenStreetMap
        </a>{" "}
        ·{" "}
        <a href="https://openmaptiles.org" target="_blank" rel="noreferrer">
          OpenMapTiles
        </a>{" "}
        ·{" "}
        <a href="https://openfreemap.org" target="_blank" rel="noreferrer">
          OpenFreeMap
        </a>
      </small>
    </section>
  );
}
