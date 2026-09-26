"use client";
import { useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, ExternalLink, Search } from "lucide-react";
import { formatEther } from "viem";
import { short, type ChainEvent, type MarketState } from "@/lib/model";
import { config } from "@/lib/config";
import { isTxHash, transactionUrl } from "@/lib/wallet";
import styles from "./ActivityFeed.module.css";

const PAGE_SIZE = 20;
const filters = ["All activity", "Trades", "Income", "Projects"] as const;
type Filter = (typeof filters)[number];
const labels: Record<string, string> = {
  ListingPurchased: "Rights purchased",
  ListingCreated: "Offer opened",
  ListingCancelled: "Offer cancelled",
  RevenueDeposited: "Income deposited",
  RevenueClaimed: "Income withdrawn",
  BasketRevenueClaimed: "Basket income claimed",
  AssetRegistered: "Asset registered",
  AssetVerificationRequested: "Asset review requested",
  AssetVerified: "Asset verified",
  AssetRejected: "Asset rejected",
  AssetUpdated: "Asset updated",
  RightCreated: "Rights issued",
  RightVerified: "Rights reviewed",
  RightActivated: "Project activated",
  RightClosed: "Rights closed",
  RightScopeDefined: "Rights scope defined",
  BasketCreated: "Basket created",
  UnderlyingDeposited: "Rights bundled",
  BasketMinted: "Basket shares minted",
  BasketRedeemed: "Basket redeemed",
  TransferSingle: "Rights transferred",
  BasketTransferSingle: "Basket shares transferred",
};
const category = (event: ChainEvent): Filter =>
  event.name.includes("Revenue")
    ? "Income"
    : event.contract === "market"
      ? "Trades"
      : ["registry", "rights", "basket"].includes(event.contract)
        ? "Projects"
        : "All activity";
const valueOf = (event: ChainEvent) => {
  const value =
    event.name === "ListingPurchased"
      ? event.args.totalPrice
      : ["RevenueDeposited", "RevenueClaimed", "BasketRevenueClaimed"].includes(
            event.name,
          )
        ? event.args.amount
        : undefined;
  if (value === undefined || !/^\d+$/.test(String(value))) return null;
  return Number(formatEther(BigInt(String(value)))).toLocaleString("en", {
    maximumFractionDigits: 2,
  });
};

export default function ActivityFeed({
  state,
  demo,
}: {
  state: MarketState;
  demo: boolean;
}) {
  const { events } = state;
  const [filter, setFilter] = useState<Filter>("All activity");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [snapshotEnd, setSnapshotEnd] = useState(events.length);
  const end = page === 1 ? events.length : Math.min(snapshotEnd, events.length);
  const records = useMemo(() => {
    const assets = new Map(state.assets.map((asset) => [asset.id, asset]));
    const rights = new Map(state.rights.map((right) => [right.id, right]));
    const listings = new Map(
      state.listings.map((listing) => [listing.id, listing]),
    );
    const baskets = new Map(state.baskets.map((basket) => [basket.id, basket]));
    return events.slice(0, end).map((event) => {
      const listing = listings.get(String(event.args.listingId));
      const basketId =
        event.args.basketId ??
        (event.contract === "basket" ? event.args.id : undefined) ??
        (listing?.token === "basket" ? listing.rightId : undefined);
      const rightId =
        basketId === undefined
          ? (event.args.rightId ??
            (event.contract === "rights" ? event.args.id : undefined) ??
            listing?.rightId)
          : undefined;
      const assetId =
        event.args.assetId ?? rights.get(String(rightId))?.assetId;
      const asset = assets.get(String(assetId));
      const reference =
        basketId !== undefined
          ? `Basket ${basketId}`
          : rightId !== undefined
            ? `Right ${rightId}`
            : assetId !== undefined
              ? `Asset ${assetId}`
              : "Protocol";
      const name =
        basketId !== undefined
          ? baskets.get(String(basketId))?.name
          : asset?.name;
      const label =
        event.name === "ListingPurchased" && basketId !== undefined
          ? "Basket shares purchased"
          : labels[event.name] ||
            event.name.replace(/([a-z])([A-Z])/g, "$1 $2");
      return {
        event,
        reference,
        name,
        label,
        category: category(event),
        amount: valueOf(event),
      };
    });
  }, [state, events, end]);
  const matching = records.filter(
    (record) =>
      (filter === "All activity" || record.category === filter) &&
      `${record.name || ""} ${record.reference} ${record.event.name} ${record.label} ${record.event.txHash}`
        .toLowerCase()
        .includes(query.trim().toLowerCase()),
  );
  const pages = Math.max(1, Math.ceil(matching.length / PAGE_SIZE));
  const current = Math.min(page, pages);
  const offset = (current - 1) * PAGE_SIZE;
  const rows = matching
    .slice(
      Math.max(0, matching.length - offset - PAGE_SIZE),
      matching.length - offset,
    )
    .reverse();
  const pending = events.length - end;
  const latest = () => {
    setPage(1);
    setSnapshotEnd(events.length);
  };
  return (
    <section
      id="dashboard-activity"
      className={styles.feed}
      aria-label="Activity ledger"
    >
      <div className={styles.heading}>
        <div>
          <span className={styles.eyebrow}>FOLLOW THE TRANSACTIONS</span>
          <h2>Activity</h2>
          <p>Trades, income and project updates · All recorded history</p>
        </div>
        {!demo && config.url && (
          <div>
            <a
              className={styles.explorer}
              href={config.url}
              target="_blank"
              rel="noreferrer"
            >
              MultiBaas explorer <ExternalLink size={13} />
            </a>
          </div>
        )}
      </div>
      <div className={styles.toolbar}>
        <div className={styles.filters} role="group" aria-label="Activity type">
          {filters.map((value) => (
            <button
              key={value}
              aria-pressed={filter === value}
              onClick={() => {
                setFilter(value);
                latest();
              }}
            >
              {value}
            </button>
          ))}
        </div>
        <label className={styles.search}>
          <Search size={15} />
          <input
            type="search"
            aria-label="Search activity"
            placeholder="Asset, event or transaction"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              latest();
            }}
          />
        </label>
      </div>
      {!demo && events.some((event) => event.source === "rpc-bootstrap") && (
        <p className={styles.source}>
          Verified Sepolia setup logs + new activity indexed by MultiBaas.
        </p>
      )}
      {pending > 0 && (
        <button className={styles.newEvents} onClick={latest}>
          {pending} new events · Show latest
        </button>
      )}
      <div className={styles.tableWrap}>
        <table className={styles.table} aria-label="Activity transactions">
          <thead>
            <tr>
              <th>Event</th>
              <th>Asset / right</th>
              <th>Amount</th>
              <th>Time · UTC</th>
              <th>Transaction</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(
              ({ event, reference, name, label, category, amount }, index) => {
                const date = new Date(event.timestamp);
                const timestamp = Number.isFinite(date.getTime())
                  ? date.toISOString()
                  : null;
                return (
                  <tr
                    key={`${event.txHash}:${event.logIndex ?? index}:${event.name}`}
                  >
                    <td className={styles.event}>
                      <span
                        className={styles.eventLabel}
                        data-category={category}
                      >
                        {label}
                      </span>
                      <small>{event.name}</small>
                    </td>
                    <td className={styles.asset}>
                      {name && <span>{name}</span>}
                      <small>{reference}</small>
                    </td>
                    <td data-label="Amount" className={styles.amount}>
                      {amount === null ? (
                        "—"
                      ) : (
                        <>
                          <span>{amount}</span>
                          <small>mJPY</small>
                        </>
                      )}
                    </td>
                    <td data-label="Time · UTC">
                      {timestamp ? (
                        <time dateTime={timestamp}>
                          {timestamp.slice(5, 10)} · {timestamp.slice(11, 19)}
                        </time>
                      ) : (
                        "Time unavailable"
                      )}
                      <small>Block {event.block.toLocaleString("en")}</small>
                    </td>
                    <td data-label="Transaction">
                      {demo ? (
                        <span className={styles.simulated}>Simulated</span>
                      ) : isTxHash(event.txHash) ? (
                        <div>
                          <a
                            href={transactionUrl(event.txHash)}
                            target="_blank"
                            rel="noreferrer"
                            title={event.txHash}
                            aria-label={`View ${label.toLowerCase()} transaction ${event.txHash}`}
                          >
                            {short(event.txHash)} <ExternalLink size={12} />
                          </a>
                          {config.chainId === 11155111 && (
                            <a
                              className={styles.chainLink}
                              href={`https://sepolia.etherscan.io/tx/${event.txHash}`}
                              target="_blank"
                              rel="noreferrer"
                              aria-label={`View on Etherscan ${event.txHash}`}
                            >
                              Etherscan <ExternalLink size={10} />
                            </a>
                          )}
                        </div>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                );
              },
            )}
          </tbody>
        </table>
        {!rows.length && (
          <div className={styles.empty}>
            <p>
              {events.length
                ? "No activity matches these filters."
                : "No activity yet."}
            </p>
            {(filter !== "All activity" || query) && (
              <button
                onClick={() => {
                  setFilter("All activity");
                  setQuery("");
                  latest();
                }}
              >
                Clear filters
              </button>
            )}
          </div>
        )}
      </div>
      <nav className={styles.pagination} aria-label="Activity pages">
        <span aria-live="polite">
          {rows.length ? offset + 1 : 0}–{offset + rows.length} of{" "}
          {matching.length} events
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
    </section>
  );
}
