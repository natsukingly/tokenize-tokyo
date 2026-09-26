"use client";
import { useState } from "react";
import { ArrowRight, MapPin } from "lucide-react";
import { formatEther } from "viem";
import type { Basket, ChainEvent, Listing, MarketState } from "@/lib/model";
import { SPACE_TYPES } from "@/lib/catalog";
import type { AssetKind } from "@/lib/catalog";
import AssetIcon from "./AssetIcon";
import styles from "./BasketCards.module.css";
import CardPaymentOption from "./CardPaymentOption";

const whole = (value: string) => /^\d+$/.test(value) && BigInt(value) > 0n;
const money = (value: bigint) =>
  Number(formatEther(value)).toLocaleString("en-US", {
    maximumFractionDigits: 2,
  });

function rightInfo(state: MarketState, id: string) {
  const right = state.rights.find((r) => r.id === id);
  const asset = state.assets.find((a) => a.id === right?.assetId);
  return {
    name: asset?.name || `Revenue right #${id}`,
    kind: asset?.kind || ("Other" as AssetKind),
    supply: right ? BigInt(right.supply || "0") : 0n,
  };
}

function depositedForRight(events: ChainEvent[], id: string) {
  return events
    .filter(
      (e) =>
        e.name === "RevenueDeposited" && String(e.args.rightId ?? "") === id,
    )
    .reduce(
      (total, e) => total + BigInt(String(e.args.amount ?? "") || "0"),
      0n,
    );
}

function incomePerShare(state: MarketState, basket: Basket) {
  return basket.rightIds.reduce((total, id, i) => {
    const { supply } = rightInfo(state, id);
    if (supply === 0n) return total;
    const units = BigInt(basket.units[i] || "0");
    return total + (depositedForRight(state.events, id) * units) / supply;
  }, 0n);
}

function compositionIntro(entries: { units: bigint }[]) {
  const first = entries[0]?.units ?? 1n;
  const uniform = entries.every((e) => e.units === first);
  const wording = uniform
    ? `${String(first)} unit${first === 1n ? "" : "s"} of each right below`
    : "a fixed number of units of each right below";
  return `1 share = ${wording}, held in the BasketVault. Revenue from all of them is paid out to share holders.`;
}

function RightRow({
  state,
  id,
  units,
}: {
  state: MarketState;
  id: string;
  units: bigint;
}) {
  const { name, kind } = rightInfo(state, id);
  return (
    <li>
      <span className={styles.rightLabel}>
        <i
          className={styles.dot}
          style={{ background: SPACE_TYPES[kind].color }}
          aria-hidden="true"
        />
        <AssetIcon kind={kind} size={16} />
        <span className={styles.rightName}>
          <span>{name}</span>
          <small>{kind}</small>
        </span>
      </span>
      <b>
        {String(units)} {units === 1n ? "unit" : "units"} / share
      </b>
    </li>
  );
}

function CompositionDonut({
  state,
  entries,
}: {
  state: MarketState;
  entries: { id: string; units: bigint }[];
}) {
  const rows = entries.map((e) => ({ ...e, ...rightInfo(state, e.id) }));
  const total = rows.reduce((a, r) => a + r.units, 0n);
  let offset = 0;
  return (
    <div className={styles.donutWrap}>
      <svg
        viewBox="0 0 120 120"
        role="img"
        aria-label="Basket composition by asset type"
      >
        <circle
          cx="60"
          cy="60"
          r="48"
          fill="none"
          stroke="var(--line)"
          strokeWidth="16"
        />
        {total > 0n &&
          rows.map((r) => {
            const share = Number((r.units * 1000000n) / total) / 10000;
            const start = offset;
            offset += share;
            return (
              <circle
                key={r.id}
                cx="60"
                cy="60"
                r="48"
                fill="none"
                pathLength="100"
                stroke={SPACE_TYPES[r.kind].color}
                strokeWidth="16"
                strokeDasharray={`${share} ${100 - share}`}
                strokeDashoffset={-start}
                transform="rotate(-90 60 60)"
              >
                <title>
                  {r.name} ({r.kind}): {String(r.units)} unit
                  {r.units === 1n ? "" : "s"} / share
                </title>
              </circle>
            );
          })}
      </svg>
      <div className={styles.donutCenter} aria-hidden="true">
        <strong>{rows.length}</strong>
        <span>{rows.length === 1 ? "right" : "rights"}</span>
      </div>
    </div>
  );
}

function BasketIncome({
  state,
  basket,
  listing,
}: {
  state: MarketState;
  basket: Basket;
  listing?: Listing;
}) {
  const perShare = incomePerShare(state, basket);
  const price = listing ? BigInt(listing.unitPrice) : 0n;
  const pct =
    listing && price > 0n ? Number((perShare * 1000n) / price) / 10 : undefined;
  return (
    <div className={styles.income}>
      <p>
        Income deposited so far:{" "}
        <b className={styles.highlight}>{money(perShare)} mJPY</b> per share
      </p>
      {listing && pct !== undefined && (
        <p>
          = <b className={styles.highlight}>{pct.toFixed(1)}%</b> of the current
          share price ({money(price)} mJPY)
        </p>
      )}
      <p className={styles.note}>
        Realized income from actual deposits. Not a yield forecast.
      </p>
    </div>
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
    units: BigInt(basket.units[i] || "0"),
    held: ready ? BigInt(state.balances[`rights:${id}`] || "0") : 0n,
  }));
  const sufficient =
    count > 0n &&
    count <= 10n ** 12n &&
    amounts.every((a) => a.held >= a.units * count);
  const activeListing = state.listings.find(
    (l) =>
      l.token === "basket" &&
      l.rightId === basket.id &&
      !l.cancelled &&
      BigInt(l.remaining) > 0n,
  );
  return (
    <article className={`basket-pool ${styles.card}`}>
      <small>INCOME BASKET · #{basket.id}</small>
      <div className={styles.head}>
        <div className={styles.headText}>
          <h3>{basket.name}</h3>
          <p className={styles.intro}>{compositionIntro(amounts)}</p>
        </div>
        <CompositionDonut state={state} entries={amounts} />
      </div>
      <ul className={styles.contents}>
        {amounts.map(({ id, units }) => (
          <RightRow key={id} state={state} id={id} units={units} />
        ))}
      </ul>
      <BasketIncome state={state} basket={basket} listing={activeListing} />
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
                  <span>{rightInfo(state, id).name}</span>
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
  const entries = basket
    ? basket.rightIds.map((id, i) => ({
        id,
        units: BigInt(basket.units[i] || "0"),
      }))
    : [];
  return (
    <article className={`basket-pool ${styles.card}`}>
      <small>FOR SALE · BASKET #{listing.rightId}</small>
      <div className={styles.head}>
        <div className={styles.headText}>
          <h3>{basket?.name || `Income basket #${listing.rightId}`}</h3>
          {basket && (
            <p className={styles.intro}>{compositionIntro(entries)}</p>
          )}
          <p>
            {money(BigInt(listing.unitPrice))} mJPY per share ·{" "}
            {listing.remaining} available
          </p>
        </div>
        {basket && <CompositionDonut state={state} entries={entries} />}
      </div>
      {basket && (
        <>
          <ul className={styles.contents}>
            {entries.map(({ id, units }) => (
              <RightRow key={id} state={state} id={id} units={units} />
            ))}
          </ul>
          <BasketIncome state={state} basket={basket} listing={listing} />
        </>
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
      <CardPaymentOption
        listing={listing}
        quantity={quantity}
        account={account}
        accepted={accepted}
        demo={demo}
        busy={busy}
        onConnect={onConnect}
      >
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
