"use client";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { CreditCard, Wallet, ArrowUpRight } from "lucide-react";
import { cardAmount } from "@/lib/card-checkout";
import type { Listing } from "@/lib/model";
import styles from "./CardCheckout.module.css";

export default function CardPaymentOption({
  listing,
  quantity,
  account,
  accepted,
  demo,
  busy,
  onConnect,
  children,
}: {
  listing: Listing;
  quantity: string;
  account: string;
  accepted: boolean;
  demo: boolean;
  busy: boolean;
  onConnect: () => void;
  children: ReactNode;
}) {
  const group = useId();
  const [method, setMethod] = useState("wallet");
  const [available, setAvailable] = useState<boolean>();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const requestId = useRef("");
  const lock = useRef(false);
  const identity = `${account}:${listing.id}:${quantity}:${listing.unitPrice}`;
  const current = useRef(identity);
  current.current = identity;
  useEffect(() => {
    requestId.current = "";
    setError("");
  }, [identity]);
  useEffect(() => {
    if (demo || method !== "card") return;
    const controller = new AbortController();
    fetch("/api/card-checkout", {
      signal: controller.signal,
      cache: "no-store",
    })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((r) => setAvailable(r.available === true))
      .catch(() => {
        if (!controller.signal.aborted) setAvailable(false);
      });
    return () => controller.abort();
  }, [demo, method]);
  let amount: number | undefined;
  try {
    if (
      !/^[1-9]\d{0,5}$/.test(quantity) ||
      BigInt(quantity) > BigInt(listing.remaining)
    )
      throw new Error();
    amount = cardAmount(BigInt(listing.unitPrice) * BigInt(quantity), 18);
  } catch {
    /* Explain an unavailable test amount below. */
  }
  const own =
    !!account && account.toLowerCase() === listing.seller.toLowerCase();
  const start = async () => {
    if (!account) return onConnect();
    if (lock.current || !accepted || !amount || !available || demo || own)
      return;
    lock.current = true;
    setPending(true);
    setError("");
    requestId.current ||= crypto.randomUUID();
    try {
      const response = await fetch("/api/card-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestId: requestId.current,
          listingId: listing.id,
          quantity,
          recipient: account,
          expectedJpy: amount,
          acceptedTerms: true,
        }),
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(
          result.error || "Checkout is unavailable. Please try again.",
        );
      if (current.current !== identity) return;
      const url = new URL(result.url);
      if (url.protocol !== "https:" || url.hostname !== "checkout.stripe.com")
        throw new Error("Invalid checkout response.");
      window.location.assign(url.toString());
    } catch (e) {
      if (current.current === identity)
        setError(e instanceof Error ? e.message : "Unable to open checkout.");
    } finally {
      lock.current = false;
      setPending(false);
    }
  };
  return (
    <div className={styles.payment}>
      <fieldset className={styles.methods} disabled={pending || busy}>
        <legend>Payment method</legend>
        <label data-selected={method === "wallet"}>
          <input
            type="radio"
            name={group}
            value="wallet"
            checked={method === "wallet"}
            onChange={() => setMethod("wallet")}
          />
          <Wallet size={16} /> Wallet
        </label>
        <label data-selected={method === "card"}>
          <input
            type="radio"
            name={group}
            value="card"
            checked={method === "card"}
            onChange={() => setMethod("card")}
          />
          <CreditCard size={16} /> Card <span className={styles.tag}>TEST</span>
        </label>
      </fieldset>
      {method === "wallet" ? (
        children
      ) : (
        <div className={styles.review}>
          <div className={styles.total}>
            <span>Test payment total</span>
            <strong>
              {amount ? `¥${amount.toLocaleString("ja-JP")}` : "—"}
            </strong>
          </div>
          <p>
            You receive {quantity}{" "}
            {listing.token === "basket" ? "basket shares" : "rights"}. Network
            fee paid by TOKENIZE TOKYO.
          </p>
          {account && (
            <div className={styles.recipient}>
              <span>Receive at</span>
              <code>{account}</code>
            </div>
          )}
          <p className={styles.note}>
            Stripe test mode · No real charge. 1 mJPY = ¥1 for this test.
          </p>
          {demo ? (
            <p role="status">
              Card payments are available in the testnet marketplace, after
              setup.
            </p>
          ) : available === false ? (
            <p role="status">
              Card checkout is being prepared. Wallet payment is available.
            </p>
          ) : available === undefined ? (
            <p role="status">Checking card availability…</p>
          ) : !amount ? (
            <p role="status">
              Choose an available whole quantity with a whole-yen total of
              ¥50–¥100,000.
            </p>
          ) : own ? (
            <p role="status">You cannot buy your own listing.</p>
          ) : !account ? (
            <p>
              Log in or connect to choose where your rights arrive. No wallet
              payment or gas is needed.
            </p>
          ) : !accepted ? (
            <p>Review and accept the rights and their terms above.</p>
          ) : null}
          <button
            type="button"
            className="primary"
            disabled={
              pending ||
              busy ||
              demo ||
              !available ||
              !amount ||
              own ||
              (!!account && !accepted)
            }
            onClick={start}
          >
            {pending
              ? "Opening Stripe…"
              : !account
                ? "Choose receiving wallet"
                : "Continue to Stripe"}{" "}
            <ArrowUpRight size={15} />
          </button>
          {error && <p role="alert">{error}</p>}
        </div>
      )}
    </div>
  );
}
