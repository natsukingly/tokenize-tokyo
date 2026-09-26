"use client";
import { useState } from "react";
import { fractionScenario, rentalScenario } from "@/lib/return-scenario";
import type { Offer } from "@/lib/finance-lab";
import styles from "./ReturnScenario.module.css";
const number = (v: string) => (v.trim() ? Number(v) : NaN);
const fmt = (v: number) =>
  v.toLocaleString("en-US", { maximumFractionDigits: 2 });
export default function ReturnScenario({
  offer,
  units,
}: {
  offer: Offer;
  units: number;
}) {
  const fraction = offer.mode === "fraction";
  const [income, setIncome] = useState(""),
    [costs, setCosts] = useState("0"),
    [exit, setExit] = useState(String(offer.price)),
    [months, setMonths] = useState("12");
  const validQuantity =
    Number.isSafeInteger(units) &&
    units > 0 &&
    units <= (fraction ? offer.available : offer.maxDays);
  const result = !validQuantity
    ? null
    : fraction
      ? fractionScenario({
          units,
          totalSupply: offer.total,
          price: offer.price,
          months: number(months),
          annualPoolIncome: number(income),
          resalePrice: number(exit),
          costs: number(costs),
        })
      : rentalScenario({
          days: units,
          price: offer.price,
          dailyRevenue: number(income),
          operatingCosts: number(costs),
        });
  const max = result ? Math.max(result.cost, result.proceeds, 1) : 1;
  return (
    <section className={styles.panel} aria-label="Return scenario">
      <header className={styles.heading}>
        <div>
          <span className="eyebrow">YOUR ASSUMPTIONS · MOCK CREDITS</span>
          <h3>
            {fraction
              ? "What could your investment return?"
              : "Could this space pay for itself?"}
          </h3>
        </div>
        <span className={styles.badge}>Scenario, not a forecast</span>
      </header>
      <p className={styles.note}>
        {fraction
          ? `${units || "—"} shares of ${offer.name}. Income is allocated by your share of the pool; a future buyer is not guaranteed.`
          : `${units || "—"} days at ${offer.name}. Model income from your planned use of the space. This is the renter’s operating return, not passive token yield.`}
      </p>
      <div className={styles.grid}>
        <div className={styles.inputs}>
          {fraction && (
            <label>
              Holding period (months)
              <input
                type="number"
                min="1"
                step="1"
                value={months}
                onChange={(e) => setMonths(e.target.value)}
              />
            </label>
          )}
          <label>
            {fraction
              ? "Annual distributable income of entire pool"
              : "Revenue from planned use per day"}
            <input
              type="number"
              min="0"
              step="any"
              placeholder="Enter your assumption"
              value={income}
              onChange={(e) => setIncome(e.target.value)}
            />
          </label>
          {fraction && (
            <label>
              Resale price per share
              <input
                type="number"
                min="0"
                step="any"
                value={exit}
                onChange={(e) => setExit(e.target.value)}
              />
            </label>
          )}
          <label>
            {fraction
              ? "Your total fees and costs"
              : "Operating costs for entire rental"}
            <input
              type="number"
              min="0"
              step="any"
              value={costs}
              onChange={(e) => setCosts(e.target.value)}
            />
          </label>
          <small>
            {fraction
              ? "Pool income means cash available for distribution after project expenses. Add your own fees and taxes separately. ROI covers the selected holding period, not an annualized rate."
              : "Include costs of running your activity. No subletting permission or real-world income is implied."}
          </small>
        </div>
        <div className={styles.output} aria-live="polite">
          {result ? (
            <>
              <div className={styles.metrics}>
                <div>
                  <span>
                    {fraction
                      ? "Holding-period ROI"
                      : "ROI on total operating spend"}
                  </span>
                  <strong
                    data-testid="scenario-roi"
                    className={result.profit < 0 ? styles.loss : styles.accent}
                  >
                    {result.roi > 0 ? "+" : ""}
                    {fmt(result.roi)}%
                  </strong>
                </div>
                <div>
                  <span>Net {result.profit < 0 ? "loss" : "profit"}</span>
                  <b>
                    {fmt(result.profit)} <small>credits</small>
                  </b>
                </div>
              </div>
              <figure
                className={styles.chart}
                aria-label="Cost and proceeds comparison"
              >
                <div className={styles.barLabel}>
                  <span>Total outlay</span>
                  <b>{fmt(result.cost)}</b>
                </div>
                <div className={styles.track}>
                  <div
                    className={styles.cost}
                    style={{ width: `${(result.cost / max) * 100}%` }}
                  />
                </div>
                <div className={styles.barLabel}>
                  <span>
                    {fraction ? "Income + resale proceeds" : "Business revenue"}
                  </span>
                  <b>{fmt(result.proceeds)}</b>
                </div>
                <div className={styles.track}>
                  <div
                    className={styles.income}
                    style={{ width: `${(result.income / max) * 100}%` }}
                  />
                  <div
                    className={styles.exit}
                    style={{ width: `${(result.exit / max) * 100}%` }}
                  />
                </div>
                <figcaption>
                  <span>Income: {fmt(result.income)}</span>
                  {fraction && <span>Resale: {fmt(result.exit)}</span>}
                </figcaption>
              </figure>
              <div className={styles.breakeven}>
                <span>
                  {fraction
                    ? "Break-even resale price / share"
                    : "Break-even revenue / day"}
                </span>
                <b>{fmt(result.breakEven)} credits</b>
              </div>
              {fraction && (
                <button
                  className="text-button"
                  onClick={() => {
                    setIncome("0");
                    setExit("0");
                  }}
                >
                  Stress test: no income, no resale
                </button>
              )}
            </>
          ) : (
            <p className={styles.empty}>
              {income === ""
                ? "Add an income assumption to see ROI, net profit and the break-even point."
                : "Enter valid non-negative amounts and a whole quantity within the available offer."}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
