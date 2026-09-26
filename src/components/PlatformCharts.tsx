"use client";

import { useState } from "react";
import { formatEther } from "viem";
import { ArrowUpRight } from "lucide-react";
import { SPACE_TYPES, type AssetKind } from "@/lib/catalog";
import type { marketAnalytics } from "@/lib/analytics";
import styles from "./MarketOverview.module.css";

type Analytics = ReturnType<typeof marketAnalytics>;
const amount = (value: bigint) =>
  Number(formatEther(value)).toLocaleString("en", { maximumFractionDigits: 1 });
const compact = (value: bigint) =>
  Number(formatEther(value)).toLocaleString("en", {
    notation: "compact",
    maximumFractionDigits: 1,
  });
const percent = (value: bigint, total: bigint) =>
  total > 0n ? Number((value * 10000n) / total) / 100 : 0;
const percentLabel = (value: bigint, total: bigint) =>
  value > 0n && total > 0n && percent(value, total) === 0
    ? "<0.01%"
    : `${percent(value, total)}%`;

export default function PlatformCharts({
  data,
  onFilter,
}: {
  data: Analytics;
  onFilter: (kind: AssetKind) => void;
}) {
  const [basis, setBasis] = useState<"assets" | "income">("assets");
  const [selection, setSelection] = useState<string>();
  const segments = (
    basis === "assets"
      ? data.categories.map((c) => ({
          kind: c.kind as AssetKind | "Unclassified",
          value: BigInt(c.total),
        }))
      : data.revenueComposition.map((c) => ({ kind: c.kind, value: c.amount }))
  )
    .filter((c) => c.value > 0n)
    .map((c) => ({
      ...c,
      color: c.kind === "Unclassified" ? "#a0a6ae" : SPACE_TYPES[c.kind].color,
    }));
  const total = segments.reduce((sum, c) => sum + c.value, 0n);
  const selected = segments.find((c) => c.kind === selection);
  const trades = [
    {
      label: "Primary rights",
      value: data.primaryVolume,
      color: "var(--lime)",
    },
    {
      label: "Secondary rights",
      value: data.secondaryVolume,
      color: "#91cafa",
    },
    { label: "Basket trades", value: data.basketVolume, color: "#c1a9f5" },
    { label: "Unclassified", value: data.unmatchedVolume, color: "#a0a6ae" },
  ];
  const tradeTotal = trades.reduce((sum, c) => sum + c.value, 0n);
  const display = (value: bigint) =>
    basis === "assets" ? value.toLocaleString("en") : amount(value);
  let offset = 0;

  return (
    <>
      <section
        className={`metrics ${styles.impact}`}
        aria-label="Platform outcomes"
      >
        <article className={styles.impactPrimary}>
          <span>Revenue deposited</span>
          <strong>
            {amount(data.deposited)} <small>mJPY</small>
          </strong>
          <p>All-time deposits into project revenue vaults</p>
        </article>
        <article>
          <span>Assets with income</span>
          <strong>
            {data.revenueAssets} <small>/ {data.registered} registered</small>
          </strong>
          <p>Distinct assets with at least one positive deposit</p>
        </article>
        <article>
          <span>Settled trading volume</span>
          <strong>
            {amount(tradeTotal)} <small>mJPY</small>
          </strong>
          <p>Gross rights and Basket sales · not project revenue</p>
        </article>
      </section>
      <div className={styles.compositionGrid}>
        <article className={styles.card} aria-label="Asset composition">
          <div className={styles.cardHead}>
            <h3>What powers the platform?</h3>
            <div
              className={styles.chartToggle}
              role="group"
              aria-label="Composition metric"
            >
              {(["assets", "income"] as const).map((value) => (
                <button
                  key={value}
                  aria-pressed={basis === value}
                  onClick={() => {
                    setBasis(value);
                    setSelection(undefined);
                  }}
                >
                  {value === "assets" ? "Asset count" : "Income"}
                </button>
              ))}
            </div>
          </div>
          <p className={styles.note}>
            {basis === "assets"
              ? "Platform-wide registered assets by type · each space counted once"
              : "All-time indexed revenue deposits by asset type · mJPY test currency"}
          </p>
          {total === 0n ? (
            <p className={styles.chartEmpty}>
              {basis === "assets"
                ? "No registered assets yet."
                : "No revenue deposits indexed yet."}
            </p>
          ) : (
            <>
              <div className={styles.donutLayout}>
                <div className={styles.donut}>
                  <svg
                    viewBox="0 0 200 200"
                    role="img"
                    aria-label={
                      basis === "assets"
                        ? "Asset type distribution by registered asset count"
                        : "Revenue contribution by asset type"
                    }
                  >
                    <circle
                      cx="100"
                      cy="100"
                      r="76"
                      fill="none"
                      stroke="var(--line)"
                      strokeWidth="21"
                    />
                    {segments.map((s) => {
                      const share =
                        Number((s.value * 1000000n) / total) / 10000;
                      const start = offset;
                      offset += share;
                      return (
                        <circle
                          key={s.kind}
                          cx="100"
                          cy="100"
                          r="76"
                          fill="none"
                          pathLength="100"
                          stroke={s.color}
                          strokeWidth={selected?.kind === s.kind ? "26" : "21"}
                          strokeDasharray={`${share} ${100 - share}`}
                          strokeDashoffset={-start}
                          transform="rotate(-90 100 100)"
                          opacity={
                            !selected || selected.kind === s.kind ? 1 : 0.28
                          }
                        >
                          <title>
                            {s.kind}: {display(s.value)}{" "}
                            {basis === "assets" ? "assets" : "mJPY"} ·{" "}
                            {percentLabel(s.value, total)}
                          </title>
                        </circle>
                      );
                    })}
                  </svg>
                  <div className={styles.donutCenter} aria-live="polite">
                    <strong>
                      {selected
                        ? percentLabel(selected.value, total)
                        : basis === "assets"
                          ? total.toLocaleString("en")
                          : compact(total)}
                    </strong>
                    <span>
                      {selected?.kind ||
                        (basis === "assets"
                          ? "registered assets"
                          : "mJPY deposited")}
                    </span>
                  </div>
                </div>
                <div className={styles.chartLegend}>
                  {segments.map((s) => (
                    <button
                      key={s.kind}
                      aria-pressed={selected?.kind === s.kind}
                      onClick={() =>
                        setSelection(
                          selected?.kind === s.kind ? undefined : s.kind,
                        )
                      }
                    >
                      <i style={{ background: s.color }} aria-hidden="true" />
                      <span>
                        {s.kind}
                        <small>
                          {display(s.value)}{" "}
                          {basis === "assets" ? "assets" : "mJPY"}
                        </small>
                      </span>
                      <b>{percentLabel(s.value, total)}</b>
                    </button>
                  ))}
                </div>
              </div>
              {selected && selected.kind !== "Unclassified" && (
                <button
                  className={styles.chartLink}
                  onClick={() => onFilter(selected.kind as AssetKind)}
                >
                  Explore {selected.kind} assets <ArrowUpRight size={14} />
                </button>
              )}
            </>
          )}
          <p className={styles.note}>
            {basis === "assets"
              ? "Share of registered spaces, not token value or ownership. Select a category to inspect it."
              : "Includes funds deposited by projects. Moving or claiming those funds does not increase this total."}
          </p>
        </article>
        <article className={styles.card} aria-label="Trading composition">
          <div className={styles.cardHead}>
            <h3>Where does trading happen?</h3>
            <span className={styles.chartPeriod}>ALL TIME</span>
          </div>
          <p className={styles.note}>
            Settlement volume by market · {data.openListings} open listings ·
            mJPY test currency
          </p>
          {tradeTotal === 0n ? (
            <p className={styles.chartEmpty}>No settled trades indexed yet.</p>
          ) : (
            <div
              className={styles.stackedBar}
              role="img"
              aria-label="Primary, secondary and Basket share of settled trading volume"
            >
              {trades
                .filter((s) => s.value > 0n)
                .map((s) => (
                  <span
                    key={s.label}
                    style={{
                      flexGrow: Number((s.value * 1000000000n) / tradeTotal),
                      background: s.color,
                    }}
                    title={`${s.label}: ${amount(s.value)} mJPY · ${percentLabel(s.value, tradeTotal)}`}
                  />
                ))}
            </div>
          )}
          <div className={styles.tradeRows}>
            {trades
              .filter((s) => s.label !== "Unclassified" || s.value > 0n)
              .map((s) => (
                <div key={s.label}>
                  <i style={{ background: s.color }} aria-hidden="true" />
                  <span>{s.label}</span>
                  <strong>
                    {amount(s.value)} <small>mJPY</small>
                  </strong>
                  <b>{percentLabel(s.value, tradeTotal)}</b>
                </div>
              ))}
          </div>
          <p className={styles.note}>
            Primary rights are sales by the issuer; secondary rights are sales
            by other holders. Open listings add no volume.
          </p>
          {data.unmatchedVolume > 0n && (
            <p className={styles.note}>
              Unclassified trades are retained while their right or listing data
              catches up.
            </p>
          )}
          <p className={styles.note}>
            Fractional share trades and rental fees are tracked in Markets; they
            are not included in these totals.
          </p>
        </article>
      </div>
    </>
  );
}
