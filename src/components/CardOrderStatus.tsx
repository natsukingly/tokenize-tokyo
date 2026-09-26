"use client";
import { useCallback, useEffect, useState } from "react";
import type { CardOrderView } from "@/lib/card-checkout";
import styles from "./CardCheckout.module.css";
import LoadingOverlay from "./LoadingOverlay";

const copy = {
  creating: [
    "Preparing your order",
    "Your test payment has not been confirmed yet.",
  ],
  awaiting_payment: [
    "Waiting for test payment",
    "Complete Stripe Checkout, then check your payment here. Rights are delivered only after payment is verified.",
  ],
  fulfilling: [
    "Payment confirmed",
    "TOKENIZE TOKYO is submitting your purchase. You do not need to sign a wallet transaction.",
  ],
  submitted: [
    "Your rights are on the way",
    "The operator submitted your purchase. Waiting for confirmation on the test network.",
  ],
  fulfilled: [
    "Your rights have arrived",
    "Your test payment and on-chain delivery are confirmed. View your rights in My assets.",
  ],
  expired: [
    "Checkout expired",
    "This checkout was not paid. Return to the marketplace to review a new order.",
  ],
  review: [
    "Payment received · delivery needs review",
    "Your test payment was confirmed, but delivery could not be confirmed. Keep this order reference and contact the operator. Do not pay again.",
  ],
} as const;
export default function CardOrderStatus({
  id,
  returned,
}: {
  id: string;
  returned: boolean;
}) {
  const [order, setOrder] = useState<CardOrderView>();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [foreground, setForeground] = useState(true);
  const refresh = useCallback(
    async (reconcile = false, signal?: AbortSignal) => {
      setBusy(true);
      if (reconcile) setForeground(true);
      try {
        const response = await fetch(`/api/card-checkout/orders/${id}`, {
          method: reconcile ? "POST" : "GET",
          cache: "no-store",
          signal,
        });
        const body = await response.json();
        if (!response.ok)
          throw new Error(body.error || "Unable to check your order.");
        if (!signal?.aborted) {
          setOrder(body);
          setError("");
        }
      } catch (e) {
        if (!signal?.aborted)
          setError(
            e instanceof Error ? e.message : "Unable to check your order.",
          );
      } finally {
        if (!signal?.aborted) {
          setBusy(false);
          setForeground(false);
        }
      }
    },
    [id],
  );
  useEffect(() => {
    const controller = new AbortController();
    void refresh(true, controller.signal);
    return () => controller.abort();
  }, [refresh]);
  useEffect(() => {
    if (!order || ["fulfilled", "expired", "review"].includes(order.state))
      return;
    const controller = new AbortController();
    const timer = setInterval(
      () => void refresh(false, controller.signal),
      5000,
    );
    return () => {
      clearInterval(timer);
      controller.abort();
    };
  }, [refresh, order?.state]);
  const paid =
    order &&
    ["fulfilling", "submitted", "fulfilled", "review"].includes(order.state);
  const sent = order && ["submitted", "fulfilled"].includes(order.state);
  const [title, description] = order
    ? copy[order.state]
    : ["Checking your order", "Confirming payment and delivery status…"];
  return (
    <main className={styles.page}>
      <LoadingOverlay
        active={busy && foreground}
        title="Checking your order…"
        detail="Confirming payment and delivery status."
      />
      <a className={styles.brand} href="/">
        TOKENIZE TOKYO
      </a>
      <section className={styles.receipt} aria-label="Card purchase status">
        <div>
          <span className={styles.tag}>STRIPE TEST PAYMENT</span>
        </div>
        <div aria-live="polite">
          <h1>{title}</h1>
          <p className={styles.note}>{description}</p>
        </div>
        {returned && !paid && (
          <p className={styles.status}>
            You returned from Stripe. Check payment status before starting
            another order.
          </p>
        )}
        <ol className={styles.steps}>
          {[
            ["Test payment confirmed", paid],
            ["Operator submits purchase", sent],
            ["Rights delivered to your wallet", order?.state === "fulfilled"],
          ].map(([label, done], i) => (
            <li key={String(label)} data-done={!!done}>
              <span className={styles.stepNumber}>{done ? "✓" : i + 1}</span>
              {label}
            </li>
          ))}
        </ol>
        {order && (
          <dl className={styles.summary}>
            <dt>Test total</dt>
            <dd>¥{order.amountJpy.toLocaleString("ja-JP")}</dd>
            <dt>Quantity</dt>
            <dd>{order.quantity}</dd>
            <dt>Network fee</dt>
            <dd>Paid by TOKENIZE TOKYO</dd>
            <dt>Receiving wallet</dt>
            <dd>
              <code>{order.recipient}</code>
            </dd>
          </dl>
        )}
        <div className={styles.recipient}>
          <span className={styles.note}>Order reference</span>
          <code>{id}</code>
        </div>
        {error && (
          <p role="alert" className={styles.status}>
            {error}
          </p>
        )}
        <div className={styles.actions}>
          {order?.checkoutUrl && (
            <a className="primary" href={order.checkoutUrl}>
              Resume test payment
            </a>
          )}
          {order?.state !== "fulfilled" && order?.state !== "expired" && (
            <button
              className="primary"
              disabled={busy}
              onClick={() => refresh(true)}
            >
              {busy ? "Checking…" : "Check payment & delivery"}
            </button>
          )}
          {order?.txHash && (
            <a
              href={
                order.chainId === 11155111
                  ? `https://sepolia.etherscan.io/tx/${order.txHash}`
                  : `/tx/${order.txHash}`
              }
              target="_blank"
              rel="noreferrer"
            >
              View transaction ↗
            </a>
          )}
          <a href="/">Return to marketplace</a>
        </div>
        <p className={styles.note}>
          Test mode only. No real money is charged. This page checks Stripe and
          the blockchain; returning here does not confirm a purchase.
        </p>
      </section>
    </main>
  );
}
