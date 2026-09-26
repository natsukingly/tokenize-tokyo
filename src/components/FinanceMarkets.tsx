"use client";
import { useEffect, useState, type ReactNode } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  Layers3,
  KeyRound,
  Plus,
  ListFilter,
  Landmark,
} from "lucide-react";
import MapThumbnail from "./MapThumbnail";
import ReturnScenario from "./ReturnScenario";
import Launchpad from "./Launchpad";
import RightsFinance from "./RightsFinance";
import LendingPreview, { ComingSoonBadge } from "./LendingPreview";
import type { WalletProvider } from "@/lib/transactions";
import { DEMO_SITES } from "@/lib/demo-catalog";
import {
  initialFinance,
  buyFraction,
  listFraction,
  fillResale,
  rentRight,
  returnRental,
  createMockOffer,
  type FinanceState,
  type Offer,
} from "@/lib/finance-lab";
import type { MarketState } from "@/lib/model";
const SAMPLE_SPACES: Record<string, string> = {
  "fraction-parking": "Akihabara Parking Bay",
  "fraction-ad": "Ningyocho Wall Canvas",
  "fraction-home": "Kuramae Makers House",
  "rental-storage": "Asakusabashi Storage",
  "rental-parking": "Akihabara Parking Bay",
  "rental-land": "Yaesu Weekend Market",
};
const STORAGE = "tokenize-tokyo-finance-lab-v1";
export type MarketView =
  "assets" | "funding" | "fraction" | "rental" | "lending";
export default function FinanceMarkets({
  market,
  sourceId,
  demo,
  onView,
  onCreate,
  directory,
  view,
  onViewChange,
  account,
  provider,
  onConnect = () => {},
  onRefresh = () => {},
}: {
  market: MarketState;
  sourceId?: string;
  demo: boolean;
  onView: (assetId: string) => void;
  onCreate: () => void;
  directory: ReactNode;
  view: MarketView;
  onViewChange: (view: MarketView) => void;
  account?: string;
  provider?: WalletProvider | null;
  onConnect?: () => void;
  onRefresh?: () => void | Promise<void>;
}) {
  const mode: Offer["mode"] = view === "rental" ? "rental" : "fraction";
  const mockMarket = view === "fraction" || view === "rental";
  const [state, setState] = useState<FinanceState>(initialFinance),
    [selected, setSelected] = useState(""),
    [amount, setAmount] = useState("10"),
    [confirm, setConfirm] = useState(false),
    [notice, setNotice] = useState(""),
    [error, setError] = useState(""),
    [create, setCreate] = useState(false),
    [source, setSource] = useState(sourceId || ""),
    [price, setPrice] = useState("50");
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE);
      if (raw) {
        const saved = JSON.parse(raw);
        if (
          saved.version === 1 &&
          Array.isArray(saved.offers) &&
          Array.isArray(saved.positions) &&
          Array.isArray(saved.resales) &&
          Array.isArray(saved.rentals) &&
          Number.isFinite(saved.cash)
        )
          setState(saved);
      }
    } catch {}
  }, []);
  useEffect(() => {
    if (sourceId) {
      setSource(sourceId);
      setCreate(true);
    }
  }, [sourceId]);
  const change = (fn: (s: FinanceState) => FinanceState, message: string) => {
    try {
      const next = fn(state);
      localStorage.setItem(STORAGE, JSON.stringify(next));
      setState(next);
      setError("");
      setNotice(message);
      setConfirm(false);
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    }
  };
  const offers = state.offers.filter((o) => o.mode === mode),
    offer = offers.find((o) => o.id === selected) || offers[0],
    units = Number(amount),
    total = units * (offer?.price || 0);
  const holdings = market.rights.filter(
    (r) => BigInt(market.balances["rights:" + r.id] || "0") > 0n,
  );
  const selectMode = (m: Offer["mode"]) => {
    onViewChange(m);
    setSelected("");
    setAmount(m === "fraction" ? "10" : "7");
    setConfirm(false);
    setNotice("");
  };
  const createPool = () => {
    const right = holdings.find((r) => r.id === source),
      asset = market.assets.find((a) => a.id === right?.assetId);
    if (!asset || !right) {
      setError(
        "Choose a right you hold in Portfolio. Sample markets below work without a holding.",
      );
      return;
    }
    const src = {
      id: "Urban right #" + right.id,
      name: asset.name,
      kind: asset.kind,
    };
    if (
      change(
        (s) => createMockOffer(s, src, mode, Number(price)),
        "Mock market created. Your protocol token has not moved.",
      )
    )
      setCreate(false);
  };
  return (
    <section className="finance-lab">
      <div className="finance-tabs" role="tablist" aria-label="Market view">
        <button
          role="tab"
          aria-selected={view === "assets"}
          onClick={() => onViewChange("assets")}
        >
          <ListFilter size={18} />
          All assets
        </button>
        <button
          role="tab"
          aria-selected={view === "funding"}
          onClick={() => onViewChange("funding")}
        >
          <ArrowUpRight size={18} />
          Funding
        </button>
        <button
          role="tab"
          aria-selected={view === "fraction"}
          onClick={() => selectMode("fraction")}
        >
          <Layers3 size={18} />
          Fractional
        </button>
        <button
          role="tab"
          aria-selected={view === "rental"}
          onClick={() => selectMode("rental")}
        >
          <KeyRound size={18} />
          Rental
        </button>
        <button
          role="tab"
          aria-selected={view === "lending"}
          onClick={() => onViewChange("lending")}
        >
          <Landmark size={18} aria-hidden="true" />
          Lending <ComingSoonBadge />
        </button>
        {mockMarket && demo && (
          <button className="text-button" onClick={() => setCreate(!create)}>
            <Plus size={14} />
            Create mock market
          </button>
        )}
      </div>
      {view === "assets" ? (
        directory
      ) : view === "funding" ? (
        <Launchpad
          market={market}
          demo={demo}
          onView={onView}
          onCreate={onCreate}
        />
      ) : view === "lending" ? (
        <LendingPreview />
      ) : !demo ? (
        <RightsFinance
          market={market}
          mode={mode}
          sourceId={sourceId}
          account={account}
          provider={provider}
          onConnect={onConnect}
          onRefresh={onRefresh}
        />
      ) : (
        <>
          <div className="lab-disclaimer">
            <span>CONCEPT MARKET · MOCK ONLY</span>
            <p>
              No wallet transaction, custody transfer, income or enforceable
              rental is created. Mock credits are separate from MockJPY.
            </p>
          </div>
          <details className="finance-story">
            <summary>How this market works</summary>
            <p>
              {mode === "fraction"
                ? "Preview fractional ownership of a right’s economic value, then resale. Usage permission stays with one operator; shares do not grant simultaneous exclusive use."
                : "Preview temporary access to a space. The token owner retains title while a renter receives time-limited permission."}
            </p>
            <div>
              <span>Existing right</span>
              <ArrowRight size={14} />
              <span>
                {mode === "fraction" ? "1,000 mock shares" : "Temporary access"}
              </span>
              <ArrowRight size={14} />
              <span>
                {mode === "fraction" ? "Buy → Resell" : "Rent → Return"}
              </span>
            </div>
          </details>
          {create && (
            <div className="mock-create">
              <h3>Use a held token as the reference</h3>
              <p>
                No token leaves your Portfolio. This creates a separate
                financial-market simulation.
              </p>
              <div className="form-grid">
                <label>
                  Underlying right
                  <select
                    aria-label="Underlying right"
                    value={source}
                    onChange={(e) => setSource(e.target.value)}
                  >
                    <option value="">Choose from your Portfolio</option>
                    {holdings.map((r) => (
                      <option key={r.id} value={r.id}>
                        {market.assets.find((a) => a.id === r.assetId)?.name} ·
                        #{r.id}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  {mode === "fraction" ? "Price per share" : "Price per day"}{" "}
                  (credits)
                  <input
                    aria-label="Mock offer price"
                    type="number"
                    min="1"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                  />
                </label>
              </div>
              {!holdings.length && (
                <p>
                  Acquire a right in Explore first, or try the sample markets
                  below.
                </p>
              )}
              <button
                className="primary"
                disabled={!source}
                onClick={createPool}
              >
                Create {mode === "fraction" ? "fraction pool" : "rental offer"}{" "}
                <ArrowRight size={16} />
              </button>
            </div>
          )}
          {error && (
            <p className="feedback error" role="alert">
              {error}
            </p>
          )}
          {notice && (
            <p className="feedback" role="status">
              <Check size={16} />
              {notice}
            </p>
          )}
          <div className="finance-grid">
            <div className="mock-offers">
              {offers.map((o) => (
                <button
                  key={o.id}
                  className={
                    "mock-offer " + (offer?.id === o.id ? "selected" : "")
                  }
                  onClick={() => {
                    setSelected(o.id);
                    setConfirm(false);
                  }}
                >
                  <MapThumbnail
                    kind={o.kind}
                    coordinates={
                      SAMPLE_SPACES[o.id]
                        ? DEMO_SITES.find((a) => a.name === SAMPLE_SPACES[o.id])
                            ?.coordinates
                        : market.assets.find(
                            (a) =>
                              a.id ===
                              market.rights.find(
                                (r) => o.underlying === "Urban right #" + r.id,
                              )?.assetId,
                          )?.coordinates
                    }
                  />
                  <span>
                    <b>{o.name}</b>
                    <small>
                      {o.kind} · {o.provider}
                    </small>
                  </span>
                  <strong>
                    {o.price.toLocaleString()}
                    <small>
                      credits / {mode === "fraction" ? "share" : "day"}
                    </small>
                  </strong>
                </button>
              ))}
              <small className="map-preview-credit">
                Demo locations · ©{" "}
                <a
                  href="https://www.openstreetmap.org/copyright"
                  target="_blank"
                  rel="noreferrer"
                >
                  OpenStreetMap
                </a>{" "}
                ·{" "}
                <a
                  href="https://openmaptiles.org"
                  target="_blank"
                  rel="noreferrer"
                >
                  OpenMapTiles
                </a>{" "}
                ·{" "}
                <a
                  href="https://openfreemap.org"
                  target="_blank"
                  rel="noreferrer"
                >
                  OpenFreeMap
                </a>
              </small>
            </div>
            {offer && (
              <aside className="mock-order">
                <span className="eyebrow">SIMULATED ORDER</span>
                <h3>{offer.name}</h3>
                <p>
                  {mode === "fraction"
                    ? `${offer.available} / ${offer.total} mock shares available. Each share represents 1/${offer.total} of this demo pool’s economic interest.`
                    : `Up to ${offer.maxDays} days. ${offer.available ? "Available now." : "Currently rented."} Owner retains the original token.`}
                </p>
                <label>
                  {mode === "fraction" ? "Shares to acquire" : "Rental days"}
                  <input
                    aria-label="Mock order quantity"
                    type="number"
                    min="1"
                    max={mode === "fraction" ? offer.available : offer.maxDays}
                    value={amount}
                    onChange={(e) => {
                      setAmount(e.target.value);
                      setConfirm(false);
                    }}
                  />
                </label>
                <div className="mock-total">
                  <span>Mock total</span>
                  <b>
                    {Number.isFinite(total) ? total.toLocaleString() : "—"}{" "}
                    credits
                  </b>
                </div>
                <p className="caption">
                  Your sandbox balance: {state.cash.toLocaleString()} credits
                </p>
                {confirm ? (
                  <div className="mock-confirm">
                    <p>
                      {mode === "fraction"
                        ? "This updates mock shares and credits only."
                        : "This creates a simulated access pass only. No real property access is granted."}
                    </p>
                    <button
                      className="primary wide"
                      onClick={() =>
                        change(
                          (s) =>
                            mode === "fraction"
                              ? buyFraction(s, offer.id, units)
                              : rentRight(s, offer.id, units),
                          mode === "fraction"
                            ? "Mock shares acquired. Try listing them for resale below."
                            : "Mock access pass created. The owner still holds the token.",
                        )
                      }
                    >
                      {mode === "fraction"
                        ? "Confirm mock purchase"
                        : "Confirm mock rental"}
                    </button>
                    <button
                      className="text-button"
                      onClick={() => setConfirm(false)}
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    className="primary wide"
                    disabled={
                      !offer.available ||
                      !Number.isInteger(units) ||
                      units < 1 ||
                      units >
                        (mode === "fraction"
                          ? offer.available
                          : offer.maxDays) ||
                      total > state.cash
                    }
                    onClick={() => setConfirm(true)}
                  >
                    {mode === "fraction"
                      ? "Preview purchase"
                      : "Preview rental"}
                    <ArrowUpRight size={16} />
                  </button>
                )}
              </aside>
            )}
          </div>
          {offer && (
            <ReturnScenario key={offer.id} offer={offer} units={units} />
          )}
          <section className="mock-portfolio" aria-label="Mock positions">
            <div className="section-title">
              <h2>
                {mode === "fraction"
                  ? "Your mock shares & resales"
                  : "Your mock access passes"}
              </h2>
              <span>SANDBOX POSITIONS</span>
            </div>
            {mode === "fraction" ? (
              <>
                {!state.positions.length && (
                  <p className="empty compact">
                    A purchase will appear here. Then try a resale.
                  </p>
                )}
                {state.positions
                  .filter((p) => p.shares > 0)
                  .map((p) => {
                    const o = state.offers.find((o) => o.id === p.offerId)!;
                    return (
                      <div className="mock-position" key={p.id}>
                        <div>
                          <b>{o.name}</b>
                          <p>
                            {p.shares} mock shares ·{" "}
                            {((p.shares / o.total) * 100).toFixed(1)}% economic
                            interest
                          </p>
                        </div>
                        <button
                          className="secondary"
                          onClick={() =>
                            change(
                              (s) =>
                                listFraction(
                                  s,
                                  p.id,
                                  Math.min(p.shares, Number(amount)),
                                  o.price,
                                ),
                              "Mock resale listed. Shares are reserved until the simulated buyer fills the order.",
                            )
                          }
                        >
                          List {Math.min(p.shares, Number(amount) || 0)} shares
                          for resale
                        </button>
                      </div>
                    );
                  })}
                {state.resales.map((r) => (
                  <div className="mock-position" key={r.id}>
                    <div>
                      <b>
                        {r.shares} shares ·{" "}
                        {r.filled ? "Resale settled" : "Open resale"}
                      </b>
                      <p>
                        {state.offers.find((o) => o.id === r.offerId)?.name} ·{" "}
                        {r.price} credits / share
                      </p>
                    </div>
                    {!r.filled && (
                      <button
                        className="secondary"
                        onClick={() =>
                          change(
                            (s) => fillResale(s, r.id),
                            "Simulated buyer filled the resale. Mock credits settled once.",
                          )
                        }
                      >
                        Simulate a buyer
                      </button>
                    )}
                  </div>
                ))}
              </>
            ) : (
              <>
                {!state.rentals.length && (
                  <p className="empty compact">
                    A rental will create a dated demo access pass here.
                  </p>
                )}
                {state.rentals.map((r) => (
                  <div className="mock-position" key={r.id}>
                    <div>
                      <b>
                        {state.offers.find((o) => o.id === r.offerId)?.name}
                      </b>
                      <p>
                        {r.active ? "Active demo pass" : "Returned"} · until{" "}
                        {new Date(r.endsAt).toLocaleDateString()} · Owner keeps
                        token
                      </p>
                    </div>
                    {r.active && (
                      <button
                        className="secondary"
                        onClick={() =>
                          change(
                            (s) => returnRental(s, r.id),
                            "Demo access returned. The original token stayed with its owner. No refund is simulated.",
                          )
                        }
                      >
                        Return access
                      </button>
                    )}
                  </div>
                ))}
              </>
            )}
          </section>
        </>
      )}
    </section>
  );
}
