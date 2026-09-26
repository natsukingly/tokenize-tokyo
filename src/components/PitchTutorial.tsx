"use client";
import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowRight, ArrowUpRight, Check, X } from "lucide-react";
import type { MarketState } from "@/lib/model";
import { useCoachmark } from "@/lib/use-coachmark";
import {
  PITCH_STEPS,
  PITCH_EVIDENCE,
  pitchBaseline,
  pitchProgress,
  pitchEvidenceUrl,
  type PitchStep,
} from "@/lib/pitch-tour";
import styles from "./Tutorial.module.css";

const copy: Record<PitchStep, [string, string]> = {
  discover: [
    "One roof, one project",
    "Show the city, then open the prepared rooftop project.",
  ],
  define: [
    "Describe the rooftop",
    "The example is filled in. Continue to rights, review, register, then submit the asset for verification.",
  ],
  "verify-asset": [
    "Review the asset",
    "You are now the demo verifier. Approve the rooftop before its owner issues any rights.",
  ],
  issue: [
    "Issue 100 revenue units",
    "You are now Owner A. Issue the prepared revenue right at 1,000 mJPY per unit.",
  ],
  "verify-right": [
    "Review the right",
    "As the demo verifier, approve this right separately from the asset.",
  ],
  publish: [
    "Open the offer",
    "Owner A offers all 100 units. Select Launch crowdfunding.",
  ],
  purchase: [
    "A different person participates",
    "Investor B is ready to buy 10 units. Review the terms, tick the checkbox and select Acquire right.",
  ],
  activate: [
    "Start the project",
    "The verifier activates the project separately from fundraising. Select Activate project.",
  ],
  deposit: [
    "Deposit project income",
    "The example deposit is 10,000 mJPY. Select Deposit revenue to distribute it to current holders.",
  ],
  claim: [
    "Receive the deposited income",
    "Investor B holds 10 of 100 units and can claim 1,000 mJPY. Select Claim revenue on this project's holding.",
  ],
  resale: [
    "Offer part of the holding",
    "Two units at 1,000 mJPY each are filled in. Select List for resale. An offer is not a completed sale.",
  ],
  dashboard: [
    "See what needs attention",
    "Show project activity and deposited money. My assets is the personal view; this dashboard covers the market.",
  ],
  proof: [
    "Inspect the deployed contracts",
    "Inspect a CloudWallet purchase with operator-paid gas and delivery to the buyer. The recorded Sepolia transactions are separate execution examples from the deployed app.",
  ],
  finish: [
    "Put idle spaces to work",
    "Return to the city and deliver your closing line. The pitch workflow is complete.",
  ],
};
const buttonText: Partial<Record<PitchStep, string>> = {
  "verify-asset": "Demo verify asset",
  issue: "Issue right",
  "verify-right": "Demo verify right",
  publish: "Launch crowdfunding",
  activate: "Activate project",
  deposit: "Deposit revenue",
  claim: "Claim revenue",
  resale: "List for resale",
};

export default function PitchTutorial(p: {
  state: MarketState;
  busy: boolean;
  container?: HTMLElement | null;
  onPrepare: (step: PitchStep, assetId?: string) => void;
  onClose: () => void;
}) {
  const [started, setStarted] = useState(false);
  const [index, setIndex] = useState(0);
  const [baseline, setBaseline] = useState(new Set<string>());
  const [inspected, setInspected] = useState(false);
  const panel = useRef<HTMLElement>(null);
  const current = PITCH_STEPS[index];
  const progress = pitchProgress(p.state, baseline);
  const ready =
    !p.busy && (current === "proof" ? inspected : progress.complete[current]);
  const position = useCoachmark(
    started,
    () => {
      const scope: ParentNode = p.container?.closest("dialog") || document;
      const visible = (selector: string) =>
        [...scope.querySelectorAll<HTMLElement>(selector)].find(
          (el) => el.getClientRects().length > 0,
        ) || null;
      if (current === "define")
        return visible(".tokenize-focus .wizard-body button.primary");
      if (current === "purchase") {
        const terms = visible(
          ".asset-detail .terms-check input",
        ) as HTMLInputElement | null;
        return terms && !terms.checked
          ? terms.closest("label")
          : visible(".asset-detail .purchase button.primary");
      }
      const text = buttonText[current];
      if (!text) return null;
      const buttons =
        current === "claim" || current === "resale"
          ? document.querySelectorAll<HTMLButtonElement>(
              `[data-holding="rights:${progress.right?.id}"] button`,
            )
          : scope.querySelectorAll<HTMLButtonElement>("button");
      return (
        [...buttons].find(
          (b) =>
            b.textContent?.trim() === text && b.getClientRects().length > 0,
        ) || null
      );
    },
    panel,
    p.container,
    `${started}:${current}:${p.state.events.length}:${p.busy}`,
  );

  const evidence = (kind: keyof typeof PITCH_EVIDENCE) => (
    <a
      className={styles.receipt}
      href={pitchEvidenceUrl(kind)}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => setInspected(true)}
    >
      {PITCH_EVIDENCE[kind].title} <ArrowUpRight size={14} />
    </a>
  );
  const card = (
    <section
      role="region"
      aria-label="Finalist demo"
      ref={panel}
      className={styles.card}
      style={{ left: position.left, top: position.top, width: position.width }}
    >
      <div className={styles.top}>
        <span>FINALIST DEMO</span>
        <button aria-label="Close finalist demo" onClick={p.onClose}>
          <X size={17} />
        </button>
      </div>
      <h2>{started ? copy[current][0] : "A guided rooftop project"}</h2>
      <p>
        {started
          ? copy[current][1]
          : "Follow one rooftop from issuance to purchase, income and resale. Example inputs and role switches are prepared for you."}
      </p>
      {!started && (
        <p>
          Clicks use the simulator. Explorer links open separate, recorded
          Sepolia transactions.
        </p>
      )}
      {started && current === "proof" && (
        <>
          {evidence("card")}
          {evidence("purchase")}
          {evidence("claim")}
        </>
      )}
      {started && ready && current === "purchase" && evidence("purchase")}
      {started && ready && current === "claim" && evidence("claim")}
      {started && ["proof", "purchase", "claim"].includes(current) && (
        <p className={styles.mode}>
          Recorded Sepolia examples · return to this tab to continue
        </p>
      )}
      <div className={styles.bottom}>
        {!started ? (
          <button
            className="primary"
            disabled={p.busy || !p.state.assets.length}
            onClick={() => {
              setBaseline(pitchBaseline(p.state));
              setStarted(true);
              p.onPrepare("discover");
            }}
          >
            Start guided demo <ArrowRight size={15} />
          </button>
        ) : (
          <button
            className="primary"
            disabled={!ready}
            onClick={() => {
              if (current === "finish") {
                p.onClose();
                return;
              }
              const next = PITCH_STEPS[index + 1];
              p.onPrepare(next, progress.asset?.id);
              setIndex(index + 1);
            }}
          >
            {current === "finish"
              ? "Finish demo"
              : current === "discover"
                ? "Open prepared project"
                : "Continue"}
            {ready ? <Check size={15} /> : <ArrowRight size={15} />}
          </button>
        )}
      </div>
      <div className={styles.mode}>
        Simulation · fictional project · no blockchain transactions
      </div>
    </section>
  );
  return p.container ? createPortal(card, p.container) : card;
}
