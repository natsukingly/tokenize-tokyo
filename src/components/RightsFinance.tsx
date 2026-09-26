"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { formatUnits } from "viem";
import type { MarketState } from "@/lib/model";
import type { WalletProvider } from "@/lib/transactions";
import { config } from "@/lib/config";
import { walletError, type TransactionProgress } from "@/lib/wallet";
import {
  financeAddresses,
  financeConfigured,
  financeEligibility,
  financeIntent,
  loadFinance,
  loadFinanceActivity,
  payment,
  positiveUnits,
  sendFinanceIntent,
  validateFinanceDeployment,
  type FinanceState,
  type FinanceIntent,
  type FinanceActivity,
} from "@/lib/rights-finance";
import styles from "./RightsFinance.module.css";

const money = (value: string | bigint) => formatUnits(BigInt(value), 18);
const same = (a?: string, b?: string) =>
  !!a && !!b && a.toLowerCase() === b.toLowerCase();
const txURL = (hash: string) =>
  config.chainId === 11155111
    ? `https://sepolia.etherscan.io/tx/${hash}`
    : `/tx/${hash}`;
type Review = { title: string; details: string[]; steps: FinanceIntent[] };

export default function RightsFinance({
  market,
  mode,
  sourceId,
  account,
  provider,
  onConnect,
  onRefresh,
}: {
  market: MarketState;
  mode: "fraction" | "rental";
  sourceId?: string;
  account?: string;
  provider?: WalletProvider | null;
  onConnect: () => void;
  onRefresh: () => void | Promise<void>;
}) {
  const [data, setData] = useState<FinanceState>();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [source, setSource] = useState(sourceId || "");
  const [units, setUnits] = useState("1");
  const [ratio, setRatio] = useState("1000");
  const [price, setPrice] = useState("1");
  const [days, setDays] = useState("7");
  const [review, setReview] = useState<Review>();
  const [consent, setConsent] = useState(false);
  const [progress, setProgress] = useState<TransactionProgress>();
  const [hashes, setHashes] = useState<string[]>([]);
  const [activity, setActivity] = useState<FinanceActivity[]>([]);
  const [auditStatus, setAuditStatus] = useState("");
  const dialog = useRef<HTMLDialogElement>(null);
  const request = useRef(0);
  const lock = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const identity = useRef(account);
  identity.current = account;
  const configured = financeConfigured();
  const load = useCallback(async () => {
    const id = ++request.current;
    setLoading(true);
    try {
      const next = await loadFinance(account);
      if (id === request.current) {
        setData(next);
        setError("");
      }
    } catch (e) {
      if (id === request.current) {
        setError(walletError(e));
        setData(undefined);
      }
    } finally {
      if (id === request.current) setLoading(false);
    }
  }, [account]);
  useEffect(() => {
    setData(undefined);
    setReview(undefined);
    setHashes([]);
    setProgress(undefined);
    if (!configured) return;
    void load();
    const timer = setInterval(() => {
      if (!lock.current) void load();
    }, 15000);
    return () => {
      ++request.current;
      clearInterval(timer);
    };
  }, [load, configured]);
  useEffect(() => {
    if (sourceId) setSource(sourceId);
  }, [sourceId]);
  useEffect(() => {
    setReview(undefined);
    setError("");
  }, [mode]);
  useEffect(() => {
    if (review && !dialog.current?.open) dialog.current?.showModal();
    if (!review && dialog.current?.open) dialog.current.close();
  }, [review]);

  const eligible = market.rights.filter(
    (r) =>
      financeEligibility(r, mode) &&
      BigInt(market.balances[`rights:${r.id}`] || "0") > 0n,
  );
  const chosen = eligible.find((r) => r.id === source) || eligible[0];
  const name = (rightId: string) => {
    const r = market.rights.find((r) => r.id === rightId);
    return `${market.assets.find((a) => a.id === r?.assetId)?.name || "Urban right"} · Right #${rightId}`;
  };
  const intent = financeIntent;
  const approveRights = (target: "fraction" | "rental") =>
    intent("rights", "setApprovalForAll", [financeAddresses[target], true]);
  const approveCash = (target: "fraction" | "rental", total: bigint) =>
    intent("settlement", "approve", [financeAddresses[target], total]);
  const prepare = (create: () => Review) => {
    if (!account || !provider) {
      onConnect();
      return;
    }
    if (lock.current) return;
    try {
      if (!data)
        throw new Error("Wait for verified contract data before transacting.");
      setReview(create());
      setConsent(false);
      setError("");
    } catch (e) {
      setError(walletError(e));
    }
  };
  const execute = async () => {
    if (!review || !consent || !provider || !account || lock.current) return;
    lock.current = true;
    setBusy(true);
    setHashes([]);
    setError("");
    const owner = account;
    try {
      await validateFinanceDeployment();
      for (const step of review.steps) {
        if (!mounted.current || identity.current !== owner)
          throw new Error("Wallet or screen changed. Review the action again.");
        await sendFinanceIntent(provider, owner, step, (p) => {
          if (!mounted.current || identity.current !== owner) return;
          setProgress(p);
          if (p.hash)
            setHashes((previous) =>
              previous.includes(p.hash!) ? previous : [...previous, p.hash!],
            );
        });
      }
      if (mounted.current && identity.current === owner) {
        setReview(undefined);
        await load();
      }
      await onRefresh();
    } catch (e) {
      if (mounted.current && identity.current === owner) {
        setError(walletError(e));
        setReview(undefined);
      }
    } finally {
      lock.current = false;
      if (mounted.current) setBusy(false);
    }
  };
  const create = () =>
    prepare(() => {
      if (!chosen)
        throw new Error("You need an eligible right in your wallet.");
      if (mode === "fraction") {
        const amount = positiveUnits(
          units,
          BigInt(market.balances[`rights:${chosen.id}`] || "0"),
        );
        const existing = data!.pools.find((p) => p.rightId === chosen.id);
        const factor = existing
          ? BigInt(existing.sharesPerUnit)
          : positiveUnits(ratio, 1000000n);
        if (factor < 2n)
          throw new Error("Use at least 2 fractions per underlying unit.");
        return {
          title: existing ? "Deposit more rights" : "Split revenue rights",
          details: [
            name(chosen.id),
            `Deposit ${amount} underlying units; receive ${amount * factor} fraction shares.`,
            `${factor} shares redeem for one underlying unit. Only future income on deposited rights belongs to these shares.`,
            "First approve the vault as a rights operator, then confirm the deposit.",
          ],
          steps: [
            approveRights("fraction"),
            existing
              ? intent("fraction", "deposit", [BigInt(existing.id), amount])
              : intent("fraction", "createPool", [
                  BigInt(chosen.id),
                  amount,
                  factor,
                ]),
          ],
        };
      }
      const daily = payment(price),
        duration = positiveUnits(days, 365n);
      return {
        title: "Offer a usage right for rent",
        details: [
          name(chosen.id),
          `Deposit 1 usage right. Price: ${money(daily)} mJPY/day; maximum ${duration} days.`,
          "The right stays in escrow. You cannot withdraw it during an active rental. Rental payments are upfront with no early-return refund.",
          "First approve escrow as a rights operator, then confirm the deposit.",
        ],
        steps: [
          approveRights("rental"),
          intent("rental", "createOffer", [BigInt(chosen.id), daily, duration]),
        ],
      };
    });
  const audit = async () => {
    setAuditStatus("Loading indexed activity…");
    try {
      const events = await loadFinanceActivity();
      setActivity(events);
      setAuditStatus(events.length ? "" : "No indexed finance activity yet.");
    } catch {
      setAuditStatus(
        "MultiBaas activity is unavailable. Confirmed transactions remain accessible below.",
      );
    }
  };

  return (
    <section className={styles.root} aria-label="Rights finance">
      <header className={styles.heading}>
        <div>
          <span>ON-CHAIN RIGHTS MANAGEMENT</span>
          <h2>
            {mode === "fraction"
              ? "Split and trade revenue rights"
              : "Rent a usage right"}
          </h2>
        </div>
        {configured && (
          <button
            type="button"
            disabled={busy || loading}
            onClick={() => void load()}
          >
            Refresh positions
          </button>
        )}
      </header>
      <p>
        {mode === "fraction"
          ? "Deposit revenue rights to issue smaller, tradable shares. Income follows each holder; earlier accrued income stays with its previous holder."
          : "The lender deposits a usage right. A renter pays upfront for temporary use; access expires on-chain even if they never click Return. The lender then withdraws the underlying right."}
      </p>
      {!configured ? (
        <p role="status">
          Fractional and rental contracts are not connected on this network yet.
          No simulated trades are substituted.
        </p>
      ) : (
        <>
          {!account && (
            <button onClick={onConnect}>Connect wallet to manage rights</button>
          )}
          {loading && !data && <p role="status">Loading contract positions…</p>}
          {error && <p role="alert">{error}</p>}
          {progress && (
            <p role="status">
              {progress.phase === "confirmed"
                ? "Transaction confirmed"
                : progress.phase === "signature"
                  ? "Confirm in your wallet"
                  : progress.phase}
            </p>
          )}
          {hashes.map((hash) => (
            <a
              className={styles.receipt}
              key={hash}
              href={txURL(hash)}
              target="_blank"
              rel="noreferrer"
            >
              View transaction {hash.slice(0, 10)} ↗
            </a>
          ))}
          {data && (
            <>
              <form
                className={styles.create}
                onSubmit={(e) => {
                  e.preventDefault();
                  create();
                }}
              >
                <h3>
                  {mode === "fraction"
                    ? "Deposit and split"
                    : "Create a rental offer"}
                </h3>
                <label>
                  Right to deposit
                  <select
                    value={chosen?.id || ""}
                    onChange={(e) => setSource(e.target.value)}
                    disabled={busy || !eligible.length}
                  >
                    {!eligible.length && (
                      <option value="">No eligible rights held</option>
                    )}
                    {eligible.map((r) => (
                      <option key={r.id} value={r.id}>
                        {name(r.id)} · {market.balances[`rights:${r.id}`]} held
                      </option>
                    ))}
                  </select>
                </label>
                {mode === "fraction" ? (
                  <>
                    <label>
                      Underlying units
                      <input
                        type="number"
                        min="1"
                        step="1"
                        value={units}
                        onChange={(e) => setUnits(e.target.value)}
                      />
                    </label>
                    <label>
                      Fractions per underlying unit
                      <input
                        type="number"
                        min="2"
                        max="1000000"
                        step="1"
                        value={ratio}
                        onChange={(e) => setRatio(e.target.value)}
                      />
                    </label>
                    {data.pools.some((p) => p.rightId === chosen?.id) && (
                      <p>
                        An existing pool's fixed ratio is used when depositing
                        more units.
                      </p>
                    )}
                  </>
                ) : (
                  <>
                    <label>
                      Rental price per day (mJPY)
                      <input
                        value={price}
                        onChange={(e) => setPrice(e.target.value)}
                        inputMode="decimal"
                      />
                    </label>
                    <label>
                      Maximum rental days
                      <input
                        type="number"
                        min="1"
                        max="365"
                        value={days}
                        onChange={(e) => setDays(e.target.value)}
                      />
                    </label>
                  </>
                )}
                <p>
                  {mode === "fraction"
                    ? "Only open-transfer revenue rights can be split. This does not divide physical access."
                    : "Only open-transfer, exclusive Usage Rights are supported. Rental access requires the project to be Active and stays within its original period."}
                </p>
                <button disabled={busy || !chosen}>
                  {mode === "fraction"
                    ? "Review deposit and split"
                    : "Review rental offer"}
                </button>
              </form>

              {mode === "fraction" ? (
                <>
                  <h3>Your fraction positions</h3>
                  {data.pools.filter(
                    (p) => BigInt(p.balance) > 0n || BigInt(p.claimable) > 0n,
                  ).length === 0 && (
                    <p>No fraction positions for this wallet yet.</p>
                  )}
                  <div className={styles.grid}>
                    {data.pools
                      .filter(
                        (p) =>
                          BigInt(p.balance) > 0n || BigInt(p.claimable) > 0n,
                      )
                      .map((p) => (
                        <article
                          className={styles.card}
                          key={p.id}
                          aria-label={`Fraction pool ${p.id}`}
                        >
                          <h4>{name(p.rightId)}</h4>
                          <p>
                            {p.balance} fraction shares held ·{" "}
                            {money(p.claimable)} mJPY claimable
                          </p>
                          <p>
                            {p.underlyingUnits} underlying units in custody ·{" "}
                            {p.sharesPerUnit} shares per unit
                          </p>
                          <button
                            disabled={busy || BigInt(p.claimable) === 0n}
                            onClick={() =>
                              prepare(() => ({
                                title: "Claim fraction revenue",
                                details: [
                                  name(p.rightId),
                                  `Currently claimable: ${money(p.claimable)} mJPY.`,
                                ],
                                steps: [
                                  intent("fraction", "claimRevenue", [
                                    BigInt(p.id),
                                  ]),
                                ],
                              }))
                            }
                          >
                            Claim fraction revenue
                          </button>
                          <FractionActions
                            pool={p}
                            busy={busy}
                            onRedeem={(value) =>
                              prepare(() => {
                                const shares = positiveUnits(
                                  value,
                                  BigInt(p.balance),
                                );
                                if (shares % BigInt(p.sharesPerUnit))
                                  throw new Error(
                                    `Redeem a multiple of ${p.sharesPerUnit} shares to recover whole underlying units.`,
                                  );
                                return {
                                  title: "Redeem underlying rights",
                                  details: [
                                    name(p.rightId),
                                    `Burn ${shares} shares; receive ${shares / BigInt(p.sharesPerUnit)} underlying units. Previously accrued income remains claimable.`,
                                  ],
                                  steps: [
                                    intent("fraction", "redeem", [
                                      BigInt(p.id),
                                      shares,
                                    ]),
                                  ],
                                };
                              })
                            }
                            onList={(quantity, unitPrice) =>
                              prepare(() => {
                                const shares = positiveUnits(
                                    quantity,
                                    BigInt(p.balance),
                                  ),
                                  cost = payment(unitPrice);
                                return {
                                  title: "List fraction shares",
                                  details: [
                                    name(p.rightId),
                                    `${shares} shares at ${money(cost)} mJPY each. Shares stay in your wallet until purchased.`,
                                  ],
                                  steps: [
                                    intent("fraction", "createListing", [
                                      BigInt(p.id),
                                      shares,
                                      cost,
                                    ]),
                                  ],
                                };
                              })
                            }
                          />
                        </article>
                      ))}
                  </div>
                  <h3>Fraction offers</h3>
                  {data.listings.filter(
                    (l) => !l.cancelled && BigInt(l.remaining) > 0n,
                  ).length === 0 && <p>No open fraction offers.</p>}
                  <div className={styles.grid}>
                    {data.listings
                      .filter((l) => !l.cancelled && BigInt(l.remaining) > 0n)
                      .map((l) => (
                        <FractionOffer
                          key={l.id}
                          listing={l}
                          name={name(
                            data.pools.find((p) => p.id === l.poolId)!.rightId,
                          )}
                          own={same(l.seller, account)}
                          busy={busy}
                          onCancel={() =>
                            prepare(() => ({
                              title: "Cancel fraction listing",
                              details: [
                                `Listing #${l.id}. Unsold shares remain in your wallet.`,
                              ],
                              steps: [
                                intent("fraction", "cancelListing", [
                                  BigInt(l.id),
                                ]),
                              ],
                            }))
                          }
                          onBuy={(value) =>
                            prepare(() => {
                              const shares = positiveUnits(
                                  value,
                                  BigInt(l.remaining),
                                ),
                                total = shares * BigInt(l.unitPrice);
                              return {
                                title: "Buy fraction shares",
                                details: [
                                  `${shares} shares of ${name(data.pools.find((p) => p.id === l.poolId)!.rightId)}`,
                                  `Pay ${money(total)} mJPY to ${l.seller}.`,
                                  "Two confirmations: exact payment approval, then purchase. Seller availability is checked atomically.",
                                ],
                                steps: [
                                  approveCash("fraction", total),
                                  intent("fraction", "purchase", [
                                    BigInt(l.id),
                                    shares,
                                  ]),
                                ],
                              };
                            })
                          }
                        />
                      ))}
                  </div>
                </>
              ) : (
                <>
                  <h3>Rental offers and your rentals</h3>
                  {!data.rentals.some((o) => !o.withdrawn) && (
                    <p>No rental offers yet.</p>
                  )}
                  <div className={styles.grid}>
                    {data.rentals
                      .filter((o) => !o.withdrawn)
                      .map((o) => (
                        <RentalCard
                          key={o.id}
                          offer={o}
                          name={name(o.rightId)}
                          account={account}
                          busy={busy}
                          onWithdraw={() =>
                            prepare(() => ({
                              title: "Withdraw rental right",
                              details: [
                                name(o.rightId),
                                "Close this offer and recover the underlying usage right.",
                              ],
                              steps: [
                                intent("rental", "withdraw", [BigInt(o.id)]),
                              ],
                            }))
                          }
                          onReturn={() =>
                            prepare(() => ({
                              title: "Return rental early",
                              details: [
                                name(o.rightId),
                                "Your access ends immediately. Prepaid rental fees are not refunded.",
                              ],
                              steps: [
                                intent("rental", "returnRental", [
                                  BigInt(o.id),
                                ]),
                              ],
                            }))
                          }
                          onRent={(value) =>
                            prepare(() => {
                              const duration = positiveUnits(
                                  value,
                                  BigInt(o.maxDays),
                                ),
                                total = duration * BigInt(o.pricePerDay);
                              return {
                                title: "Rent temporary access",
                                details: [
                                  name(o.rightId),
                                  `${duration} days, ${money(total)} mJPY prepaid. No refund for early return.`,
                                  "The original token remains in escrow. Rental access ends at expiry; it does not grant ownership or allow subletting.",
                                  "Two confirmations: exact payment approval, then rental.",
                                ],
                                steps: [
                                  approveCash("rental", total),
                                  intent("rental", "rent", [
                                    BigInt(o.id),
                                    duration,
                                  ]),
                                ],
                              };
                            })
                          }
                        />
                      ))}
                  </div>
                </>
              )}
              <details
                onToggle={(e) => {
                  if (e.currentTarget.open) void audit();
                }}
              >
                <summary>Finance activity · MultiBaas</summary>
                <p>{auditStatus}</p>
                {activity.map((a, i) => (
                  <a
                    className={styles.receipt}
                    key={a.hash + a.name + i}
                    href={txURL(a.hash)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {a.name} · block {a.block} ↗
                  </a>
                ))}
              </details>
            </>
          )}
        </>
      )}
      <dialog
        ref={dialog}
        className={styles.review}
        onCancel={(e) => {
          if (busy) e.preventDefault();
          else setReview(undefined);
        }}
        aria-label="Review finance transaction"
      >
        {review && (
          <>
            <h3>{review.title}</h3>
            <p>
              Network: {config.chainId} · Wallet: {account}
            </p>
            {review.details.map((d) => (
              <p key={d}>{d}</p>
            ))}
            <label className={styles.consent}>
              <input
                type="checkbox"
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
                disabled={busy}
              />
              I reviewed the rights, amounts and terms.
            </label>
            <div className={styles.actions}>
              <button
                disabled={busy || !consent}
                onClick={() => void execute()}
              >
                {busy
                  ? "Waiting for wallet / confirmation…"
                  : "Confirm transaction"}
              </button>
              <button disabled={busy} onClick={() => setReview(undefined)}>
                Cancel
              </button>
            </div>
            {progress && <p role="status">{progress.phase}</p>}
          </>
        )}
      </dialog>
    </section>
  );
}

function FractionActions({
  pool,
  busy,
  onRedeem,
  onList,
}: {
  pool: FinanceState["pools"][number];
  busy: boolean;
  onRedeem: (n: string) => void;
  onList: (n: string, p: string) => void;
}) {
  const [amount, setAmount] = useState("1"),
    [price, setPrice] = useState("1");
  return (
    <div className={styles.actions}>
      <label>
        Fraction quantity
        <input
          type="number"
          min="1"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
      </label>
      <label>
        Price per fraction (mJPY)
        <input
          inputMode="decimal"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
        />
      </label>
      <button
        disabled={busy || BigInt(pool.balance) === 0n}
        onClick={() => onList(amount, price)}
      >
        List fractions for resale
      </button>
      <button
        disabled={busy || BigInt(pool.balance) < BigInt(pool.sharesPerUnit)}
        onClick={() => onRedeem(amount)}
      >
        Redeem underlying rights
      </button>
    </div>
  );
}
function FractionOffer({
  listing: l,
  name,
  own,
  busy,
  onCancel,
  onBuy,
}: {
  listing: FinanceState["listings"][number];
  name: string;
  own: boolean;
  busy: boolean;
  onCancel: () => void;
  onBuy: (n: string) => void;
}) {
  const [quantity, setQuantity] = useState("1");
  return (
    <article className={styles.card} aria-label={`Fraction offer ${l.id}`}>
      <h4>{name}</h4>
      <p>
        {l.remaining} shares offered · {money(l.unitPrice)} mJPY / share
      </p>
      <small>Seller: {l.seller}</small>
      {own ? (
        <button disabled={busy} onClick={onCancel}>
          Cancel fraction listing
        </button>
      ) : (
        <>
          <label>
            Shares to buy
            <input
              type="number"
              min="1"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
            />
          </label>
          <button disabled={busy} onClick={() => onBuy(quantity)}>
            Review fraction purchase
          </button>
        </>
      )}
    </article>
  );
}
function RentalCard({
  offer: o,
  name,
  account,
  busy,
  onWithdraw,
  onReturn,
  onRent,
}: {
  offer: FinanceState["rentals"][number];
  name: string;
  account?: string;
  busy: boolean;
  onWithdraw: () => void;
  onReturn: () => void;
  onRent: (d: string) => void;
}) {
  const [days, setDays] = useState("1");
  return (
    <article className={styles.card} aria-label={`Rental offer ${o.id}`}>
      <h4>{name}</h4>
      <p>
        {money(o.pricePerDay)} mJPY/day · up to {o.maxDays} days
      </p>
      <small>Lender: {o.lender}</small>
      <p>
        {o.available
          ? "Available to rent"
          : o.withdrawable
            ? "Awaiting project activation or outside right period"
            : `Rental reserved until ${new Date(o.endsAt * 1000).toLocaleString()}`}
      </p>
      {!/^0x0{40}$/i.test(o.user) && <p>Current user: {o.user}</p>}
      {same(o.lender, account) ? (
        <button disabled={busy || !o.withdrawable} onClick={onWithdraw}>
          Withdraw usage right
        </button>
      ) : same(o.renter, account) && !o.withdrawable ? (
        <button disabled={busy} onClick={onReturn}>
          Return rental early
        </button>
      ) : (
        <>
          <label>
            Rental days
            <input
              type="number"
              min="1"
              max={o.maxDays}
              value={days}
              onChange={(e) => setDays(e.target.value)}
            />
          </label>
          <button disabled={busy || !o.available} onClick={() => onRent(days)}>
            Review rental
          </button>
        </>
      )}
    </article>
  );
}
