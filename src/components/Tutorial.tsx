"use client";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Check,
  X,
} from "lucide-react";
import type { MarketState } from "@/lib/model";
import { ACTORS } from "@/lib/demo";
import { config } from "@/lib/config";
import {
  NETWORK_NAME,
  transactionUrl,
  type RecentTransaction,
} from "@/lib/wallet";
import {
  eventIdentity,
  ownTourAction,
  tourEvents,
  tourSteps,
  type TourMode,
  type TourStep,
} from "@/lib/tour";
import { useCoachmark } from "@/lib/use-coachmark";
import styles from "./Tutorial.module.css";

type Props = {
  container?: HTMLElement | null;
  request: number;
  state: MarketState;
  hasSelectedSpace: boolean;
  hasOpenOffer: boolean;
  demo: boolean;
  account: string;
  chainId: number | null;
  gasBalance: string | null;
  transactions: RecentTransaction[];
  onNavigate: (tab: string) => void;
  onActor: (actor: string) => void;
  onActive: (active: boolean) => void;
  onPitch?: () => void;
};
export default function Tutorial(p: Props) {
  const [closed, setClosed] = useState(0),
    [mode, setMode] = useState<TourMode | null>(null),
    [step, setStep] = useState(0);
  const [baseline, setBaseline] = useState(new Set<string>()),
    [startedAt, setStartedAt] = useState(0),
    [sessionAccount, setSessionAccount] = useState(""),
    [inspected, setInspected] = useState("");
  const panelRef = useRef<HTMLElement>(null);
  const welcomeRef = useRef<HTMLDialogElement>(null);
  const visible = p.request > closed;
  const welcomeOpen = visible && !mode;
  useEffect(() => {
    const dialog = welcomeRef.current;
    if (!welcomeOpen || !dialog) return;
    const opener = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    dialog.showModal();
    document.body.style.overflow = "hidden";
    dialog.querySelector<HTMLElement>("h2")?.focus();
    return () => {
      dialog.close();
      document.body.style.overflow = overflow;
      if (opener?.isConnected) opener.focus({ preventScroll: true });
    };
  }, [welcomeOpen]);
  const steps = tourSteps(mode || "buy", p.demo),
    current = steps[step];
  const walletStep = ["connect", "gas", "currency"].includes(current);
  const wrongWallet =
    !p.demo &&
    !!sessionAccount &&
    p.account.toLowerCase() !== sessionAccount.toLowerCase();
  const connected = !!p.account && p.chainId === config.chainId;
  useEffect(() => {
    if (p.request) {
      setMode(null);
      setStep(0);
      setInspected("");
      p.onActive(true);
    }
  }, [p.request]);
  useEffect(() => {
    if (visible && mode && !p.demo && !sessionAccount && p.account)
      setSessionAccount(p.account);
  }, [visible, mode, p.demo, p.account, sessionAccount]);
  const finish = () => {
    setClosed(p.request);
    p.onActive(false);
  };
  useEffect(() => {
    if (!visible) return;
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") finish();
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [visible, p.request]);
  const changes = tourEvents(p.state.events, baseline);
  const bought = ownTourAction(
    changes,
    "ListingPurchased",
    sessionAccount,
    p.demo,
    p.transactions,
    startedAt,
  );
  const registered = ownTourAction(
    changes,
    "AssetRegistered",
    sessionAccount,
    p.demo,
    p.transactions,
    startedAt,
  );
  const assetId = String(registered?.args.assetId || "");
  const asset = p.state.assets.find((a) => a.id === assetId);
  const right = p.state.rights.filter((r) => r.assetId === assetId).at(-1);
  const purchaseToken =
    String(bought?.args.token || "").toLowerCase() ===
    config.addresses.basket.toLowerCase()
      ? "basket"
      : "rights";
  const holdingReady =
    bought &&
    BigInt(
      p.state.balances[`${purchaseToken}:${String(bought.args.rightId)}`] ||
        "0",
    ) > 0n;
  const complete: Record<TourStep, boolean> = {
    connect: connected,
    gas: connected && p.gasBalance !== null && BigInt(p.gasBalance) > 0n,
    currency: connected && BigInt(p.state.cash) > 0n,
    discover: p.hasSelectedSpace && p.hasOpenOffer,
    purchase: !!bought,
    receipt: !!bought && inspected === bought.txHash,
    portfolio: !!holdingReady,
    define: !!registered,
    verify: asset?.status === "Verified",
    issue: !!right && ["Verified", "Active"].includes(right.status),
    publish:
      !!right &&
      changes.some(
        (e) =>
          e.name === "ListingCreated" &&
          String(e.args.rightId) === right.id &&
          String(e.args.seller).toLowerCase() === sessionAccount.toLowerCase(),
      ),
    funding: true,
  };
  const copy: Record<TourStep, [string, string]> = {
    connect: [
      "Connect your wallet",
      `Select your browser wallet and allow the switch to ${NETWORK_NAME}. Each transaction will ask for your approval.`,
    ],
    gas: [
      "Get test gas",
      "Choose Get test ETH and sign the request message. Already have test ETH? Continue without requesting more.",
    ],
    currency: [
      "Get MockJPY",
      "Choose Mint MockJPY and confirm the transaction. MockJPY is the test currency used to buy rights; it has no monetary value.",
    ],
    discover: [
      "Find a space",
      "Filter the map by space type and stage. Select a space with an open offer, or browse Funding to find a project.",
    ],
    purchase: [
      "Review and buy the right",
      p.demo
        ? "Review the use, dates and price. Accept the terms, choose a quantity, then select Acquire right. This purchase is simulated."
        : "Review the terms, price and quantity. Select Acquire right, then confirm payment approval and purchase in your wallet. Wait for confirmation and indexing.",
    ],
    receipt: [
      "Inspect your transaction",
      "Open the explorer to see your sender address, purchase function, payment and rights-transfer events. It opens in a new tab; return here to continue.",
    ],
    portfolio: [
      "See what you own",
      "Your right is held by this address. Resell from My assets, or claim revenue only after a project deposits it. Compatible revenue rights can be bundled in Compose.",
    ],
    define: [
      "Define your space",
      "Name the space, choose its right, then review the offer. Register on the final step. Intended launch: pre-approved companies; this demo does not perform real ownership checks.",
    ],
    verify: [
      "Verify the asset",
      p.demo
        ? "Submit for verification, then switch to Demo verifier to approve this asset. Registration alone does not prove ownership."
        : "Submit for verification. A wallet with VERIFIER_ROLE must review this asset. Stay here for approval, or close the tour and return to the asset later.",
    ],
    issue: [
      "Issue and verify the right",
      p.demo
        ? "Switch to Owner A and issue the right, then use Demo verifier to approve its terms."
        : "As the issuer, define and issue the right. Its terms need a separate verifier approval before it can be listed. Connecting a wallet does not grant that role.",
    ],
    publish: [
      "Publish your offer",
      p.demo
        ? "Switch back to Owner A. Review the price and offered units, then publish a listing or launch crowdfunding for revenue shares."
        : "As the issuer, review the price and offered units. Approve the marketplace, then confirm the listing. Revenue-share offers appear in Funding.",
    ],
    funding: [
      "Your offer becomes a campaign",
      "Funding shows revenue-share offers, subscription progress and contributors. Buyers review the rights before paying. Funding does not automatically activate a project; activation is a separate verifier action.",
    ],
  };
  const destination = (next: TourStep) => {
    if (["connect", "gas", "currency"].includes(next)) return "Wallet";
    if (next === "discover") return "Explore";
    if (next === "purchase" || next === "receipt") return "Inspect right";
    if (next === "portfolio") return "Portfolio";
    if (next === "funding") return "Funding";
    return "Owner workspace";
  };
  const start = (nextMode: TourMode) => {
    welcomeRef.current?.close();
    setMode(nextMode);
    setStep(0);
    setBaseline(new Set(p.state.events.map(eventIdentity)));
    setStartedAt(Date.now());
    setInspected("");
    setSessionAccount(
      p.demo
        ? ACTORS[nextMode === "buy" ? "Investor B" : "Owner A"]
        : p.account,
    );
    if (p.demo) p.onActor(nextMode === "buy" ? "Investor B" : "Owner A");
    p.onNavigate(
      p.demo ? (nextMode === "buy" ? "Explore" : "Tokenize") : "Wallet",
    );
  };
  const move = (index: number) => {
    if (index === steps.length) {
      finish();
      return;
    }
    if (
      p.demo &&
      mode === "owner" &&
      ["issue", "publish"].includes(steps[index])
    )
      p.onActor("Owner A");
    setStep(index);
    p.onNavigate(destination(steps[index]));
  };
  const position = useCoachmark(
    visible && !!mode,
    () => {
      const modal = p.container?.closest("dialog");
      const scope: ParentNode = modal || document;
      const find = (selector: string) =>
        Array.from(scope.querySelectorAll<HTMLElement>(selector)).find(
          (el) => el.getClientRects().length > 0,
        ) || null;
      if (!mode || wrongWallet) return null;
      if (modal?.getAttribute("data-tour-surface") === "wallet" && !walletStep)
        return find('[aria-label="Close wallet"]');
      if (current === "connect")
        return (
          find('[data-tour="wallet-provider"]') ||
          find('[data-tour="switch-network"]') ||
          find(".wallet-button")
        );
      if (current === "gas")
        return find('[data-tour="test-gas"]') || find(".wallet-button");
      if (current === "currency")
        return find('[data-tour="mint-currency"]') || find(".wallet-button");
      if (current === "discover")
        return (
          find('[aria-label="Filters"]') ||
          find(".explore-filters .segmented") ||
          find('[role="tab"][aria-selected="true"]')
        );
      if (current === "purchase") {
        const terms = find(
          ".asset-detail .terms-check input",
        ) as HTMLInputElement | null;
        return terms && !terms.checked
          ? terms.closest<HTMLElement>(".terms-check")
          : find(".asset-detail .purchase button.primary");
      }
      if (current === "receipt") return find(".transaction-link");
      if (current === "portfolio") return find(".holding");
      if (current === "funding")
        return find('[role="tab"][aria-selected="true"]');
      const name = find(".tokenize-focus input") as HTMLInputElement | null;
      return current === "define" && name && !name.value
        ? name
        : find(".tokenize-focus .wizard-body button.primary") ||
            find(".header-tokenize");
    },
    panelRef,
    p.container,
    `${p.request}:${mode}:${step}:${p.state.events.length}:${p.account}:${p.gasBalance}:${p.state.cash}`,
  );
  if (!visible) return null;
  const ready = complete[current] && !wrongWallet;
  const nextLabel =
    current === "discover"
      ? "Inspect right"
      : current === "purchase"
        ? p.demo
          ? "View My assets"
          : "Check transaction"
        : current === "receipt"
          ? "View My assets"
          : current === "publish"
            ? "View Funding"
            : step === steps.length - 1
              ? "Finish tour"
              : "Continue";
  const panel = (
    <>
      {mode && position.arrow && (
        <svg className={styles.arrow} aria-hidden="true">
          <defs>
            <marker
              id="guide-arrowhead"
              viewBox="0 0 10 10"
              refX="9"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M0 0 L10 5 L0 10 Z" fill="currentColor" />
            </marker>
          </defs>
          <path
            d={position.arrow}
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            markerEnd="url(#guide-arrowhead)"
          />
        </svg>
      )}
      <section
        ref={panelRef}
        className={`${styles.card} ${!mode ? styles.welcomeCard : ""}`}
        style={
          mode
            ? {
                left: position.left,
                top: position.top,
                width: position.width,
              }
            : undefined
        }
        role="region"
        aria-label="Quick tour"
      >
        <div className={styles.top}>
          <span>
            <BookOpen size={15} />
            {mode
              ? `${step + 1} / ${steps.length} · ${mode === "buy" ? "BUY A RIGHT" : "LAUNCH AN OFFER"}`
              : "QUICK TOUR"}
          </span>
          <button aria-label="Close tour" onClick={finish}>
            <X size={17} />
          </button>
        </div>
        {!mode ? (
          <>
            <h2 tabIndex={-1}>Welcome to TOKENIZE TOKYO</h2>
            <p>
              Explore the city. Discover a project to fund, or put your own
              space to work.
            </p>
            <p className={styles.choicePrompt}>What would you like to try?</p>
            <div className={styles.choices}>
              {p.demo && p.onPitch && (
                <button
                  aria-label="Finalist demo"
                  onClick={() => {
                    finish();
                    p.onPitch?.();
                  }}
                >
                  <span>
                    <strong>Finalist demo</strong>
                    <small>
                      A prepared rooftop project, guided actions and recorded
                      Sepolia evidence.
                    </small>
                  </span>
                  <ArrowRight size={16} />
                </button>
              )}
              <button aria-label="Buy a right" onClick={() => start("buy")}>
                <span>
                  <strong>Buy a right</strong>
                  <small>
                    Find a project, review the offer, and see what you own.
                  </small>
                </span>
                <ArrowRight size={16} />
              </button>
              <button aria-label="List my space" onClick={() => start("owner")}>
                <span>
                  <strong>List my space</strong>
                  <small>
                    Define your space and prepare an offer for funding.
                  </small>
                </span>
                <ArrowRight size={16} />
              </button>
            </div>
            <p>
              {p.demo
                ? "Try the full workflow with simulated roles. No wallet or real transaction is needed."
                : "Use your own wallet on the testnet. The tour guides you; only you approve transactions."}
            </p>
            {!p.demo && (
              <a className={styles.help} href="/demo?tour=1">
                Prefer a wallet-free demo? <ArrowUpRight size={13} />
              </a>
            )}
          </>
        ) : (
          <>
            <h2>{wrongWallet ? "Your wallet changed" : copy[current][0]}</h2>
            <p>
              {wrongWallet
                ? "Restart the tour for the connected address. Progress from the previous wallet will not count."
                : copy[current][1]}
            </p>
            {wrongWallet ? (
              <button className={styles.help} onClick={() => start(mode)}>
                Restart for this wallet <ArrowRight size={13} />
              </button>
            ) : (
              <>
                {current === "discover" && (
                  <button
                    className={styles.help}
                    onClick={() => p.onNavigate("Funding")}
                  >
                    Browse funding offers <ArrowUpRight size={13} />
                  </button>
                )}
                {!p.demo &&
                  walletStep &&
                  !p.container?.closest('[data-tour-surface="wallet"]') && (
                    <button
                      className={styles.help}
                      onClick={() => p.onNavigate("Wallet")}
                    >
                      Open wallet <ArrowRight size={13} />
                    </button>
                  )}
                {!p.demo && current === "purchase" && !complete.purchase && (
                  <button
                    className={styles.help}
                    onClick={() => p.onNavigate("Wallet")}
                  >
                    Need test funds? Open wallet <ArrowRight size={13} />
                  </button>
                )}
                {current === "receipt" && bought && (
                  <a
                    className={styles.receipt}
                    href={transactionUrl(bought.txHash)}
                    target="_blank"
                    rel="noreferrer"
                    onClick={() => setInspected(bought.txHash)}
                  >
                    Open transaction explorer <ArrowUpRight size={14} />
                  </a>
                )}
                {!p.demo && ["verify", "issue"].includes(current) && !ready && (
                  <p className={styles.waiting}>
                    Waiting for the authorized verifier. You can close this tour
                    without losing the on-chain request.
                  </p>
                )}
                {current === "portfolio" && (
                  <button
                    className={styles.help}
                    onClick={() => {
                      finish();
                      p.onNavigate("Namespaces");
                    }}
                  >
                    ENS space names · unregistered preview{" "}
                    <ArrowUpRight size={13} />
                  </button>
                )}
                {current === "portfolio" && !ready && (
                  <p className={styles.waiting}>
                    Waiting for your confirmed holding to appear…
                  </p>
                )}
              </>
            )}
            <div className={styles.bottom}>
              <button
                className={styles.back}
                disabled={step === 0}
                aria-label="Previous tour step"
                onClick={() => move(step - 1)}
              >
                <ArrowLeft size={13} /> Back
              </button>
              <button
                className="primary"
                disabled={!ready}
                onClick={() => move(step + 1)}
              >
                {nextLabel}
                {ready ? <Check size={15} /> : <ArrowRight size={15} />}
              </button>
            </div>
            <div className={styles.mode}>
              {p.demo
                ? "Simulation · no on-chain transactions"
                : `${NETWORK_NAME} · test assets only`}
            </div>
          </>
        )}
      </section>
    </>
  );
  if (!mode)
    return createPortal(
      <dialog
        ref={welcomeRef}
        className={styles.welcome}
        aria-label="Welcome to TOKENIZE TOKYO"
        onCancel={(event) => {
          event.preventDefault();
          finish();
        }}
      >
        {panel}
      </dialog>,
      document.body,
    );
  return p.container ? createPortal(panel, p.container) : panel;
}
