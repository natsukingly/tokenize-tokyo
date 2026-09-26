"use client";
import { useEffect, useState } from "react";
import { ArrowLeft, ArrowUpRight, Check, Copy, RefreshCw } from "lucide-react";
import {
  GetTransactionIncludeEnum,
  GetTransactionReceiptIncludeEnum,
  type TransactionData,
  type TransactionReceipt,
} from "@curvegrid/multibaas-sdk";
import { formatEther } from "viem";
import { clients } from "@/lib/multibaas";
import { config } from "@/lib/config";
import { NETWORK_NAME } from "@/lib/wallet";
import styles from "./TransactionExplorer.module.css";
const value = (v: unknown) =>
  typeof v === "string" ? v : JSON.stringify(v, null, 2);
const integer = (v?: string) => (v ? BigInt(v).toLocaleString("en-US") : "—");
export default function TransactionExplorer({ hash }: { hash: string }) {
  const [tx, setTx] = useState<TransactionData | null>(null);
  const [receipt, setReceipt] = useState<TransactionReceipt | null>(null);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    setError("");
    setTx(null);
    setReceipt(null);
    const load = async () => {
      try {
        const api = clients().chains;
        const data = (
          await api.getTransaction(hash, GetTransactionIncludeEnum.Contract)
        ).data.result;
        if (stopped) return;
        setTx(data);
        if (data.isPending) {
          timer = setTimeout(load, 3000);
          return;
        }
        const result = (
          await api.getTransactionReceipt(
            hash,
            GetTransactionReceiptIncludeEnum.Contract,
          )
        ).data.result;
        if (!stopped) {
          setReceipt(result);
          setError("");
        }
      } catch {
        if (!stopped)
          setError(
            "This transaction is not available yet on this network, or MultiBaas could not be reached. Check the hash and try again.",
          );
      }
    };
    void load();
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [hash, retry]);
  const status = receipt
    ? BigInt(receipt.data.status) === 1n
      ? "Confirmed"
      : "Reverted"
    : tx?.isPending
      ? "Pending"
      : "Loading";
  return (
    <main className={styles.page}>
      <nav>
        <a href="/">
          <ArrowLeft size={16} /> Back to Tokyo
        </a>
        <span>MultiBaas · Transaction Explorer</span>
      </nav>
      <header>
        <div>
          <span className={styles.network}>
            {NETWORK_NAME} · Chain {config.chainId}
          </span>
          <h1>Transaction</h1>
        </div>
        <span className={styles.status}>
          {error ? (
            "Unavailable"
          ) : status === "Confirmed" ? (
            <>
              <Check size={16} /> Confirmed
            </>
          ) : (
            status
          )}
        </span>
      </header>
      <section className={styles.hash}>
        <code>{hash}</code>
        <button
          aria-label="Copy transaction hash"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(hash);
              setCopied(true);
            } catch {
              setCopied(false);
            }
          }}
        >
          {copied ? <Check size={18} /> : <Copy size={18} />}
        </button>
      </section>
      {error && (
        <div className={styles.error} role="alert">
          <p>{error}</p>
          <button onClick={() => setRetry((n) => n + 1)}>
            <RefreshCw size={15} /> Retry
          </button>
        </div>
      )}
      {!tx && !error && (
        <p role="status">Loading transaction from MultiBaas…</p>
      )}
      {tx && (
        <>
          <section className={styles.card}>
            <h2>Overview</h2>
            <dl>
              <dt>Status</dt>
              <dd>{status}</dd>
              <dt>Block</dt>
              <dd>{integer(tx.blockNumber)}</dd>
              <dt>From</dt>
              <dd>
                <code>{tx.from}</code>
              </dd>
              <dt>To</dt>
              <dd>
                <code>{tx.data.to || "Contract creation"}</code>
                {tx.contract?.name && <small>{tx.contract.name}</small>}
              </dd>
              <dt>Value</dt>
              <dd>{tx.data.value === null ? "—" : formatEther(BigInt(tx.data.value)) + " test ETH"}</dd>
              {receipt && (
                <>
                  <dt>Gas used</dt>
                  <dd>{integer(receipt.data.gasUsed)}</dd>
                  <dt>Network fee</dt>
                  <dd>
                    {formatEther(
                      BigInt(receipt.data.gasUsed) *
                        BigInt(
                          receipt.data.effectiveGasPrice ??
                            tx.data.gasPrice ??
                            "0",
                        ),
                    )}{" "}
                    test ETH
                  </dd>
                </>
              )}
            </dl>
          </section>
          {tx.method && (
            <section className={styles.card}>
              <h2>Function · {tx.method.name}</h2>
              <code className={styles.signature}>{tx.method.signature}</code>
              <dl>
                {tx.method.inputs?.map((arg, i) => (
                  <div className={styles.pair} key={i}>
                    <dt>
                      {arg.name || `Argument ${i + 1}`}
                      <small>{arg.type}</small>
                    </dt>
                    <dd>
                      <pre>{value(arg.value)}</pre>
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
          )}
          {receipt && (
            <section className={styles.card}>
              <h2>
                Events <span>{receipt.events?.length || 0} decoded</span>
              </h2>
              {receipt.events?.map((event, i) => (
                <details key={i} open={i < 3} className={styles.event}>
                  <summary>
                    {event.name}
                    <small>
                      {event.contract?.name || event.contract?.address}
                    </small>
                  </summary>
                  <dl>
                    {event.inputs.map((arg, j) => (
                      <div className={styles.pair} key={j}>
                        <dt>
                          {arg.name}
                          <small>
                            {arg.type}
                            {arg.hashed ? " · hash" : ""}
                          </small>
                        </dt>
                        <dd>
                          <pre>{value(arg.value)}</pre>
                        </dd>
                      </div>
                    ))}
                  </dl>
                </details>
              ))}
              {!receipt.events?.length && (
                <p>
                  No decoded events. Native transfers do not emit contract
                  events.
                </p>
              )}
            </section>
          )}
          <details className={styles.card}>
            <summary>Raw transaction & receipt</summary>
            <pre>
              {JSON.stringify(
                { transaction: tx.data, receipt: receipt?.data },
                null,
                2,
              )}
            </pre>
          </details>
        </>
      )}
      <footer>
        <span>
          Read directly through the MultiBaas SDK. Test tokens have no monetary
          value.
        </span>
        <a href={config.url} target="_blank" rel="noreferrer">
          Open MultiBaas console <ArrowUpRight size={14} />
        </a>
      </footer>
    </main>
  );
}
