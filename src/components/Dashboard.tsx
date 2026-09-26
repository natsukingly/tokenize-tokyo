"use client";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowUpRight,
  ArrowRight,
  Sun,
  House,
  Layers3,
  MapPin,
  Wallet,
  Plus,
  Check,
  ShieldCheck,
  Activity,
  ChevronDown,
  X,
  RefreshCw,
  Building2,
  Leaf,
  Menu,
  ExternalLink,
  Sparkles,
} from "lucide-react";
import { formatEther, parseEther, keccak256, stringToHex } from "viem";
import { config, type ContractKey } from "@/lib/config";
import {
  ACTORS,
  DEMO_ADDRESSES,
  demoState,
  demoCall,
  resetDemo,
} from "@/lib/demo";
import {
  EMPTY,
  metadataURI,
  parseMetadata,
  short,
  type Asset,
  type MarketState,
  type Right,
} from "@/lib/model";
import { assetStage } from "@/lib/lifecycle";
import {
  DORMANT_DATASET_LABEL,
  DORMANT_SITES,
  dormantCount,
  type DormantSite,
  type LensKind,
} from "@/lib/dormant";
import { loadMarket, sendViaMultiBaas } from "@/lib/multibaas";
import type { WalletProvider } from "@/lib/transactions";
const TokyoMap = dynamic(() => import("./TokyoMap"), {
  ssr: false,
  loading: () => <div className="map-stage map-loading">Preparing Tokyo…</div>,
});
const money = (wei: string) =>
  Number(formatEther(BigInt(wei || "0"))).toLocaleString("en-US", {
    maximumFractionDigits: 2,
  });
const today = () => new Date().toISOString().slice(0, 10);
const year = () =>
  new Date(Date.now() + 365 * 86400000).toISOString().slice(0, 10);
const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();
const DEMO = config.mode === "demo";
export default function Dashboard() {
  const [state, setState] = useState<MarketState>(EMPTY),
    [tab, setTab] = useState("Explore"),
    [kind, setKind] = useState("All assets"),
    [status, setStatus] = useState("All stages"),
    [selected, setSelected] = useState("1"),
    [actor, setActor] = useState<keyof typeof ACTORS>("Investor B"),
    [account, setAccount] = useState(""),
    [busy, setBusy] = useState(""),
    [notice, setNotice] = useState(""),
    [error, setError] = useState(""),
    [showTokenize, setShowTokenize] = useState(false),
    [xray, setXray] = useState(false),
    [lens, setLens] = useState(false),
    [ownedOnly, setOwnedOnly] = useState(false),
    [refreshing, setRefreshing] = useState(false),
    [lastSync, setLastSync] = useState(""),
    [compose, setCompose] = useState<string[]>([]),
    [highlighted, setHighlighted] = useState<string[]>([]),
    [quantity, setQuantity] = useState("1"),
    [listPrice, setListPrice] = useState("2400"),
    [deposit, setDeposit] = useState("10000"),
    [termsAccepted, setTermsAccepted] = useState(false);
  const [form, setForm] = useState({
    name: "",
    district: "TOKYO",
    kind: "Rooftop",
    right: "Revenue Share",
    area: "100",
    capacity: "20",
    supply: "100",
    price: "2400",
    terms:
      "Receive a proportional share of revenue actually deposited by this solar project. No guaranteed yield.",
    evidence: "Simulated ownership evidence for this hackathon demo.",
    start: today(),
    end: year(),
    policy: "Open",
    scope: "Rooftop",
    purpose: "SOLAR",
    exclusive: "Yes",
    lng: "139.775",
    lat: "35.689",
  });
  const active = DEMO ? ACTORS[actor] : account,
    addresses = DEMO ? DEMO_ADDRESSES : config.addresses;
  const activeRef = useRef(active);
  activeRef.current = active;
  const loading = useRef(false);
  const refreshPending = useRef(false);
  const refresh = useCallback(async () => {
    if (loading.current) {
      refreshPending.current = true;
      return;
    }
    const requestedAccount = activeRef.current;
    loading.current = true;
    setRefreshing(true);
    try {
      const s = DEMO
        ? demoState(activeRef.current)
        : await loadMarket(activeRef.current || undefined);
      if (requestedAccount === activeRef.current) setState(s);
      else refreshPending.current = true;
      setLastSync(new Date().toLocaleTimeString());
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load MultiBaas");
    } finally {
      loading.current = false;
      setRefreshing(false);
      if (refreshPending.current) {
        refreshPending.current = false;
        setTimeout(() => void refresh(), 0);
      }
    }
  }, []);
  useEffect(() => {
    void refresh();
  }, [active, refresh]);
  useEffect(() => {
    if (DEMO) return;
    let revision = "",
      running = false;
    const timer = setInterval(async () => {
      if (running) return;
      running = true;
      try {
        const res = await fetch("/api/activity", { cache: "no-store" });
        if (res.ok) {
          const data = await res.json();
          if (revision && data.revision !== revision) void refresh();
          revision = data.revision;
        }
      } catch {
        // Periodic SDK refresh remains available while webhook notifications are unreachable.
      } finally {
        running = false;
      }
    }, 2000);
    const fallback = setInterval(() => void refresh(), 15000);
    return () => {
      clearInterval(timer);
      clearInterval(fallback);
    };
  }, [refresh]);
  useEffect(() => {
    const p = (window as unknown as { ethereum?: WalletProvider }).ethereum;
    if (!p) return;
    const changed = () => {
      setAccount("");
      setNotice("Wallet changed. Reconnect to refresh your portfolio.");
    };
    p.on?.("accountsChanged", changed);
    p.on?.("chainChanged", changed);
    return () => {
      p.removeListener?.("accountsChanged", changed);
      p.removeListener?.("chainChanged", changed);
    };
  }, []);
  const connect = async () => {
    try {
      const p = (window as unknown as { ethereum?: WalletProvider }).ethereum;
      if (!p) throw new Error("Install a browser wallet to use the testnet.");
      const accounts = (await p.request({
        method: "eth_requestAccounts",
      })) as string[];
      setAccount(accounts[0] || "");
    } catch (e) {
      setError((e as Error).message);
    }
  };
  const send = async (
    contract: ContractKey,
    method: string,
    args: unknown[] = [],
  ) => {
    if (!active) throw new Error("Connect your wallet first.");
    if (DEMO) return demoCall(active, contract, method, args);
    const p = (window as unknown as { ethereum?: WalletProvider }).ethereum;
    if (!p) throw new Error("Browser wallet unavailable");
    return sendViaMultiBaas(p, active, contract, method, args);
  };
  const run = async (label: string, work: () => Promise<unknown>) => {
    if (busy) return;
    setBusy(label);
    setError("");
    setNotice("");
    try {
      await work();
      setNotice(
        DEMO
          ? label + " · simulated successfully"
          : label + " · confirmed. Waiting for the MultiBaas index.",
      );
      await refresh();
    } catch (e) {
      setError((e as Error).message || "Action failed");
    } finally {
      setBusy("");
    }
  };
  const assets = state.assets.filter(
    (a) =>
      (kind === "All assets" || a.kind === kind) &&
      (!ownedOnly ||
        state.rights.some(
          (r) =>
            r.assetId === a.id &&
            BigInt(state.balances["rights:" + r.id] || "0") > 0n,
        )),
  );
  const available = (r: Right) =>
    ["Verified", "Active"].includes(r.status) &&
    r.endAt > Date.now() / 1000 &&
    r.policy !== "Nontransferable";
  const listingFor = (a: Asset) =>
    state.listings.filter(
      (l) =>
        l.token === "rights" &&
        !l.cancelled &&
        BigInt(l.remaining) > 0n &&
        state.rights.some(
          (r) => r.id === l.rightId && r.assetId === a.id && available(r),
        ),
    );
  const stage = (a: Asset) =>
    assetStage(a.id, state, listingFor(a).length > 0, addresses.rights);
  const filtered = assets.filter(
    (a) =>
      status === "All stages" ||
      stage(a) === status ||
      (status === "Secondary Market" &&
        listingFor(a).some(
          (l) =>
            !same(
              l.seller,
              state.rights.find((r) => r.id === l.rightId)?.issuer || "",
            ),
        )),
  );
  useEffect(() => {
    if (
      tab === "Explore" &&
      filtered.length &&
      !filtered.some((a) => a.id === selected)
    ) {
      setSelected(filtered[0].id);
      setTermsAccepted(false);
      setQuantity("1");
    }
  }, [tab, filtered, selected]);
  const asset = state.assets.find((a) => a.id === selected),
    rights = state.rights.filter((r) => r.assetId === selected),
    listings = asset ? listingFor(asset) : [];
  const select = useCallback((id: string) => {
    setSelected(id);
    setTermsAccepted(false);
    setQuantity("1");
  }, []);
  const activeAssets = state.assets.filter((a) => stage(a) === "Active");
  const activatedCount = state.assets.filter((a) =>
    state.rights.some((r) => r.assetId === a.id && r.status === "Active"),
  ).length;
  const openDormant = (site: DormantSite) => {
    setForm((f) => ({
      ...f,
      name: site.name,
      district: site.district,
      kind: site.kind,
      right: site.kind === "Vacant Home" ? "Usage Right" : "Revenue Share",
      supply: site.kind === "Vacant Home" ? "1" : "100",
      scope:
        site.kind === "Rooftop"
          ? "Rooftop"
          : site.kind === "Vacant Home"
            ? "Interior"
            : "Land",
      area: String(site.area),
      capacity: String(site.capacity),
      lng: String(site.coordinates[0]),
      lat: String(site.coordinates[1]),
    }));
    setShowTokenize(true);
    setTab("Tokenize");
  };
  const compatible = state.rights.filter(
    (r) =>
      r.kind === "Revenue Share" &&
      r.policy === "Open" &&
      available(r) &&
      BigInt(state.balances["rights:" + r.id] || "0") > 0n &&
      !state.baskets.some((b) => b.rightIds.includes(r.id)),
  );
  const approve = async (
    token: ContractKey,
    spender: ContractKey,
    amount?: string,
  ) =>
    send(token, token === "settlement" ? "approve" : "setApprovalForAll", [
      addresses[spender],
      token === "settlement" ? amount : true,
    ]);
  const createAsset = () =>
    run("Register asset", async () => {
      if (!form.name.trim()) throw new Error("Enter an asset name.");
      const lng = Number(form.lng),
        lat = Number(form.lat);
      if (
        !Number.isFinite(lng) ||
        !Number.isFinite(lat) ||
        lng < 138 ||
        lng > 141 ||
        lat < 34 ||
        lat > 37
      )
        throw new Error("Choose a location near Tokyo.");
      const meta = {
        name: form.name,
        district: form.district,
        coordinates: [lng, lat],
        area: Number(form.area),
        capacity: Number(form.capacity),
        description: form.terms,
        evidence: form.evidence,
        simulated: true,
      };
      const geo = keccak256(
        stringToHex(JSON.stringify({ coordinates: meta.coordinates })),
      );
      await send("registry", "registerAsset", [
        geo,
        metadataURI(meta),
        ["Rooftop", "Vacant Home", "Idle Land", "Other"].indexOf(form.kind),
      ]);
      setShowTokenize(false);
      setTab("Tokenize");
    });
  const createRight = (a: Asset) =>
    run("Issue right for verification", async () => {
      const start = Math.floor(new Date(form.start).getTime() / 1000),
        end = Math.floor(new Date(form.end).getTime() / 1000);
      if (
        !form.terms.trim() ||
        !/^\d+$/.test(form.supply) ||
        BigInt(form.supply) <= 0n ||
        BigInt(form.supply) > 1000000000000n ||
        end <= start
      )
        throw new Error("Check terms, positive supply and dates.");
      const terms = metadataURI({
        purpose: form.terms,
        evidence: form.evidence,
        simulated: true,
        permittedUse:
          form.right === "Usage Right"
            ? "As specified in purpose"
            : "Solar revenue distribution",
        repairConditions: "Issuer approval required for structural works.",
      });
      await send("rights", "createScopedRight", [
        [
          a.id,
          ["Usage Right", "Revenue Share", "Lease", "Other"].indexOf(
            form.right,
          ),
          form.supply,
          terms,
          keccak256(stringToHex(terms)),
          start,
          end,
          ["Open", "Allowlist", "Nontransferable"].indexOf(form.policy),
          ["Rooftop", "Interior", "Wall", "Land", "Whole asset"].indexOf(
            form.scope,
          ),
          keccak256(stringToHex(form.purpose)),
          form.right === "Revenue Share" ? false : form.exclusive === "Yes",
        ],
      ]);
    });
  const listRight = (token: "rights" | "basket", id: string) =>
    run("Create listing", async () => {
      if (!/^\d+$/.test(quantity) || BigInt(quantity) <= 0n)
        throw new Error("Enter a whole positive quantity.");
      const price = parseEther(listPrice);
      if (price <= 0n) throw new Error("Enter a positive price.");
      await approve(token, "market");
      await send("market", "createListing", [
        addresses[token],
        id,
        quantity,
        price.toString(),
      ]);
    });
  const history = state.events.filter(
    (e) =>
      String(e.args.assetId) === selected ||
      rights.some((r) => String(e.args.rightId) === r.id),
  );
  const field = (name: keyof typeof form, label: string, type = "text") => (
    <label>
      {label}
      <input
        type={type}
        value={form[name]}
        onChange={(e) => setForm({ ...form, [name]: e.target.value })}
      />
    </label>
  );
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="/">
          <span className="brand-mark">
            T<span>↗</span>
          </span>
          <span>
            TOKENIZE
            <br />
            <b>TOKYO</b>
          </span>
        </a>
        <div className="edition">
          URBAN ASSET PROTOCOL <span>01</span>
        </div>
        <nav>
          {[
            { name: "Explore", icon: MapPin },
            { name: "Portfolio", icon: Wallet },
            { name: "Compose", icon: Layers3 },
            { name: "Tokenize", icon: Plus },
            { name: "Activity", icon: Activity },
          ].map(({ name, icon: Icon }) => (
            <button
              key={name}
              className={tab === name ? "active" : ""}
              onClick={() => setTab(name)}
            >
              <Icon size={18} />
              {name}
              {name === "Compose" && <span className="nav-new">NEW</span>}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="city-symbol">東京</div>
          <p>
            More possibility.
            <br />
            In every square meter.
          </p>
          <div className="powered">
            <span className="curve-icon">◒</span>
            <span>
              Infrastructure by
              <br />
              <strong>Curvegrid MultiBaas</strong>
            </span>
          </div>
          <a
            href="https://github.com/curvegrid/multibaas-sdk-typescript"
            target="_blank"
            rel="noreferrer"
          >
            Open infrastructure <ArrowUpRight size={12} />
          </a>
        </div>
      </aside>
      <main>
        <header className="topbar">
          <div className="breadcrumb">
            TOKYO <span>/</span> {tab.toUpperCase()}{" "}
            <span className="network-dot" />
          </div>
          <div className="top-actions">
            <span className={"mode " + (DEMO ? "demo" : "")}>
              <span />
              {DEMO ? "SIMULATED DEMO" : "MULTIBAAS TESTNET"}
            </span>
            {DEMO ? (
              <label className="actor">
                <Wallet size={14} />
                <select
                  aria-label="Demo actor"
                  value={actor}
                  onChange={(e) =>
                    setActor(e.target.value as keyof typeof ACTORS)
                  }
                >
                  {Object.keys(ACTORS).map((a) => (
                    <option key={a}>{a}</option>
                  ))}
                </select>
                <ChevronDown size={12} />
              </label>
            ) : (
              <button className="wallet-button" onClick={connect}>
                <Wallet size={14} />
                {account ? short(account) : "Connect wallet"}
              </button>
            )}
          </div>
        </header>
        <div className="main-content">
          <section className="heading">
            <div>
              <div className="eyebrow">
                <span /> A CITY OF UNTAPPED POSSIBILITY
              </div>
              <h1>
                {tab === "Explore" ? (
                  <>
                    Put the city <em>to work.</em>
                  </>
                ) : tab === "Portfolio" ? (
                  <>
                    Your stake in <em>tomorrow.</em>
                  </>
                ) : tab === "Compose" ? (
                  <>
                    A whole greater <em>than its parts.</em>
                  </>
                ) : tab === "Tokenize" ? (
                  <>
                    What can your asset <em>provide?</em>
                  </>
                ) : (
                  <>
                    Every action. <em>Accounted for.</em>
                  </>
                )}
              </h1>
              <p>
                {tab === "Explore"
                  ? "Discover urban spaces. Fund new possibilities. Own the rights that bring them to life."
                  : tab === "Compose"
                    ? "Combine compatible solar revenue rights into one fully backed Tokyo Solar Basket."
                    : tab === "Portfolio"
                      ? "Urban rights, basket shares and revenue backed by actual deposits."
                      : tab === "Tokenize"
                        ? "Register a place, define its rights, and unlock its next chapter."
                        : "Follow the lifecycle from registration to productive capital."}
              </p>
            </div>
            <button
              className="primary"
              onClick={() => {
                setShowTokenize(true);
                setTab("Tokenize");
              }}
            >
              <Plus size={16} /> Tokenize an asset
            </button>
          </section>
          <div className="demo-note">
            <ShieldCheck size={14} />
            <span>
              Test assets only. Verification is simulated. Map data does not
              prove ownership. Mock JPY has no monetary value.
            </span>
            <button
              onClick={() =>
                run("Fund test wallet", () =>
                  send("settlement", "mint", [
                    active,
                    parseEther("1000000").toString(),
                  ]),
                )
              }
            >
              Test faucet <ArrowUpRight size={12} />
            </button>
          </div>
          {error && (
            <div className="feedback error" role="alert">
              {error}
              <button onClick={() => setError("")} aria-label="Dismiss error">
                <X size={16} />
              </button>
            </div>
          )}
          {(busy || notice) && (
            <div className="feedback" role="status">
              {busy ? (
                <>
                  <span className="spinner" />
                  {busy}… Confirm each transaction in your wallet.
                </>
              ) : (
                <>
                  <Check size={16} />
                  {notice}
                </>
              )}
              <button onClick={() => setNotice("")} aria-label="Dismiss notice">
                <X size={16} />
              </button>
            </div>
          )}
          <section className="metrics">
            <Metric
              label="ASSETS REGISTERED"
              value={String(state.assets.length)}
              note="Places with new potential"
              icon={<Building2 size={17} />}
            />
            <Metric
              label="ACTIVE LISTINGS"
              value={String(
                state.listings.filter(
                  (l) => !l.cancelled && BigInt(l.remaining) > 0n,
                ).length,
              )}
              note="Primary & secondary rights"
              icon={<Layers3 size={17} />}
            />
            <Metric
              label="TRADED VOLUME"
              value={money(state.metrics.volume)}
              suffix="mJPY"
              note="Settled marketplace payments"
              icon={<ArrowUpRight size={17} />}
            />
            <Metric
              label="REVENUE DEPOSITED"
              value={money(state.metrics.deposited)}
              suffix="mJPY"
              note="Actual deposits in live mode"
              icon={<Sun size={17} />}
            />
          </section>
          {tab === "Explore" && (
            <>
              <div className="section-row">
                <div className="segmented">
                  {["All assets", "Rooftop", "Vacant Home", "Idle Land"].map(
                    (k) => (
                      <button
                        className={kind === k ? "active" : ""}
                        key={k}
                        onClick={() => setKind(k)}
                      >
                        {k === "Rooftop" ? (
                          <Sun size={14} />
                        ) : k === "Vacant Home" ? (
                          <House size={14} />
                        ) : k === "All assets" ? (
                          <Layers3 size={14} />
                        ) : (
                          <MapPin size={14} />
                        )}{" "}
                        {k}
                      </button>
                    ),
                  )}
                </div>
                <select
                  className="stage-filter"
                  aria-label="Lifecycle filter"
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                >
                  {[
                    "All stages",
                    "Dormant",
                    "Available",
                    "Funding",
                    "Funded",
                    "Active",
                    "Secondary Market",
                  ].map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
                <button
                  className="icon-button"
                  aria-label="Refresh market"
                  onClick={() => void refresh()}
                >
                  <RefreshCw size={15} className={refreshing ? "spin" : ""} />
                </button>
              </div>
              <div className="explore-layout">
                <div className="map-wrap">
                  <TokyoMap
                    assets={filtered}
                    selected={selected}
                    onSelect={select}
                    highlighted={highlighted}
                    xray={xray}
                    dormant={DORMANT_SITES}
                    lens={lens}
                    lensKind={kind as LensKind}
                    onDormantSelect={openDormant}
                    activated={activeAssets.map((a) => a.id)}
                    scopes={state.rights}
                    onScope={(id, scope) => {
                      select(id);
                      setForm((f) => ({ ...f, scope }));
                    }}
                  />
                  <div className="map-top">
                    <span>
                      <span className="network-dot" /> LIVE CITY / DEMO ASSETS
                    </span>
                    <button
                      onClick={() =>
                        setHighlighted(state.assets.map((a) => a.id))
                      }
                    >
                      <Layers3 size={13} /> City overview
                    </button>
                  </div>
                  <div
                    className="lens-funnel"
                    aria-label="Dormant to activated"
                  >
                    <span>
                      <b>{DORMANT_SITES.length}</b> DORMANT
                    </span>
                    <ArrowRight size={11} />
                    <span>
                      <b>{state.assets.length}</b> TOKENIZED
                    </span>
                    <ArrowRight size={11} />
                    <span>
                      <b>{activatedCount}</b> ACTIVATED
                    </span>
                  </div>
                  <div className="map-lenses">
                    <button
                      className={xray ? "on" : ""}
                      onClick={() => {
                        setXray(!xray);
                        setLens(false);
                      }}
                    >
                      <Layers3 size={13} /> City X-ray
                    </button>
                    <button
                      className={"lens-toggle" + (lens ? " on" : "")}
                      aria-pressed={lens}
                      onClick={() => {
                        setLens(!lens);
                        setXray(false);
                      }}
                    >
                      <Sparkles size={13} /> Opportunity Lens
                    </button>
                    <button
                      className={ownedOnly ? "on" : ""}
                      onClick={() => setOwnedOnly(!ownedOnly)}
                    >
                      <Wallet size={13} /> My spaces
                    </button>
                    <button
                      onClick={() => {
                        setKind("Rooftop");
                        setStatus("Active");
                        setXray(true);
                        setLens(false);
                      }}
                    >
                      Active solar lens
                    </button>
                    {lens && (
                      <div className="lens-count" aria-live="polite">
                        <strong>
                          {dormantCount(kind)} dormant opportunities
                        </strong>
                        <span>
                          {kind === "All assets" ? "All kinds" : kind} ·{" "}
                          {DORMANT_DATASET_LABEL}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="map-stats">
                    <span>
                      <i className="green" /> Solar opportunity
                    </span>
                    <span>
                      <i className="amber" /> Community space
                    </span>
                  </div>
                </div>
                <aside className="asset-detail">
                  {asset ? (
                    <>
                      <div className="detail-art">
                        <div
                          className={
                            "mini-building " +
                            (asset.kind === "Vacant Home" ? "house" : "")
                          }
                        >
                          <span />
                          <span />
                          <span />
                          <span />
                          <span />
                          <span />
                        </div>
                        <span className="sim-badge">SIMULATED ASSET</span>
                        <div className="art-coords">
                          {asset.coordinates[1].toFixed(4)} N<br />
                          {asset.coordinates[0].toFixed(4)} E
                        </div>
                        <span className="art-number">
                          {asset.id.padStart(3, "0")}
                        </span>
                      </div>
                      <div className="detail-content">
                        <div className="detail-location">
                          <MapPin size={12} />
                          {asset.district}
                        </div>
                        <h2>{asset.name}</h2>
                        <div className="badges">
                          <span className="badge green">
                            <ShieldCheck size={11} />
                            {asset.status === "Verified"
                              ? "Demo verified"
                              : asset.status}
                          </span>
                          <span className="badge">{stage(asset)}</span>
                        </div>
                        <p className="description">{asset.description}</p>
                        <div className="right-explainer">
                          <span>WHAT YOU&apos;RE BUYING</span>
                          <h3>
                            {rights[0]?.kind === "Revenue Share" ? (
                              <Sun size={16} />
                            ) : (
                              <House size={16} />
                            )}{" "}
                            {rights[0]?.kind || "No right issued yet"}
                          </h3>
                          <p>
                            {rights[0]?.kind === "Revenue Share"
                              ? "A proportional share of revenue actually deposited by this solar project."
                              : "A time-limited right to use this space for the purpose defined in its terms."}
                          </p>
                        </div>
                        <div className="detail-facts">
                          <div>
                            <span>SPACE</span>
                            <b>
                              {asset.area} <small>m²</small>
                            </b>
                          </div>
                          <div>
                            <span>
                              {asset.kind === "Rooftop"
                                ? "EST. CAPACITY"
                                : "RIGHT TYPE"}
                            </span>
                            <b>
                              {asset.kind === "Rooftop" ? (
                                <>
                                  {asset.capacity} <small>kWp</small>
                                </>
                              ) : (
                                "Usage"
                              )}
                            </b>
                          </div>
                        </div>
                        {rights.map((r) => (
                          <details className="terms" key={r.id}>
                            <summary>
                              Terms, issuer & transfer policy{" "}
                              <ChevronDown size={12} />
                            </summary>
                            <p>
                              Issuer: {short(r.issuer)} · {r.policy}
                              <br />
                              Scope:{" "}
                              {
                                [
                                  "Rooftop",
                                  "Interior",
                                  "Wall",
                                  "Land",
                                  "Whole asset",
                                ][r.scope]
                              }{" "}
                              ·{" "}
                              {r.exclusive ? "Exclusive" : "Shared / financial"}
                              <br />
                              Supply: {r.supply} units
                              <br />
                              {new Date(
                                r.startAt * 1000,
                              ).toLocaleDateString()}{" "}
                              — {new Date(r.endAt * 1000).toLocaleDateString()}
                            </p>
                            <p>
                              {String(
                                parseMetadata(r.termsURI).purpose || r.termsURI,
                              )}
                            </p>
                            <p className="hash">Terms hash: {r.termsHash}</p>
                          </details>
                        ))}
                        {listings.length ? (
                          <>
                            <label className="terms-check">
                              <input
                                type="checkbox"
                                checked={termsAccepted}
                                onChange={(e) =>
                                  setTermsAccepted(e.target.checked)
                                }
                              />{" "}
                              I have reviewed the rights and their terms.
                            </label>
                            <label className="quantity">
                              Quantity
                              <input
                                aria-label="Purchase quantity"
                                type="number"
                                min="1"
                                step="1"
                                value={quantity}
                                onChange={(e) => setQuantity(e.target.value)}
                              />
                            </label>
                            {listings.map((l) => (
                              <div className="purchase" key={l.id}>
                                <div>
                                  <small>
                                    {same(
                                      l.seller,
                                      rights.find((r) => r.id === l.rightId)
                                        ?.issuer || "",
                                    )
                                      ? "PRIMARY OFFER"
                                      : "SECONDARY OFFER"}{" "}
                                    · {l.remaining} AVAILABLE
                                  </small>
                                  <strong>
                                    {money(l.unitPrice)}{" "}
                                    <span>mJPY / unit</span>
                                  </strong>
                                </div>
                                <button
                                  className="primary"
                                  disabled={
                                    !!busy ||
                                    !termsAccepted ||
                                    same(l.seller, active)
                                  }
                                  onClick={() =>
                                    run("Purchase rights", async () => {
                                      if (
                                        !/^\d+$/.test(quantity) ||
                                        BigInt(quantity) <= 0n ||
                                        BigInt(quantity) > BigInt(l.remaining)
                                      )
                                        throw new Error(
                                          "Enter a whole quantity within the available supply.",
                                        );
                                      await approve(
                                        "settlement",
                                        "market",
                                        (
                                          BigInt(quantity) * BigInt(l.unitPrice)
                                        ).toString(),
                                      );
                                      await send("market", "purchase", [
                                        l.id,
                                        quantity,
                                      ]);
                                    })
                                  }
                                >
                                  {same(l.seller, active)
                                    ? "Your listing"
                                    : "Acquire right"}
                                  <ArrowUpRight size={15} />
                                </button>
                              </div>
                            ))}
                          </>
                        ) : (
                          <div className="empty compact">
                            No verified rights currently listed.
                          </div>
                        )}
                        <details className="terms">
                          <summary>
                            Asset activity <Activity size={12} />
                          </summary>
                          {history
                            .slice(-6)
                            .reverse()
                            .map((e, i) => (
                              <p key={i}>
                                {e.name} · block {e.block}
                              </p>
                            ))}
                        </details>
                      </div>
                    </>
                  ) : (
                    <div className="empty">Register an asset to begin.</div>
                  )}
                </aside>
              </div>
              <section className="opportunity-section">
                <div className="section-title">
                  <h2>
                    Spaces with a next chapter
                    <span>{filtered.length.toString().padStart(2, "0")}</span>
                  </h2>
                  <span>
                    EXPLORE THE POSSIBILITIES <ArrowRight size={14} />
                  </span>
                </div>
                <div className="asset-grid">
                  {filtered.map((a) => (
                    <button
                      className={
                        "asset-card " + (a.id === selected ? "chosen" : "")
                      }
                      key={a.id}
                      onClick={() => select(a.id)}
                    >
                      <div className="card-icon">
                        {a.kind === "Rooftop" ? <Sun /> : <House />}
                      </div>
                      <div>
                        <span>{a.district}</span>
                        <h3>{a.name}</h3>
                        <p>
                          {a.kind} · {a.area} m² · Simulated
                        </p>
                      </div>
                      <ArrowUpRight size={18} />
                      <div className="card-bottom">
                        <span className="status-dot">{stage(a)}</span>
                        <b>
                          {listingFor(a)[0]
                            ? money(listingFor(a)[0].unitPrice) + " mJPY"
                            : "Awaiting listing"}
                        </b>
                      </div>
                    </button>
                  ))}
                </div>
              </section>
            </>
          )}
          {tab === "Portfolio" && (
            <section className="workspace">
              <div className="section-title">
                <h2>Your urban portfolio</h2>
                <span>
                  TEST BALANCE <b>{money(state.cash)} mJPY</b>
                </span>
              </div>
              <div className="portfolio-list">
                {[
                  ...state.rights.map((r) => ({
                    token: "rights" as const,
                    id: r.id,
                    name:
                      state.assets.find((a) => a.id === r.assetId)?.name ||
                      r.id,
                    kind: r.kind,
                  })),
                  ...state.baskets.map((b) => ({
                    token: "basket" as const,
                    id: b.id,
                    name: b.name,
                    kind: "Basket Shares",
                  })),
                ]
                  .filter(
                    (x) =>
                      BigInt(state.balances[x.token + ":" + x.id] || "0") >
                        0n ||
                      BigInt(state.claimable[x.token + ":" + x.id] || "0") > 0n,
                  )
                  .map((x) => (
                    <article className="holding" key={x.token + x.id}>
                      <div className="card-icon">
                        {x.token === "basket" ? <Layers3 /> : <Sun />}
                      </div>
                      <div>
                        <span>{x.kind}</span>
                        <h3>{x.name}</h3>
                        <p>
                          {state.balances[x.token + ":" + x.id] || "0"} units
                          held ·{" "}
                          {money(state.claimable[x.token + ":" + x.id] || "0")}{" "}
                          mJPY claimable
                        </p>
                      </div>
                      <div className="holding-actions">
                        <button
                          disabled={
                            !!busy ||
                            BigInt(
                              state.claimable[x.token + ":" + x.id] || "0",
                            ) === 0n
                          }
                          className="secondary"
                          onClick={() =>
                            run("Claim deposited revenue", () =>
                              send(
                                x.token === "rights" ? "revenue" : "basket",
                                x.token === "rights" ? "claim" : "claimRevenue",
                                [x.id],
                              ),
                            )
                          }
                        >
                          Claim revenue
                        </button>
                        <button
                          className="secondary"
                          disabled={!!busy}
                          onClick={() => listRight(x.token, x.id)}
                        >
                          List for resale
                        </button>
                        {x.token === "basket" && (
                          <button
                            className="secondary"
                            disabled={!!busy}
                            onClick={() =>
                              run("Redeem basket", () =>
                                send("basket", "redeem", [x.id, quantity]),
                              )
                            }
                          >
                            Redeem
                          </button>
                        )}
                      </div>
                    </article>
                  ))}
              </div>
              {!Object.values(state.balances).some((v) => BigInt(v) > 0n) && (
                <div className="empty">
                  <Wallet size={32} />
                  <h3>Your next chapter starts with one right.</h3>
                  <p>Explore the city and acquire a verified demo right.</p>
                  <button className="primary" onClick={() => setTab("Explore")}>
                    Explore opportunities <ArrowRight size={15} />
                  </button>
                </div>
              )}
              <div className="inline-fields">
                <label>
                  Resale / redeem quantity
                  <input
                    type="number"
                    min="1"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                  />
                </label>
                <label>
                  Resale price per unit (mJPY)
                  <input
                    type="number"
                    min="0.01"
                    value={listPrice}
                    onChange={(e) => setListPrice(e.target.value)}
                  />
                </label>
              </div>
              <h3>Your open listings</h3>
              {state.listings
                .filter(
                  (l) =>
                    same(l.seller, active) &&
                    !l.cancelled &&
                    BigInt(l.remaining) > 0n,
                )
                .map((l) => (
                  <div className="order" key={l.id}>
                    <span>
                      Listing {l.id} · {l.remaining} units ·{" "}
                      {money(l.unitPrice)} mJPY
                    </span>
                    <button
                      className="text-button"
                      disabled={!!busy}
                      onClick={() =>
                        run("Cancel listing", () =>
                          send("market", "cancelListing", [l.id]),
                        )
                      }
                    >
                      Cancel listing
                    </button>
                  </div>
                ))}
            </section>
          )}
          {tab === "Compose" && (
            <section className="compose-layout">
              <div className="workspace">
                <div className="eyebrow">FINANCIAL COMPOSABILITY</div>
                <h2>Tokyo Solar Basket</h2>
                <p className="description">
                  Many rooftops. One new possibility. Each basket share is
                  backed by one unit of every selected solar right, held in the
                  BasketVault.
                </p>
                <div className="compose-diagram">
                  <span>
                    <Sun />
                    Solar A
                  </span>
                  <i>+</i>
                  <span>
                    <Sun />
                    Solar B
                  </span>
                  <i>→</i>
                  <span className="basket-node">
                    <Layers3 />
                    TOKYO SOLAR
                    <br />
                    BASKET
                  </span>
                </div>
                <h3>01 / Choose your underlyings</h3>
                {compatible.length ? (
                  compatible.map((r) => (
                    <label className="underlying" key={r.id}>
                      <input
                        type="checkbox"
                        checked={compose.includes(r.id)}
                        onChange={(e) =>
                          setCompose(
                            e.target.checked
                              ? [...compose, r.id]
                              : compose.filter((id) => id !== r.id),
                          )
                        }
                      />
                      <Sun size={19} />
                      <span>
                        <b>
                          {state.assets.find((a) => a.id === r.assetId)?.name}
                        </b>
                        <small>
                          {state.balances["rights:" + r.id]} units · Open
                          transfer · Mock JPY
                        </small>
                      </span>
                    </label>
                  ))
                ) : (
                  <div className="empty compact">
                    Acquire at least two compatible solar rights to create a
                    basket. Rights already assigned to a basket can be deposited
                    into that existing basket.
                  </div>
                )}
                <h3>02 / Deposit and mint</h3>
                <label>
                  Basket shares to mint
                  <input
                    type="number"
                    min="1"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                  />
                </label>
                <button
                  className="primary wide"
                  disabled={!!busy || compose.length < 2}
                  onClick={() =>
                    run("Create basket", async () => {
                      await send("basket", "createBasket", [
                        compose,
                        compose.map(() => "1"),
                        metadataURI({
                          name: "Tokyo Solar Basket",
                          simulated: true,
                        }),
                      ]);
                      setCompose([]);
                    })
                  }
                >
                  Create basket definition <ArrowRight size={16} />
                </button>
                <p className="caption">
                  Then use “Deposit & mint” below. Shares are issued only when
                  every underlying is transferred into the vault.
                </p>
                <div className="callout">
                  <ShieldCheck size={18} />
                  <p>
                    Compatible revenue rights only. Same settlement token. Real
                    custody in live mode. Diversification does not guarantee
                    safety or liquidity.
                  </p>
                </div>
              </div>
              <div className="workspace">
                <h3>Basket pools</h3>
                {state.baskets.map((b) => (
                  <article className="basket-pool" key={b.id}>
                    <Layers3 size={30} />
                    <h2>
                      {b.name} #{b.id}
                    </h2>
                    <p>
                      {b.rightIds.length} rooftops ·{" "}
                      {b.units
                        .map((u, i) => u + " × Right " + b.rightIds[i])
                        .join(" + ")}
                    </p>
                    <button
                      className="primary"
                      disabled={!!busy}
                      onClick={() =>
                        run("Deposit underlying & mint basket", async () => {
                          await approve("rights", "basket");
                          await send("basket", "depositUnderlying", [
                            b.id,
                            quantity,
                          ]);
                          setHighlighted(
                            state.rights
                              .filter((r) => b.rightIds.includes(r.id))
                              .map((r) => r.assetId),
                          );
                        })
                      }
                    >
                      Deposit & mint <ArrowUpRight size={16} />
                    </button>
                    <button
                      className="secondary"
                      onClick={() => {
                        setHighlighted(
                          state.rights
                            .filter((r) => b.rightIds.includes(r.id))
                            .map((r) => r.assetId),
                        );
                        setTab("Explore");
                      }}
                    >
                      View underlying rooftops
                    </button>
                    <button
                      className="secondary"
                      onClick={() => listRight("basket", b.id)}
                      disabled={
                        !!busy ||
                        BigInt(state.balances["basket:" + b.id] || "0") === 0n
                      }
                    >
                      List basket shares
                    </button>
                  </article>
                ))}
                {!state.baskets.length && (
                  <div className="empty">
                    <Layers3 size={42} />
                    <h3>The city is your building block.</h3>
                    <p>Create the first fully backed solar basket.</p>
                  </div>
                )}
                {state.listings
                  .filter(
                    (l) =>
                      l.token === "basket" &&
                      !l.cancelled &&
                      BigInt(l.remaining) > 0n,
                  )
                  .map((l) => (
                    <div className="basket-pool" key={l.id}>
                      <h3>
                        Basket #{l.rightId} · {money(l.unitPrice)} mJPY
                      </h3>
                      <p>
                        {l.remaining} shares available. Review underlying rights
                        in the pool above.
                      </p>
                      <label className="terms-check">
                        <input
                          type="checkbox"
                          checked={termsAccepted}
                          onChange={(e) => setTermsAccepted(e.target.checked)}
                        />{" "}
                        I reviewed the basket and underlying terms.
                      </label>
                      <button
                        className="primary"
                        disabled={
                          !!busy || !termsAccepted || same(l.seller, active)
                        }
                        onClick={() =>
                          run("Purchase basket shares", async () => {
                            await approve(
                              "settlement",
                              "market",
                              (
                                BigInt(quantity) * BigInt(l.unitPrice)
                              ).toString(),
                            );
                            await send("market", "purchase", [l.id, quantity]);
                          })
                        }
                      >
                        Acquire basket shares
                      </button>
                    </div>
                  ))}
              </div>
            </section>
          )}
          {tab === "Tokenize" && (
            <section className="tokenize-layout">
              <div className="workspace">
                <div className="section-title">
                  <h2>From possibility to productive asset</h2>
                </div>
                <div className="callout">
                  <Layers3 size={18} />
                  <p>
                    Urban Rights Protocol: space × time × purpose. Overlapping
                    exclusive roof, interior, wall or land usage is rejected
                    on-chain. Revenue rights can coexist with solar usage.
                  </p>
                </div>
                <div className="flow-steps">
                  {[
                    "Register",
                    "Verify asset",
                    "Issue right",
                    "Verify right",
                    "List",
                    "Activate",
                  ].map((s, i) => (
                    <span key={s}>
                      <b>{String(i + 1).padStart(2, "0")}</b>
                      {s}
                    </span>
                  ))}
                </div>
                <p className="description">
                  Anyone can register. A demo verifier must approve both the
                  asset and its specific rights before a listing can go live.
                </p>
                <div className="form-grid">
                  {field("name", "Asset name")}
                  {field("district", "District")}
                  <label>
                    Asset type
                    <select
                      aria-label="Asset type"
                      value={form.kind}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          kind: e.target.value,
                          right:
                            e.target.value === "Vacant Home"
                              ? "Usage Right"
                              : "Revenue Share",
                          supply:
                            e.target.value === "Vacant Home" ? "1" : "100",
                        })
                      }
                    >
                      {["Rooftop", "Vacant Home", "Idle Land", "Other"].map(
                        (x) => (
                          <option key={x}>{x}</option>
                        ),
                      )}
                    </select>
                  </label>
                  <label>
                    Right type
                    <select
                      aria-label="Right type"
                      value={form.right}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          right: e.target.value,
                          supply:
                            e.target.value === "Revenue Share" ? "100" : "1",
                        })
                      }
                    >
                      {["Revenue Share", "Usage Right", "Lease", "Other"].map(
                        (x) => (
                          <option key={x}>{x}</option>
                        ),
                      )}
                    </select>
                  </label>
                  <label>
                    Spatial scope
                    <select
                      aria-label="Spatial scope"
                      value={form.scope}
                      onChange={(e) =>
                        setForm({ ...form, scope: e.target.value })
                      }
                    >
                      {[
                        "Rooftop",
                        "Interior",
                        "Wall",
                        "Land",
                        "Whole asset",
                      ].map((x) => (
                        <option key={x}>{x}</option>
                      ))}
                    </select>
                  </label>
                  {field("purpose", "Purpose (canonical label)")}
                  <label>
                    Exclusive usage
                    <select
                      aria-label="Exclusive usage"
                      value={form.exclusive}
                      onChange={(e) =>
                        setForm({ ...form, exclusive: e.target.value })
                      }
                    >
                      <option>Yes</option>
                      <option>No</option>
                    </select>
                  </label>
                  {field("lng", "Longitude", "number")}
                  {field("lat", "Latitude", "number")}
                  {field("area", "Area (m², simulated)", "number")}
                  {field("capacity", "Capacity (kWp, estimated)", "number")}
                  {field("supply", "Right supply", "number")}
                  {field("price", "Primary price (mJPY)", "number")}
                  {field("start", "Start date", "date")}
                  {field("end", "End date", "date")}
                  <label>
                    Transfer policy
                    <select
                      aria-label="Transfer policy"
                      value={form.policy}
                      onChange={(e) =>
                        setForm({ ...form, policy: e.target.value })
                      }
                    >
                      {["Open", "Allowlist", "Nontransferable"].map((x) => (
                        <option key={x}>{x}</option>
                      ))}
                    </select>
                  </label>
                  <label className="full">
                    Terms: use, duration, revenue, repairs
                    <textarea
                      value={form.terms}
                      onChange={(e) =>
                        setForm({ ...form, terms: e.target.value })
                      }
                    />
                  </label>
                  <label className="full">
                    Evidence / metadata reference
                    <textarea
                      value={form.evidence}
                      onChange={(e) =>
                        setForm({ ...form, evidence: e.target.value })
                      }
                    />
                  </label>
                </div>
                <button
                  className="primary wide"
                  disabled={!!busy}
                  onClick={createAsset}
                >
                  Register demo asset <ArrowRight size={16} />
                </button>
                <p className="caption">
                  The form above defines new rights when you click “Issue right”
                  on a verified asset below. The terms hash is fixed at
                  issuance.
                </p>
              </div>
              <div className="workspace">
                <h3>Owner & verifier workspace</h3>
                <p className="caption">
                  In demo mode, switch between Owner A and Demo verifier using
                  the wallet selector.
                </p>
                {state.assets
                  .filter((a) =>
                    DEMO
                      ? actor === "Demo verifier" || same(a.issuer, active)
                      : true,
                  )
                  .map((a) => (
                    <div className="workflow-card" key={a.id}>
                      <div className="section-row">
                        <h3>{a.name}</h3>
                        <span className="badge">{a.status}</span>
                      </div>
                      {a.status === "Draft" && same(a.issuer, active) && (
                        <button
                          disabled={!!busy}
                          className="secondary"
                          onClick={() =>
                            run("Submit for verification", () =>
                              send("registry", "requestVerification", [a.id]),
                            )
                          }
                        >
                          Submit for verification
                        </button>
                      )}
                      {a.status === "Pending verification" && (
                        <button
                          disabled={!!busy}
                          className="primary"
                          onClick={() =>
                            run("Verify asset", () =>
                              send("registry", "verifyAsset", [a.id, true]),
                            )
                          }
                        >
                          Demo verify asset
                        </button>
                      )}
                      {a.status === "Verified" && same(a.issuer, active) && (
                        <button
                          disabled={!!busy}
                          className="secondary"
                          onClick={() => createRight(a)}
                        >
                          Issue right from form terms
                        </button>
                      )}
                      {state.rights
                        .filter((r) => r.assetId === a.id)
                        .map((r) => (
                          <div className="right-row" key={r.id}>
                            <b>
                              {r.kind} #{r.id}
                            </b>
                            <span>
                              {r.status} · {r.supply} units
                            </span>
                            {r.status === "Pending verification" && (
                              <button
                                className="primary"
                                disabled={!!busy}
                                onClick={() =>
                                  run("Verify right", () =>
                                    send("rights", "verifyRight", [r.id, true]),
                                  )
                                }
                              >
                                Demo verify right
                              </button>
                            )}
                            {available(r) && same(r.issuer, active) && (
                              <button
                                className="secondary"
                                disabled={!!busy}
                                onClick={() =>
                                  run("Primary listing", async () => {
                                    await approve("rights", "market");
                                    await send("market", "createListing", [
                                      addresses.rights,
                                      r.id,
                                      r.supply,
                                      parseEther(form.price).toString(),
                                    ]);
                                  })
                                }
                              >
                                List at {form.price} mJPY
                              </button>
                            )}
                            {r.status === "Verified" && (
                              <button
                                className="secondary"
                                disabled={!!busy}
                                onClick={() =>
                                  run("Activate project", () =>
                                    send("rights", "activateRight", [r.id]),
                                  )
                                }
                              >
                                Activate project
                              </button>
                            )}
                            {r.status === "Active" &&
                              r.kind === "Revenue Share" && (
                                <button
                                  className="primary"
                                  disabled={!!busy}
                                  onClick={() =>
                                    run("Deposit project revenue", async () => {
                                      const amount =
                                        parseEther(deposit).toString();
                                      await approve(
                                        "settlement",
                                        "revenue",
                                        amount,
                                      );
                                      await send("revenue", "depositRevenue", [
                                        r.id,
                                        amount,
                                      ]);
                                    })
                                  }
                                >
                                  Deposit revenue
                                </button>
                              )}
                          </div>
                        ))}
                    </div>
                  ))}
                <label>
                  Revenue deposit amount (mJPY)
                  <input
                    type="number"
                    value={deposit}
                    onChange={(e) => setDeposit(e.target.value)}
                  />
                </label>
              </div>
            </section>
          )}
          {tab === "Activity" && (
            <section className="workspace">
              <div className="section-title">
                <h2>Urban activity ledger</h2>
                <span>
                  {DEMO ? "SIMULATED EVENTS" : "MULTIBAAS EVENT QUERIES"}
                </span>
              </div>
              <div className="activity-table">
                <div className="table-head">
                  <span>EVENT</span>
                  <span>REFERENCE</span>
                  <span>BLOCK</span>
                  <span>TRANSACTION</span>
                </div>
                {state.events
                  .slice()
                  .reverse()
                  .map((e, i) => (
                    <div className="table-row" key={e.txHash + e.name + i}>
                      <span>
                        <i className="green" />
                        {e.name}
                      </span>
                      <span>
                        {e.args.assetId
                          ? "Asset " + e.args.assetId
                          : e.args.rightId
                            ? "Right " + e.args.rightId
                            : e.args.basketId
                              ? "Basket " + e.args.basketId
                              : "Protocol"}
                      </span>
                      <span>{e.block}</span>
                      <span>{DEMO ? "Simulated" : short(e.txHash)}</span>
                    </div>
                  ))}
              </div>
              {!DEMO && (
                <a
                  className="text-button"
                  href={config.url}
                  target="_blank"
                  rel="noreferrer"
                >
                  Open MultiBaas Transaction Explorer <ExternalLink size={13} />
                </a>
              )}
            </section>
          )}
          <section className="impact">
            <div>
              <div className="eyebrow">
                <Leaf size={13} /> ACTIVATION, BEYOND TOKENIZATION
              </div>
              <h2>
                Capital is a beginning.
                <br />
                <em>A working city is the goal.</em>
              </h2>
            </div>
            <div className="impact-number">
              <strong>{activeAssets.length.toString().padStart(2, "0")}</strong>
              <span>ASSETS ACTIVATED</span>
            </div>
            <div className="impact-number">
              <strong>
                {activeAssets.reduce((n, a) => n + a.area, 0).toLocaleString()}
                <small>m²</small>
              </strong>
              <span>ACTIVE SPACE · SIMULATED</span>
            </div>
            <div className="impact-number">
              <strong>
                {activeAssets.reduce((n, a) => n + a.capacity, 0)}
                <small>kWp</small>
              </strong>
              <span>ESTIMATED SOLAR CAPACITY</span>
            </div>
          </section>
          <footer>
            <span>
              TOKENIZE TOKYO <b>© 2026</b>
            </span>
            <span>
              {DEMO
                ? "Demo simulation · no on-chain transactions"
                : "Data: MultiBaas Event Queries"}{" "}
              {lastSync && "· Updated " + lastSync}
            </span>
            {DEMO && (
              <button
                onClick={() => {
                  resetDemo();
                  setHighlighted([]);
                  void refresh();
                }}
              >
                Reset demo
              </button>
            )}
          </footer>
        </div>
      </main>
      {showTokenize && (
        <div className="modal-backdrop" onClick={() => setShowTokenize(false)}>
          <section
            className="location-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Select an asset location"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="section-title">
              <div>
                <span className="eyebrow">01 / SELECT YOUR SPACE</span>
                <h2>A new possibility starts here.</h2>
              </div>
              <button
                className="icon-button"
                onClick={() => setShowTokenize(false)}
                aria-label="Close location picker"
              >
                <X />
              </button>
            </div>
            <p>
              Click a location on the Tokyo map. Only simulated registration is
              supported in this prototype.
            </p>
            <TokyoMap
              assets={state.assets}
              onSelect={(id) => {
                const a = state.assets.find((a) => a.id === id);
                if (a)
                  setForm({
                    ...form,
                    lng: String(a.coordinates[0]),
                    lat: String(a.coordinates[1]),
                  });
              }}
              pick
              onPick={(p) =>
                setForm({ ...form, lng: String(p[0]), lat: String(p[1]) })
              }
            />
            <div className="section-row">
              <span>
                {form.lat} N / {form.lng} E
              </span>
              <button
                className="primary"
                onClick={() => setShowTokenize(false)}
              >
                Define the right <ArrowRight size={16} />
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
function Metric({
  label,
  value,
  note,
  suffix,
  icon,
}: {
  label: string;
  value: string;
  note: string;
  suffix?: string;
  icon: React.ReactNode;
}) {
  return (
    <article className="metric">
      <div>
        <span>{label}</span>
        {icon}
      </div>
      <strong>
        {value}
        <small>{suffix}</small>
      </strong>
      <p>{note}</p>
    </article>
  );
}
