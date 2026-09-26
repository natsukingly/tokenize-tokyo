"use client";
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  ArrowUpRight,
  Check,
  Network,
  ShieldCheck,
  RefreshCw,
  Sun,
} from "lucide-react";
import { encodeFunctionData, getAddress, isAddress, type Abi } from "viem";
import BrandPlate from "./BrandPlate";
import EnsDelegation from "./EnsDelegation";
import LoadingOverlay from "./LoadingOverlay";
import { useBrowserWallet } from "@/lib/use-browser-wallet";
import {
  ensClient,
  loadEnsBinding,
  type LiveEnsBinding,
} from "@/lib/ens/authority";
import {
  checkReporter,
  loadReport,
  reportCall,
  reporterGrantCall,
  reporterRevokeCall,
  REPORT_KEY,
} from "@/lib/ens/reports";
import { permissionedResolverAbi } from "@/lib/ens/resolver-abi";
import { positionalArguments } from "@/lib/ens/call";
import { sendVerifiedCallViaMultiBaas } from "@/lib/multibaas";
import { transactionPhase, type TransactionProgress } from "@/lib/wallet";
import issuanceProof from "../../deployments/ens-v2-sepolia-delegation-proof.json";
import reportingProof from "../../deployments/ens-v2-sepolia-report-proof.json";
import styles from "./EnsShowcase.module.css";

const evidence = [
  {
    name: "Delegate rooftop issuance",
    hash: issuanceProof.transactions["grant-issuance"],
    detail: "The owner grants bounded issuance to a rooftop operator.",
  },
  {
    name: "Issue rights to the owner",
    hash: issuanceProof.transactions["issue-rooftop"],
    detail: "The operator issues 10 units; the owner receives them.",
  },
  {
    name: "Revoke the ENS role",
    hash: issuanceProof.transactions["revoke-ens"],
    detail: "Future delegated issuance requires this role again.",
  },
  {
    name: "Grant one report key",
    hash: reportingProof.transactions["grant-report-key"],
    detail: "A separate reporter can edit only urban.energyReport.",
  },
  {
    name: "Publish the energy report",
    hash: reportingProof.transactions["write-energy-report"],
    detail: "The report is read back through the Universal Resolver.",
  },
  {
    name: "Revoke reporting access",
    hash: reportingProof.transactions["revoke-report-key"],
    detail: "The report stays readable; future writes are denied.",
  },
];

export default function EnsShowcase() {
  const wallet = useBrowserWallet(true);
  const [tab, setTab] = useState("Overview");
  const [live, setLive] = useState<LiveEnsBinding | null>(null);
  const [report, setReport] = useState<Awaited<
    ReturnType<typeof loadReport>
  > | null>(null);
  const [checks, setChecks] = useState<Awaited<
    ReturnType<typeof checkReporter>
  > | null>(null);
  const [reporter, setReporter] = useState(reportingProof.reporter);
  const [period, setPeriod] = useState(new Date().toISOString().slice(0, 7));
  const [energy, setEnergy] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [busyLabel, setBusyLabel] = useState("");
  const [progress, setProgress] = useState<TransactionProgress | null>(null);
  const [revision, setRevision] = useState(0);
  const [receipts, setReceipts] = useState<Record<string, string>>({});
  const issuer =
    !!live &&
    wallet.account.toLowerCase() === live.binding.issuer.toLowerCase();

  useEffect(() => {
    let active = true;
    setLoading(true);
    setLive(null);
    setReport(null);
    setChecks(null);
    setError("");
    loadEnsBinding()
      .then(async (value) => {
        if (!active) return;
        setLive(value);
        const current = await loadReport(value);
        if (active) setReport(current);
      })
      .catch(() => {
        if (active)
          setError(
            "Could not verify the Sepolia space and its resolver. Retry the live checks before sending a transaction.",
          );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [revision]);
  useEffect(() => {
    if (wallet.account && live && !issuer) setReporter(wallet.account);
  }, [wallet.account, live, issuer]);
  useEffect(() => {
    let active = true;
    setReceipts({});
    Promise.all(
      evidence.map(async (item) => {
        try {
          const receipt = await ensClient().getTransactionReceipt({
            hash: item.hash as `0x${string}`,
          });
          return [
            item.hash,
            receipt.status === "success"
              ? `Confirmed · block ${receipt.blockNumber}`
              : "Reverted",
          ] as const;
        } catch {
          return [item.hash, "Receipt unavailable"] as const;
        }
      }),
    ).then((values) => {
      if (active) setReceipts(Object.fromEntries(values));
    });
    return () => {
      active = false;
    };
  }, [revision]);

  async function inspect() {
    if (!live || !report || !isAddress(reporter)) return;
    setBusy(true);
    setBusyLabel("Checking reporting permissions…");
    setProgress(null);
    setError("");
    setChecks(null);
    try {
      setChecks(await checkReporter(live, report.resolver, reporter));
    } catch {
      setError("Permission checks are unavailable. No transaction was sent.");
    } finally {
      setBusy(false);
    }
  }
  async function run(action: "grant" | "revoke" | "write") {
    if (!live || !report || !wallet.provider || !wallet.account) return;
    setBusy(true);
    setBusyLabel(
      action === "write"
        ? "Publishing energy report…"
        : action === "grant"
          ? "Granting report-only access…"
          : "Revoking reporting access…",
    );
    setError("");
    setProgress(null);
    setChecks(null);
    try {
      if (
        action !== "write" &&
        (!isAddress(reporter) ||
          getAddress(reporter) === getAddress(live.binding.issuer))
      )
        throw new Error("Choose a separate reporter wallet.");
      const current = await loadReport(live);
      if (current.resolver.toLowerCase() !== report.resolver.toLowerCase())
        throw new Error("The resolver changed. Refresh before signing.");
      const call =
        action === "grant"
          ? reporterGrantCall(live.name, reporter)
          : action === "revoke"
            ? reporterRevokeCall(reporter)
            : reportCall(live.name, period, energy);
      const args = [...call.args];
      const data = encodeFunctionData({
        abi: permissionedResolverAbi as Abi,
        functionName: call.functionName,
        args,
      });
      const hash = await sendVerifiedCallViaMultiBaas(
        wallet.provider,
        wallet.account,
        {
          address: current.resolver,
          label: "enspermissionedresolver",
          method: call.functionName,
          args: positionalArguments(
            permissionedResolverAbi,
            call.functionName,
            args,
          ),
          data,
        },
        setProgress,
      );
      const receipt = await ensClient().getTransactionReceipt({
        hash: hash as `0x${string}`,
      });
      setReport(await loadReport(live, receipt.blockNumber));
      setChecks(
        await checkReporter(
          live,
          current.resolver,
          action === "write" ? wallet.account : reporter,
          receipt.blockNumber,
        ),
      );
    } catch (e) {
      setError(
        e instanceof Error && e.constructor === Error
          ? e.message
          : "Action did not complete. Check any submitted transaction below before retrying.",
      );
    } finally {
      setBusy(false);
    }
  }
  const receiptHash =
    progress && "hash" in progress ? progress.hash : undefined;

  return (
    <div className={styles.page}>
      <LoadingOverlay
        active={loading || busy}
        title={busy ? busyLabel : "Verifying ENS on Sepolia…"}
        detail={
          busy && progress
            ? progress.phase === "confirmed"
              ? "Reading back the confirmed result…"
              : transactionPhase[progress.phase]
            : "Reading the registered space and its current permissions."
        }
      />
      <header className={styles.header}>
        <a href="/" aria-label="TOKENIZE TOKYO home">
          <BrandPlate width={180} />
        </a>
        <span>
          <Network size={14} /> ENSv2 · Sepolia
        </span>
        <a href="/">
          <ArrowLeft size={15} /> Back to app
        </a>
      </header>
      <main className={styles.main}>
        <section className={styles.hero}>
          <p className={styles.eyebrow}>
            SPACE IDENTITY → SPECIFIC PERMISSIONS → PRODUCTIVE USE
          </p>
          <h1>
            One rooftop.
            <br /> Precisely delegated.
          </h1>
          <p>
            A property owner can delegate rooftop operations while keeping
            control. ENSv2 gives the space an identity and makes each permission
            explicit and revocable.
          </p>
          <div className={styles.namespace}>
            <Network size={19} />
            <code>
              {live?.name || "Verifying the registered rooftop on Sepolia…"}
            </code>
            <span>{live ? "Registered" : "Connecting"}</span>
          </div>
        </section>

        <div className={styles.toolbar}>
          <div
            role="tablist"
            aria-label="ENS demonstration"
            className={styles.tabs}
          >
            {["Overview", "Issue rights", "Report energy"].map((item) => (
              <button
                key={item}
                role="tab"
                aria-selected={tab === item}
                aria-controls="ens-demo-panel"
                onClick={() => setTab(item)}
              >
                {item}
              </button>
            ))}
          </div>
          <button
            className={styles.refresh}
            disabled={busy || loading}
            onClick={() => setRevision((value) => value + 1)}
          >
            <RefreshCw size={14} /> Refresh live data
          </button>
        </div>
        {error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}
        <section id="ens-demo-panel" className={styles.content}>
          {tab === "Overview" ? (
            <>
              <div className={styles.roles}>
                <article>
                  <ShieldCheck />
                  <h2>Owner</h2>
                  <p>
                    Controls the space and grants or revokes permissions.
                    Receives delegated rights.
                  </p>
                </article>
                <article>
                  <Network />
                  <h2>Rooftop operator</h2>
                  <p>
                    Prepares solar revenue rights within an issuer-approved
                    quantity, purpose and period.
                  </p>
                </article>
                <article>
                  <Sun />
                  <h2>Energy reporter</h2>
                  <p>
                    Updates one text record. Cannot edit the asset reference or
                    issue rights with this permission.
                  </p>
                </article>
              </div>
              <div className={styles.sectionHeading}>
                <h2>A recorded run on public Sepolia</h2>
                <span>Receipts checked live · test assets only</span>
              </div>
              <div className={styles.evidence}>
                {evidence.map((item, index) => (
                  <a
                    key={item.hash}
                    href={`https://sepolia.etherscan.io/tx/${item.hash}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <span className={styles.number}>0{index + 1}</span>
                    <div>
                      <h3>
                        {item.name}
                        <ArrowUpRight size={14} />
                      </h3>
                      <p>{item.detail}</p>
                      <small>
                        {receipts[item.hash] || "Checking receipt…"}
                      </small>
                    </div>
                  </a>
                ))}
              </div>
              <div className={styles.note}>
                The recorded tests also check denied actions: another space,
                another asset, a protected record, and a write after revocation.
                Use{" "}
                <button onClick={() => setTab("Report energy")}>
                  Report energy
                </button>{" "}
                to check current permissions without a wallet.
              </div>
            </>
          ) : (
            <>
              <div className={styles.wallet}>
                {wallet.account ? (
                  <>
                    <span>
                      Connected: <code>{wallet.account}</code>
                    </span>
                    <button disabled={busy} onClick={wallet.disconnect}>
                      Disconnect
                    </button>
                  </>
                ) : (
                  <>
                    <span>Connect a wallet to grant, report or revoke.</span>
                    {wallet.wallets.length ? (
                      wallet.wallets.map((item) => (
                        <button
                          key={item.id}
                          disabled={wallet.connecting || busy}
                          onClick={async () => {
                            try {
                              await wallet.connect(item);
                            } catch {
                              setError("Wallet connection was not completed.");
                            }
                          }}
                        >
                          Connect {item.name}
                        </button>
                      ))
                    ) : (
                      <span>
                        Open this page with MetaMask or another browser wallet.
                      </span>
                    )}
                  </>
                )}
              </div>
              {tab === "Issue rights" ? (
                <>
                  <p className={styles.note}>
                    This operator receives the ENS registry’s
                    resolver-management role plus a separate bounded issuance
                    grant. This is broader than report-only access. Revocation
                    stops future issuance; it does not burn existing rights.
                  </p>
                  {live ? (
                    <EnsDelegation
                      name={live.name}
                      account={wallet.account}
                      provider={wallet.provider}
                      onConnect={() => {
                        document
                          .querySelector(`.${styles.wallet}`)
                          ?.scrollIntoView({ behavior: "smooth" });
                      }}
                    />
                  ) : (
                    <p>
                      Waiting for a verified space binding. Refresh live data to
                      retry.
                    </p>
                  )}
                </>
              ) : (
                <div className={styles.reportGrid}>
                  <article className={styles.panel}>
                    <p className={styles.eyebrow}>
                      PERMISSIONED RESOLVER · ONE TEXT KEY
                    </p>
                    <h2>Report solar generation</h2>
                    <code className={styles.key}>{REPORT_KEY}</code>
                    <p>
                      This reporting role has no issuance authority, resolver
                      replacement or other text-key permissions. It stays active
                      until revoked.
                    </p>
                    <div className={styles.reading}>
                      <span>Current onchain report</span>
                      <pre>
                        {report?.value ||
                          (loading
                            ? "Reading through the Universal Resolver…"
                            : "No report recorded yet.")}
                      </pre>
                      {report && (
                        <small>
                          Read at Sepolia block {report.blockNumber.toString()}
                        </small>
                      )}
                    </div>
                    <label>
                      Reporting month
                      <input
                        type="month"
                        value={period}
                        disabled={busy}
                        onChange={(event) => setPeriod(event.target.value)}
                      />
                    </label>
                    <label>
                      Energy generated (kWh)
                      <input
                        inputMode="decimal"
                        value={energy}
                        disabled={busy}
                        placeholder="e.g. 125.50"
                        onChange={(event) => setEnergy(event.target.value)}
                      />
                    </label>
                    <p className={styles.small}>
                      Operator-reported test data, not independently measured
                      generation.
                    </p>
                    <button
                      className={styles.primary}
                      disabled={busy || !wallet.account || !report || !energy}
                      onClick={() => run("write")}
                    >
                      Publish energy report
                    </button>
                  </article>
                  <article className={styles.panel}>
                    <p className={styles.eyebrow}>VERIFY THE BOUNDARY</p>
                    <h2>What can this account change?</h2>
                    <label>
                      Reporter wallet address
                      <input
                        value={reporter}
                        disabled={busy}
                        onChange={(event) => {
                          setReporter(event.target.value);
                          setChecks(null);
                        }}
                        placeholder="0x…"
                        spellCheck={false}
                      />
                    </label>
                    <button
                      className={styles.secondary}
                      disabled={
                        busy || !live || !report || !isAddress(reporter)
                      }
                      onClick={inspect}
                    >
                      Check permissions · no transaction
                    </button>
                    {checks && (
                      <div className={styles.checks} aria-live="polite">
                        {checks.checks.map((check) => (
                          <div key={check.key}>
                            <code>{check.key}</code>
                            <strong data-result={check.result}>
                              {check.result === "allowed"
                                ? "Allowed"
                                : check.result === "denied"
                                  ? "Denied by contract"
                                  : "Check unavailable"}
                            </strong>
                          </div>
                        ))}
                        <small>
                          Simulated on Sepolia at block{" "}
                          {checks.blockNumber.toString()}. No state changes.
                        </small>
                      </div>
                    )}
                    <div className={styles.grant}>
                      <h3>Owner controls</h3>
                      <p>
                        Grant access to the report key, then revoke it after
                        reporting. The report remains readable.
                      </p>
                      <div>
                        <button
                          disabled={
                            busy || !issuer || !report || !isAddress(reporter)
                          }
                          onClick={() => run("grant")}
                        >
                          Grant report-only access
                        </button>
                        <button
                          disabled={
                            busy || !issuer || !report || !isAddress(reporter)
                          }
                          onClick={() => run("revoke")}
                        >
                          Revoke reporting access
                        </button>
                      </div>
                      {!issuer && (
                        <small>
                          Connect the asset issuer’s wallet to manage
                          permissions.
                        </small>
                      )}
                    </div>
                    <p className={styles.small}>
                      Key permissions apply to every name served by this
                      resolver. This demo uses a dedicated rooftop resolver;
                      other spaces need their own resolver for isolation.
                    </p>
                  </article>
                </div>
              )}
              {progress && (
                <div className={styles.note} role="status">
                  {progress.phase === "confirmed" ? (
                    <>
                      <Check size={14} /> Confirmed on Sepolia
                    </>
                  ) : progress.phase === "signature" ? (
                    "Confirm the reviewed action in your wallet."
                  ) : (
                    `Transaction: ${progress.phase}`
                  )}
                  {receiptHash && (
                    <a
                      href={`https://sepolia.etherscan.io/tx/${receiptHash}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      View transaction <ArrowUpRight size={14} />
                    </a>
                  )}
                </div>
              )}
            </>
          )}
        </section>
        <footer className={styles.footer}>
          <span>Identity and permissions for a space. Test rights only.</span>
          <a
            href="https://github.com/natsukingly/tokenize-tokyo/blob/main/docs/ENS_PRIZE_DEMO.md"
            target="_blank"
            rel="noreferrer"
          >
            Code, evidence & demo guide <ArrowUpRight size={13} />
          </a>
        </footer>
      </main>
    </div>
  );
}
