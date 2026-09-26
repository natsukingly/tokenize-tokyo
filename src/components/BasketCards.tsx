"use client";
import { useState } from "react";
import { ArrowRight, MapPin } from "lucide-react";
import { formatEther } from "viem";
import type { Basket, Listing, MarketState } from "@/lib/model";
import styles from "./BasketCards.module.css";
import CardPaymentOption from "./CardPaymentOption";

const whole = (value: string) => /^\d+$/.test(value) && BigInt(value) > 0n;
const money = (value: bigint) =>
  Number(formatEther(value)).toLocaleString("en-US", {
    maximumFractionDigits: 2,
  });
function rightName(state: MarketState, id: string) {
  const right = state.rights.find((r) => r.id === id);
  return (
    state.assets.find((a) => a.id === right?.assetId)?.name ||
    `Revenue right #${id}`
  );
}

export function BasketPoolCard({
  basket,
  state,
  connected,
  ready,
  busy,
  demo,
  onConnect,
  onDeposit,
  onView,
  onManage,
}: {
  basket: Basket;
  state: MarketState;
  connected: boolean;
  ready: boolean;
  busy: boolean;
  demo: boolean;
  onConnect: () => void;
  onDeposit: (quantity: string) => Promise<unknown>;
  onView: () => void;
  onManage: () => void;
}) {
  const [quantity, setQuantity] = useState("1");
  const count = whole(quantity) ? BigInt(quantity) : 0n;
  const amounts = basket.rightIds.map((id, i) => ({
    id,
    units: BigInt(basket.units[i]),
    held: ready ? BigInt(state.balances[`rights:${id}`] || "0") : 0n,
  }));
  const sufficient =
    count > 0n &&
    count <= 10n ** 12n &&
    amounts.every((a) => a.held >= a.units * count);
  return (
    <article className={`basket-pool ${styles.card}`}>
      <small>INCOME BASKET · #{basket.id}</small>
      <h3>{basket.name}</h3>
      <p>Every share contains:</p>
      <ul className={styles.contents}>
        {amounts.map(({ id, units }) => (
          <li key={id}>
            <span>{rightName(state, id)}</span>
            <b>
              {String(units)} {units === 1n ? "unit" : "units"}
            </b>
          </li>
        ))}
      </ul>
      <button className="text-button" onClick={onView}>
        <MapPin size={14} /> Show these assets on the map
      </button>
      <details className={styles.details}>
        <summary>Add your rights to this basket</summary>
        <p>
          Deposit the rights listed above to receive basket shares. You can
          later exchange those shares for the same quantities of rights in My
          assets.
        </p>
        {!connected ? (
          <button className="secondary" onClick={onConnect}>
            Connect to check your holdings
          </button>
        ) : (
          <>
            <label>
              Shares to receive
              <input
                type="number"
                min="1"
                step="1"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
              />
            </label>
            <ul className={styles.contents}>
              {amounts.map(({ id, units, held }) => (
                <li key={id}>
                  <span>{rightName(state, id)}</span>
                  <small>
                    {String(units * count)} needed ·{" "}
                    {ready ? String(held) : "…"} owned
                  </small>
                </li>
              ))}
            </ul>
            <p className={styles.note}>
              {!ready
                ? "Checking your holdings…"
                : !sufficient
                  ? "Choose a whole number of shares and hold enough of every listed right."
                  : `You deposit the amounts above and receive ${quantity} basket ${count === 1n ? "share" : "shares"}.`}
            </p>
            <button
              className="secondary wide"
              disabled={busy || !ready || !sufficient}
              onClick={() => onDeposit(quantity)}
            >
              Deposit rights & receive shares <ArrowRight size={15} />
            </button>
            <p className={styles.note}>
              {demo
                ? "Simulation only. No wallet transaction."
                : "Your wallet will ask you to approve access to your rights, then confirm the deposit. Network fees apply."}
            </p>
          </>
        )}
      </details>
      {ready && BigInt(state.balances[`basket:${basket.id}`] || "0") > 0n && (
        <button className="text-button" onClick={onManage}>
          Manage your shares in My assets <ArrowRight size={14} />
        </button>
      )}
    </article>
  );
}

export function BasketOfferCard({
  listing,
  basket,
  state,
  account,
  busy,
  demo,
  onConnect,
  onPurchase,
}: {
  listing: Listing;
  basket?: Basket;
  state: MarketState;
  account: string;
  busy: boolean;
  demo: boolean;
  onConnect: () => void;
  onPurchase: (quantity: string) => Promise<boolean>;
}) {
  const [accepted, setAccepted] = useState(false);
  const [quantity, setQuantity] = useState("1");
  const count = whole(quantity) ? BigInt(quantity) : 0n;
  const valid = count > 0n && count <= BigInt(listing.remaining);
  const ownListing = account.toLowerCase() === listing.seller.toLowerCase();
  return (
    <article className={`basket-pool ${styles.card}`}>
      <small>FOR SALE · BASKET #{listing.rightId}</small>
      <h3>{basket?.name || `Income basket #${listing.rightId}`}</h3>
      <p>
        {money(BigInt(listing.unitPrice))} mJPY per share · {listing.remaining}{" "}
        available
      </p>
      {basket && (
        <ul className={styles.contents}>
          {basket.rightIds.map((id, i) => (
            <li key={id}>
              <span>{rightName(state, id)}</span>
              <small>{basket.units[i]} per share</small>
            </li>
          ))}
        </ul>
      )}
      <label>
        Shares to buy
        <input
          type="number"
          min="1"
          max={listing.remaining}
          step="1"
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
        />
      </label>
      <p className={styles.total}>
        You pay <b>{money(count * BigInt(listing.unitPrice))} mJPY</b>
      </p>
      <p className={styles.note}>
        You receive {valid ? quantity : "—"} basket shares. Income is available
        only when the projects deposit revenue. No guaranteed return.
      </p>
      <label className="terms-check">
        <input
          type="checkbox"
          checked={accepted}
          onChange={(e) => setAccepted(e.target.checked)}
        />{" "}
        I reviewed the basket and underlying terms.
      </label>
      <CardPaymentOption listing={listing} quantity={quantity} account={account}
        accepted={accepted} demo={demo} busy={busy} onConnect={onConnect}>
      <button
        className="secondary wide"
        disabled={busy || (!!account && (!accepted || !valid || ownListing))}
        onClick={async () => {
          if (!account) return onConnect();
          if (await onPurchase(quantity)) setAccepted(false);
        }}
      >
        {account ? "Acquire basket shares" : "Connect wallet to buy"}{" "}
        <ArrowRight size={15} />
      </button>
      </CardPaymentOption>
      <p className={styles.note}>
        {ownListing
          ? "This is your listing. Manage it in My assets."
          : !valid
            ? "Enter a whole quantity within the available supply."
            : demo
              ? "Simulated payment and transfer."
              : "Payment approval, then purchase: two wallet confirmations. Network fees are additional."}
      </p>
    </article>
  );
}
