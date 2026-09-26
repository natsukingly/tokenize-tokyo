"use client";
import { useState } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { short, type ChainEvent } from "@/lib/model";
import { isTxHash, transactionUrl } from "@/lib/wallet";
import styles from "./ActivityFeed.module.css";

const PAGE_SIZE = 20;
export default function ActivityFeed({
  events,
  demo,
}: {
  events: ChainEvent[];
  demo: boolean;
}) {
  const [page, setPage] = useState(1);
  const [snapshotEnd, setSnapshotEnd] = useState(events.length);
  const end = page === 1 ? events.length : Math.min(snapshotEnd, events.length);
  const pages = Math.max(1, Math.ceil(end / PAGE_SIZE));
  const current = Math.min(page, pages);
  const offset = (current - 1) * PAGE_SIZE;
  const rows = events
    .slice(Math.max(0, end - offset - PAGE_SIZE), end - offset)
    .reverse();
  const pending = events.length - end;
  const latest = () => {
    setPage(1);
    setSnapshotEnd(events.length);
  };
  return (
    <div>
      {pending > 0 && (
        <button className={styles.newEvents} onClick={latest}>
          {pending} new events · Show latest
        </button>
      )}
      <div className="activity-table">
        <div className="table-head">
          <span>EVENT</span>
          <span>REFERENCE</span>
          <span>BLOCK</span>
          <span>TRANSACTION</span>
        </div>
        {rows.map((event, index) => (
          <div className="table-row" key={event.txHash + event.name + index}>
            <span>
              <i className="green" />
              {event.name}
            </span>
            <span>
              {event.args.assetId
                ? "Asset " + event.args.assetId
                : event.args.rightId
                  ? "Right " + event.args.rightId
                  : event.args.basketId
                    ? "Basket " + event.args.basketId
                    : "Protocol"}
            </span>
            <span>{event.block}</span>
            <span title={demo ? undefined : event.txHash}>
              {demo ? (
                "Simulated"
              ) : isTxHash(event.txHash) ? (
                <a
                  href={transactionUrl(event.txHash)}
                  target="_blank"
                  rel="noreferrer"
                  title="View transaction in explorer"
                >
                  {short(event.txHash)} ↗
                </a>
              ) : (
                "—"
              )}
            </span>
          </div>
        ))}
        {!rows.length && <p className={styles.empty}>No activity yet.</p>}
      </div>
      <nav className={styles.pagination} aria-label="Activity pages">
        <span aria-live="polite">
          {rows.length ? offset + 1 : 0}–{offset + rows.length} of {end} events
        </span>
        <div>
          <button onClick={latest} disabled={current === 1}>
            Latest
          </button>
          <button
            aria-label="Previous activity page"
            disabled={current === 1}
            onClick={() => setPage(current - 1)}
          >
            <ArrowLeft size={14} />
          </button>
          <span>
            Page {current} / {pages}
          </span>
          <button
            aria-label="Next activity page"
            disabled={current === pages}
            onClick={() => {
              if (current === 1) setSnapshotEnd(events.length);
              setPage(current + 1);
            }}
          >
            <ArrowRight size={14} />
          </button>
        </div>
      </nav>
    </div>
  );
}
