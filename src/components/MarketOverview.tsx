"use client";
import { useMemo, useState } from "react";
import { formatEther } from "viem";
import { ArrowRight } from "lucide-react";
import type { MarketState } from "@/lib/model";
import { marketAnalytics, type ActivityPeriod } from "@/lib/analytics";
import type { AssetKind } from "@/lib/catalog";
import styles from "./MarketOverview.module.css";
import PlatformCharts from "./PlatformCharts";

const money = (n: bigint) =>
  Number(formatEther(n)).toLocaleString("en", { maximumFractionDigits: 1 });
const proportion = (a: bigint, b: bigint) =>
  b > 0n ? Number((a * 10000n) / b) / 100 : 0;
const periodLabels: Record<ActivityPeriod, string> = {
  "12h": "Last 12 hours",
  "24h": "Last 24 hours",
  daily: "Last 7 days",
  weekly: "Last 4 weeks",
};
const chartLabels: Record<ActivityPeriod, string> = {
  "12h": "Twelve-hour",
  "24h": "Twenty-four-hour",
  daily: "Seven-day",
  weekly: "Four-week",
};
export default function MarketOverview({
  state,
  rightsAddress,
  demo,
  onFilter,
  onReview,
  onFunded,
}: {
  state: MarketState;
  rightsAddress: string;
  demo: boolean;
  onFilter: (kind: AssetKind) => void;
  onReview: () => void;
  onFunded: () => void;
}) {
  const [period, setPeriod] = useState<ActivityPeriod>("24h");
  const data = useMemo(
    () => marketAnalytics(state, rightsAddress, Date.now(), period),
    [state, rightsAddress, period],
  );
  const maxCategory = Math.max(1, ...data.categories.map((c) => c.total));
  return (
    <section className={styles.overview} aria-label="Market analysis">
      <div className={styles.heading}>
        <div>
          <span>FROM ACTIVITY TO ACTION</span>
          <h2>Is the city being put to work?</h2>
        </div>
        <small>
          {demo ? "Simulated browser events" : "MultiBaas indexed events"} ·
          {periodLabels[period]} · UTC
        </small>
      </div>
      <PlatformCharts data={data} onFilter={onFilter} />
      <div className={styles.grid}>
        <article className={styles.card}>
          <div className={styles.cardHead}>
            <h3>Market activity</h3>
            <select
              className={styles.period}
              aria-label="Activity period"
              value={period}
              onChange={(event) =>
                setPeriod(event.target.value as ActivityPeriod)
              }
            >
              {Object.entries(periodLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <ActivityChart days={data.daily} series="volume" period={period} />
          <ActivityChart days={data.daily} series="revenue" period={period} />
          <p className={styles.note}>
            mJPY · Test currency
            {(period === "12h" || period === "24h") && " · Hourly · UTC"}
            {period === "weekly" ? " · Current week is partial" : ""}
          </p>
          {!demo &&
            data.daily.filter((day) => day.volume > 0n || day.revenue > 0n)
              .length < 2 && (
              <a
                className={styles.example}
                href="/demo?view=dashboard&sample=1"
              >
                See sample history <ArrowRight size={12} />
              </a>
            )}
        </article>
        <article className={styles.card}>
          <div className={styles.cardHead}>
            <h3>Projects in operation</h3>
            <span className={styles.ratio}>
              {data.active} / {data.registered}
            </span>
          </div>
          <p className={styles.note}>
            “Operating” means a verifier marked the project as started. This
            demo does not verify construction or real-world operations.
          </p>
          <div className={styles.milestones}>
            <div>
              <b>{data.verified}</b>
              <span>Verified assets</span>
            </div>
            <div>
              <b>{data.fundedWaiting}</b>
              <span>Funded, awaiting start</span>
            </div>
            <div>
              <b>{data.active}</b>
              <span>Operating assets</span>
            </div>
          </div>
          <div
            className={styles.categoryList}
            aria-label="Activation by asset type"
          >
            {data.categories
              .filter((c) => c.total)
              .map((c) => (
                <button
                  key={c.kind}
                  onClick={() => onFilter(c.kind)}
                  aria-label={`Show ${c.kind} on map`}
                >
                  <span>{c.kind}</span>
                  <div
                    className={styles.track}
                    style={{ width: `${(c.total / maxCategory) * 100}%` }}
                  >
                    <i style={{ width: `${(c.active / c.total) * 100}%` }} />
                  </div>
                  <small>
                    {c.active}/{c.total} active <ArrowRight size={12} />
                  </small>
                </button>
              ))}
          </div>
          <p className={styles.note}>
            {data.activeArea.toLocaleString()} m² active space ·{" "}
            {data.activeCapacity.toLocaleString()} kWp estimated capacity. Both
            use simulated metadata; no measured impact is claimed.
          </p>
        </article>
      </div>
      <div className={styles.bottom}>
        <article className={styles.card}>
          <h3>Follow the deposited money</h3>
          <div className={styles.moneyFlow}>
            <div>
              <span>Deposited</span>
              <b>{money(data.deposited)}</b>
            </div>
            <ArrowRight size={17} />
            <div>
              <span>Withdrawn from vault</span>
              <b>{money(data.withdrawn)}</b>
            </div>
            <div>
              <span>Still in revenue vault</span>
              <b>
                {data.remainingRevenue === null
                  ? "Index catching up"
                  : money(data.remainingRevenue)}
              </b>
            </div>
          </div>
          <p className={styles.note}>
            mJPY · Withdrawals include income moved to BasketVault or
            FractionVault. The remaining balance is not your personal claimable
            amount or a promised yield.
          </p>
        </article>
        <article className={styles.card}>
          <h3>What needs attention?</h3>
          <div className={styles.actions}>
            {data.reviewQueue > 0 && (
              <button onClick={onReview}>
                <b>{data.reviewQueue}</b>
                <span>Asset / right reviews pending</span>
                <ArrowRight size={16} />
              </button>
            )}
            {data.fundedWaiting > 0 && (
              <button onClick={onFunded}>
                <b>{data.fundedWaiting}</b>
                <span>Allocated projects awaiting activation</span>
                <ArrowRight size={16} />
              </button>
            )}
            {data.activeWithoutRevenue > 0 && (
              <button onClick={onReview}>
                <b>{data.activeWithoutRevenue}</b>
                <span>Active revenue projects with no deposits yet</span>
                <ArrowRight size={16} />
              </button>
            )}
            {!data.reviewQueue &&
              !data.fundedWaiting &&
              !data.activeWithoutRevenue && (
                <p className={styles.note}>
                  No pending review or activation signal in these events. Select
                  an asset type above to explore available rights.
                </p>
              )}
          </div>
          <p className={styles.note}>
            Signals describe workflow state, not investment recommendations.
            Full allocation does not certify project funding needs.
          </p>
        </article>
      </div>
    </section>
  );
}

function ActivityChart({
  days,
  series,
  period,
}: {
  days: ReturnType<typeof marketAnalytics>["daily"];
  series: "volume" | "revenue";
  period: ActivityPeriod;
}) {
  const hourly = period === "12h" || period === "24h";
  const values = days.map((day) =>
    series === "revenue" ? day.cumulativeRevenue : day.volume,
  );
  const max = values.reduce((value, next) => (next > value ? next : value), 0n);
  const total = days.reduce((value, day) => value + day[series], 0n);
  const labelEvery = hourly ? Math.ceil(days.length / 6) : 1;
  const peakIndex =
    series === "revenue" ? values.lastIndexOf(max) : values.indexOf(max);
  const compact = (value: bigint) =>
    Number(formatEther(value)).toLocaleString("en", {
      notation: "compact",
      maximumFractionDigits: 1,
    });
  const points = values.map((value, i) => ({
    x: (i + 0.5) * (490 / days.length),
    y: 105 - proportion(value, max) * 0.75,
  }));
  const line = points.map((p) => `${p.x},${p.y}`).join(" ");
  return (
    <div className={styles.activityChart}>
      <div className={styles.metricHeading}>
        <span>
          {series === "volume"
            ? "Rights traded"
            : "Income deposited · cumulative"}
        </span>
        <strong>
          {money(total)} <small>mJPY</small>
        </strong>
      </div>
      {max === 0n ? (
        <p className={styles.empty}>
          {series === "volume"
            ? "No trades in this period."
            : "No income deposited in this period."}
        </p>
      ) : (
        <svg
          viewBox="0 0 490 130"
          role="img"
          aria-label={`${chartLabels[period]} ${series} in mJPY`}
        >
          <line
            x1="0"
            y1="105"
            x2="490"
            y2="105"
            stroke="currentColor"
            opacity=".2"
          />
          {series === "revenue" && (
            <>
              <line
                x1="0"
                y1="30"
                x2="490"
                y2="30"
                stroke="currentColor"
                opacity=".12"
                strokeDasharray="3 5"
              />
              <line
                x1="0"
                y1="67.5"
                x2="490"
                y2="67.5"
                stroke="currentColor"
                opacity=".12"
                strokeDasharray="3 5"
              />
              <polygon
                points={`${points[0].x},105 ${line} ${points.at(-1)!.x},105`}
                fill="#91cafa"
                opacity=".12"
              />
              <polyline
                points={line}
                fill="none"
                stroke="#91cafa"
                strokeWidth="2.5"
                strokeLinejoin="round"
              />
            </>
          )}
          {days.map((day, i) => {
            const height = proportion(values[i], max) * 0.75;
            const center = (i + 0.5) * (490 / days.length);
            return (
              <g key={day.day}>
                <title>
                  {hourly
                    ? `${day.day.slice(0, 10)} ${day.day.slice(11, 16)} UTC`
                    : day.day}
                  : {money(day[series])} mJPY
                  {series === "revenue"
                    ? ` deposited; ${money(values[i])} mJPY cumulative in this period`
                    : " traded"}
                </title>
                {series === "volume" ? (
                  <rect
                    x={(i + 0.225) * (490 / days.length)}
                    y={105 - height}
                    width={(490 / days.length) * 0.55}
                    height={height}
                    rx="2"
                    fill="var(--lime)"
                  />
                ) : (
                  <circle
                    cx={center}
                    cy={105 - height}
                    r="3.5"
                    fill="#91cafa"
                    stroke="var(--panel)"
                    strokeWidth="2"
                  />
                )}
                {values[i] > 0n && (!hourly || i === peakIndex) && (
                  <text
                    x={center}
                    y={98 - height}
                    textAnchor="middle"
                    fill="currentColor"
                    fontSize="12"
                  >
                    {compact(values[i])}
                  </text>
                )}
                {(i % labelEvery === 0 || i === days.length - 1) && (
                  <text
                    x={center}
                    y="125"
                    textAnchor="middle"
                    fill="currentColor"
                    fontSize="12"
                  >
                    {hourly
                      ? day.day.slice(11, 16)
                      : day.day.slice(5).replace("-", "/")}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      )}
      {series === "revenue" && (
        <p className={styles.note}>
          Cumulative deposits within the selected period. Flat sections mean no
          new deposits.
        </p>
      )}
    </div>
  );
}
