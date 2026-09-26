"use client";
import { useState } from "react";
import type { AssetKind } from "@/lib/catalog";
import {
  suggestedProject,
  parseAssumptions,
  projectScenarios,
  type ProjectAssumptions,
} from "@/lib/project-plan";
import styles from "./ProjectPlan.module.css";
const yen = (n: number) => `¥${Math.round(n).toLocaleString("en-US")}`;
export function ProjectEconomics({
  assumptions,
}: {
  assumptions: ProjectAssumptions;
}) {
  const rows = projectScenarios(assumptions);
  if (!rows.length)
    return (
      <p role="alert">
        Enter a positive setup budget, non-negative revenue and costs, and an
        allocation between 0% and 100%.
      </p>
    );
  return (
    <div className={styles.economics}>
      <div className={styles.table}>
        <table>
          <caption>
            Illustrative annual project economics · JPY assumptions
          </caption>
          <thead>
            <tr>
              <th>Scenario</th>
              <th>Revenue</th>
              <th>Costs</th>
              <th>Operating cash</th>
              <th>Cash / setup cost</th>
              <th>Simple payback</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.name}>
                <th>{r.name}</th>
                <td>{yen(r.revenue)}</td>
                <td>{yen(r.costs)}</td>
                <td>{yen(r.net)}</td>
                <td>{r.cashReturnPercent.toFixed(1)}%</td>
                <td>
                  {r.paybackYears === null
                    ? "Not recovered"
                    : `${r.paybackYears.toFixed(1)} years`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p>
        Conservative: revenue −35%, costs +20%. Strong: revenue +20%, costs
        +10%. Cash / setup cost is a project metric, not token-holder ROI.
        Simple payback assumes this annual cash repeats; it ignores timing,
        financing, taxes, resale value and future replacement costs.
      </p>
      <p>
        With {assumptions.distributionPercent}% of positive operating cash
        allocated to holders, the base case offers {yen(rows[1].distributable)}{" "}
        per year for the entire pool. Actual distributions require an eligible
        revenue right, agreed terms and deposited cash; these JPY assumptions
        are separate from test mJPY.
      </p>
    </div>
  );
}
export default function ProjectPlan({
  kind,
  name,
  overview,
  analysis,
  onChange,
  disabled = false,
}: {
  kind: AssetKind;
  name: string;
  overview: string;
  analysis: string;
  onChange: (overview: string, analysis: string) => void;
  disabled?: boolean;
}) {
  const [replace, setReplace] = useState(false);
  let assumptions: ProjectAssumptions | null = null;
  try {
    const a = JSON.parse(analysis);
    if (
      a &&
      [
        a.initialCost,
        a.annualRevenue,
        a.annualCosts,
        a.distributionPercent,
      ].every((v: unknown) => typeof v === "number" && Number.isFinite(v))
    )
      assumptions = a;
  } catch {}
  const draft = () => {
    const d = suggestedProject(kind, name);
    onChange(d.overview, JSON.stringify(d.assumptions));
    setReplace(false);
  };
  return (
    <section
      className={styles.editor}
      aria-label="Project overview and economics"
    >
      <div className={styles.heading}>
        <h3>Project overview</h3>
        {!disabled && (
          <button
            type="button"
            className="secondary"
            onClick={() => (overview.trim() ? setReplace(true) : draft())}
          >
            Use suggested plan
          </button>
        )}
      </div>
      <p>
        Describe how the space will work, who will pay, how funds are used and
        what could go wrong.
      </p>
      {replace && (
        <div className={styles.replace}>
          Replace your current description and assumptions with a suggested
          draft? <button onClick={draft}>Replace draft</button>
          <button onClick={() => setReplace(false)}>Keep mine</button>
        </div>
      )}
      <label className={styles.label}>
        Project description
        <textarea
          aria-label="Project description"
          rows={12}
          maxLength={2200}
          value={overview}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value, analysis)}
          placeholder="Use a suggested plan, then adapt it to the actual site, operator and business model."
        />
      </label>
      <small>
        AI-authored example plans · editable starting points, without a live AI
        call or site / market validation.
      </small>
      <details className={styles.details} open={!!assumptions}>
        <summary>Revenue potential & assumptions</summary>
        {assumptions ? (
          <>
            <div className={styles.inputs}>
              {(
                [
                  ["initialCost", "Initial setup budget (JPY)"],
                  ["annualRevenue", "Annual sales / booking revenue (JPY)"],
                  ["annualCosts", "Annual operating costs (JPY)"],
                  ["distributionPercent", "Cash allocated to holders (%)"],
                ] as const
              ).map(([key, label]) => (
                <label key={key}>
                  {label}
                  <input
                    type="number"
                    min={key === "initialCost" ? 1 : 0}
                    max={key === "distributionPercent" ? 100 : 1e12}
                    value={assumptions![key]}
                    disabled={disabled}
                    onChange={(e) =>
                      onChange(
                        overview,
                        JSON.stringify({
                          ...assumptions,
                          [key]: Number(e.target.value),
                        }),
                      )
                    }
                  />
                </label>
              ))}
            </div>
            <ProjectEconomics assumptions={assumptions} />
          </>
        ) : (
          <p>
            Use a suggested plan to start an editable scenario. Figures are
            examples, not market estimates.
          </p>
        )}
      </details>
    </section>
  );
}
