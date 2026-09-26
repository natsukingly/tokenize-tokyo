"use client";
import BrandPlate, {
  BrandMark,
  BRAND_VARIANTS,
  type BrandVariant,
} from "./BrandPlate";
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
  Leaf,
  Menu,
  ExternalLink,
  Sparkles,
  BookOpen,
  Store,
  LayoutDashboard,
  PanelLeftClose,
  PanelLeftOpen,
  Info,
  Network,
} from "lucide-react";
import { formatEther, parseEther, keccak256, stringToHex } from "viem";
import { config, type ContractKey } from "@/lib/config";
import {
  ACTORS,
  DEMO_ADDRESSES,
  demoState,
  demoCall,
  resetDemo,
  addDemoActivity,
} from "@/lib/demo";
import {
  EMPTY,
  metadataURI,
  parseMetadata,
  short,
  type Asset,
  type MarketState,
  type Listing,
  type Right,
} from "@/lib/model";
import { assetStage } from "@/lib/lifecycle";
import { useTheme } from "@/lib/use-theme";
import {
  DORMANT_DATASET_LABEL,
  DORMANT_SITES,
  dormantCount,
  type DormantSite,
  type LensKind,
} from "@/lib/dormant";
import { loadMarket, readContract, sendViaMultiBaas } from "@/lib/multibaas";
import {
  WalletConnectionProvider,
  useWalletConnection,
} from "./WalletConnection";
import {
  isTxHash,
  transactionPhase,
  transactionUrl,
  walletError,
  type RecentTransaction,
  type TransactionProgress,
} from "@/lib/wallet";
import WalletPanel from "./WalletPanel";
import AccountGate from "./AccountGate";
import DataStatus from "./DataStatus";
import LoadingOverlay from "./LoadingOverlay";
import { BasketPoolCard, BasketOfferCard } from "./BasketCards";
import AssetIcon from "./AssetIcon";
import AssetDirectory, {
  DEFAULT_DIRECTORY_FILTERS,
  type DirectoryFilters,
} from "./AssetDirectory";
import FinanceMarkets, { type MarketView } from "./FinanceMarkets";
import { FundingProgress } from "./Launchpad";
import { fundingCampaigns, openFundingProjects } from "@/lib/funding";
import TokenizeFlow from "./TokenizeFlow";
import { suggestedProject, parseAssumptions } from "@/lib/project-plan";
import { compactMetadataURI } from "@/lib/model";
import { ProjectEconomics } from "./ProjectPlan";
import TokenizeDialog from "./TokenizeDialog";
import Tutorial from "./Tutorial";
import MarketOverview from "./MarketOverview";
import MapControls from "./MapControls";
import ActivityFeed from "./ActivityFeed";
import NamespaceDashboard from "./NamespaceDashboard";
import MapFunding from "./MapFunding";
import SpaceEnsPreview from "./SpaceEnsPreview";
import CardPaymentOption from "./CardPaymentOption";
import CityPreviewLink from "./CityPreviewLink";
import {
  ASSET_KINDS,
  SPACE_TYPES,
  defaultsForKind,
  assetTypeCode,
  type AssetKind,
} from "@/lib/catalog";
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
export default function Dashboard({
  demo = config.mode === "demo",
}: {
  demo?: boolean;
}) {
  return (
    <WalletConnectionProvider enabled={!demo}>
      <DashboardContent demo={demo} />
    </WalletConnectionProvider>
  );
}
function DashboardContent({ demo }: { demo: boolean }) {
  const DEMO = demo;
  const wallet = useWalletConnection();
  const account = wallet.account;
  const [walletOpen, setWalletOpen] = useState(false);
  const [walletTourContainer, setWalletTourContainer] =
    useState<HTMLDivElement | null>(null);
  const [walletGasBalance, setWalletGasBalance] = useState<string | null>(null);
  const [transaction, setTransaction] = useState<TransactionProgress | null>(
    null,
  );
  const [recentTransactions, setRecentTransactions] = useState<
    RecentTransaction[]
  >([]);
  const [verifierRoles, setVerifierRoles] = useState({
    registry: false,
    rights: false,
    account: "",
  });
  const actionLock = useRef(false);
  useEffect(() => {
    try {
      const saved = JSON.parse(
        localStorage.getItem("tokenize-tokyo:transactions") || "[]",
      );
      if (Array.isArray(saved))
        setRecentTransactions(
          saved
            .filter(
              (tx) =>
                isTxHash(tx.hash) &&
                typeof tx.label === "string" &&
                typeof tx.account === "string" &&
                tx.phase in transactionPhase,
            )
            .slice(0, 30),
        );
    } catch {
      /* A transaction can still be inspected without local history. */
    }
  }, []);
  useEffect(() => {
    setVerifierRoles({ registry: false, rights: false, account: "" });
    if (DEMO || !account) return;
    let cancelled = false;
    const role = keccak256(stringToHex("VERIFIER_ROLE"));
    Promise.all([
      readContract("registry", "hasRole", [role, account]),
      readContract("rights", "hasRole", [role, account]),
    ])
      .then(([registry, rights]) => {
        if (!cancelled)
          setVerifierRoles({
            registry: registry === true,
            rights: rights === true,
            account,
          });
      })
      .catch(() => {
        /* Fail closed: on-chain contracts remain the authority. */
      });
    return () => {
      cancelled = true;
    };
  }, [account, DEMO]);
  const { theme } = useTheme();
  // Logo lab switcher: open /?logo=stack|plate|grid|jp|bar|mono|terminal
  const [logoVariant, setLogoVariant] = useState<BrandVariant>("monow");
  useEffect(() => {
    const v = new URLSearchParams(window.location.search).get(
      "logo",
    ) as BrandVariant | null;
    if (v && BRAND_VARIANTS.includes(v)) setLogoVariant(v);
  }, []);

  const [state, setState] = useState<MarketState>(EMPTY),
    [tab, setTab] = useState("Explore"),
    [kind, setKind] = useState("All assets"),
    [status, setStatus] = useState("All stages"),
    [selected, setSelected] = useState("1"),
    [actor, setActor] = useState<keyof typeof ACTORS>("Investor B"),
    [busy, setBusy] = useState(""),
    [notice, setNotice] = useState(""),
    [error, setError] = useState(""),
    [showSpacePicker, setShowSpacePicker] = useState(false),
    [xray, setXray] = useState(false),
    [lens, setLens] = useState(false),
    [ownedOnly, setOwnedOnly] = useState(false),
    [refreshing, setRefreshing] = useState(false),
    [lastSync, setLastSync] = useState(""),
    [compose, setCompose] = useState<string[]>([]),
    [highlighted, setHighlighted] = useState<string[]>([]),
    [quantity, setQuantity] = useState("1"),
    [listPrice, setListPrice] = useState("2400"),
    [termsAccepted, setTermsAccepted] = useState(false);
  const [fundingOnly, setFundingOnly] = useState(false);
  const [ensSelection, setEnsSelection] = useState("");
  const [basketName, setBasketName] = useState("Tokyo Urban Income Basket");
  const [loadedAccount, setLoadedAccount] = useState<string | null>(null);
  const [marketLoaded, setMarketLoaded] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [foregroundRefresh, setForegroundRefresh] = useState(false);
  useEffect(() => {
    if (
      ["namespaces", "ens"].includes(
        new URLSearchParams(window.location.search).get("view") || "",
      )
    )
      setTab("Namespaces");
  }, []);
  const [tokenizeOpen, setTokenizeOpen] = useState(false);
  const [flowStarted, setFlowStarted] = useState(false);
  const [flowTarget, setFlowTarget] = useState("new");
  const [tutorialContainer, setTutorialContainer] =
    useState<HTMLDivElement | null>(null);
  const openTokenize = (fresh = false) => {
    if (fresh || !flowStarted) {
      setFlowTarget(
        fresh ? "new" : actor === "Demo verifier" ? selected : "new",
      );
      setCreatedGeo("");
      setFlowVersion((version) => version + 1);
      setFlowStarted(true);
    }
    setShowSpacePicker(false);
    setTokenizeOpen(true);
  };
  const closeTokenize = () => {
    setShowSpacePicker(false);
    setTokenizeOpen(false);
  };
  const [financeSource, setFinanceSource] = useState("");
  const [marketRequest, setMarketRequest] = useState(0);
  const [marketView, setMarketView] = useState<MarketView>("assets");
  const [directoryFilters, setDirectoryFilters] = useState<DirectoryFilters>(
    DEFAULT_DIRECTORY_FILTERS,
  );
  const [directorySelection, setDirectorySelection] = useState<string | null>(
    null,
  );
  const [cityFocus, setCityFocus] = useState(true);
  const [cityDetailsOpen, setCityDetailsOpen] = useState(false);
  const [sidebarExpanded, setSidebarExpanded] = useState(true);
  const [tutorialRequest, setTutorialRequest] = useState(0),
    [guideActive, setGuideActive] = useState(false),
    [flowVersion, setFlowVersion] = useState(0),
    [createdGeo, setCreatedGeo] = useState("");
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("tour") === "1")
      setTutorialRequest((n) => n + 1);
  }, []);
  const cityView = theme === "cyberpunk" && cityFocus && tab === "Explore";
  const openExplore = () => {
    setCityFocus(true);
    setTab("Explore");
  };
  const previousFilters = useRef(
    `${kind}|${status}|${ownedOnly}|${fundingOnly}`,
  );
  useEffect(() => {
    const next = `${kind}|${status}|${ownedOnly}|${fundingOnly}`;
    if (previousFilters.current === next) return;
    previousFilters.current = next;
    setSelected("");
    setCityDetailsOpen(false);
    setHighlighted([]);
    setTermsAccepted(false);
    setQuantity("1");
  }, [kind, status, ownedOnly, fundingOnly]);
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
    exclusive: "No",
    lng: "139.775",
    lat: "35.689",
    overview: suggestedProject("Rooftop", "").overview,
    analysis: JSON.stringify(suggestedProject("Rooftop", "").assumptions),
  });
  useEffect(() => {
    if (!DEMO)
      setState((previous) => ({
        ...previous,
        cash: "0",
        balances: {},
        claimable: {},
      }));
  }, [account, DEMO]);
  const active = DEMO ? ACTORS[actor] : account,
    addresses = DEMO ? DEMO_ADDRESSES : config.addresses;
  useEffect(() => {
    setLoadedAccount(null);
    setTermsAccepted(false);
    setCompose([]);
    setQuantity("1");
    setTransaction(null);
    setNotice("");
    setError("");
    setOwnedOnly(false);
  }, [active]);
  const accountReady = !!active && loadedAccount === active.toLowerCase();
  const activeRef = useRef(active);
  activeRef.current = active;
  const loading = useRef(false);
  const refreshPending = useRef(false);
  const refresh = useCallback(async (showFeedback = false) => {
    if (showFeedback) setForegroundRefresh(true);
    if (loading.current) {
      refreshPending.current = true;
      return;
    }
    const requestedAccount = activeRef.current;
    loading.current = true;
    setRefreshing(true);
    setLoadError("");
    try {
      const s = DEMO
        ? demoState(activeRef.current)
        : await loadMarket(activeRef.current || undefined);
      if (requestedAccount === activeRef.current) {
        setState(s);
        setMarketLoaded(true);
        setLoadedAccount(requestedAccount.toLowerCase());
      } else refreshPending.current = true;
      setLastSync(new Date().toLocaleTimeString());
    } catch (e) {
      setLoadError(
        "Check your connection and try again. Previously loaded data is kept until an update succeeds.",
      );
    } finally {
      loading.current = false;
      if (refreshPending.current) {
        refreshPending.current = false;
        setTimeout(() => void refresh(), 0);
      } else {
        setRefreshing(false);
        setForegroundRefresh(false);
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
  const connect = () => setWalletOpen(true);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("view") === "dashboard") {
      setTab("Explore");
      setCityFocus(false);
    }
    if (DEMO && params.get("sample") === "1") {
      addDemoActivity();
      void refresh();
    }
  }, [DEMO, refresh]);
  const send = async (
    contract: ContractKey,
    method: string,
    args: unknown[] = [],
  ) => {
    if (!active) {
      setWalletOpen(true);
      throw new Error("Connect your wallet first.");
    }
    if (DEMO) return demoCall(active, contract, method, args);
    const p = wallet.provider;
    if (!p) throw new Error("Browser wallet unavailable");
    return sendViaMultiBaas(p, active, contract, method, args, (progress) => {
      if (activeRef.current === active) setTransaction(progress);
      if (progress.hash) {
        const entry: RecentTransaction = {
          ...progress,
          hash: progress.hash,
          label: `${method} · ${contract}`,
          account: active,
          chainId: config.chainId,
          createdAt: Date.now(),
        };
        setRecentTransactions((previous) => {
          const next = [
            entry,
            ...previous.filter((tx) => tx.hash !== entry.hash),
          ].slice(0, 30);
          try {
            localStorage.setItem(
              "tokenize-tokyo:transactions",
              JSON.stringify(next),
            );
          } catch {}
          return next;
        });
      }
    });
  };
  const run = async (label: string, work: () => Promise<unknown>) => {
    if (actionLock.current) return false;
    actionLock.current = true;
    setTransaction(null);
    setBusy(label);
    setError("");
    setNotice("");
    const requestedAccount = activeRef.current;
    try {
      await work();
      if (activeRef.current === requestedAccount)
        setNotice(
          DEMO
            ? label + " · simulated successfully"
            : label + " · confirmed. Waiting for the MultiBaas index.",
        );
      await refresh();
      return true;
    } catch (e) {
      if (activeRef.current === requestedAccount) setError(walletError(e));
      return false;
    } finally {
      actionLock.current = false;
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
  const campaigns = fundingCampaigns(state);
  const openProjects = openFundingProjects(campaigns);
  const fundingIds = new Set(openProjects.map((c) => c.asset.id));
  const baseFiltered = assets.filter(
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
  const filtered = fundingOnly
    ? baseFiltered.filter((a) => fundingIds.has(a.id))
    : baseFiltered;
  const visibleProjects = openProjects.filter((c) =>
    baseFiltered.some((a) => a.id === c.asset.id),
  );
  const viewAssetOnMap = (id: string) => {
    setFundingOnly(false);
    setKind("All assets");
    setStatus("All stages");
    setOwnedOnly(false);
    setLens(false);
    setHighlighted([]);
    setDirectorySelection(id);
    openExplore();
  };
  const asset = state.assets.find((a) => a.id === selected),
    rights = state.rights.filter((r) => r.assetId === selected),
    listings = asset ? listingFor(asset) : [];
  const select = useCallback((id: string) => {
    setSelected(id);
    setCityDetailsOpen(true);
    setTermsAccepted(false);
    setQuantity("1");
  }, []);
  // Open details after the map filters reset, so their close effect cannot hide it.
  useEffect(() => {
    if (tab !== "Explore" || directorySelection === null) return;
    select(directorySelection);
    setDirectorySelection(null);
  }, [tab, directorySelection, select]);
  const activeAssets = state.assets.filter((a) => stage(a) === "Active");
  const activatedCount = state.assets.filter((a) =>
    state.rights.some((r) => r.assetId === a.id && r.status === "Active"),
  ).length;
  const openDormant = (site: DormantSite) => {
    setForm((f) => ({
      ...f,
      ...defaultsForKind(site.kind),
      name: site.name,
      district: site.district,
      kind: site.kind,
      area: String(site.area),
      capacity: String(site.capacity),
      lng: String(site.coordinates[0]),
      lat: String(site.coordinates[1]),
      overview: suggestedProject(site.kind, site.name).overview,
      analysis: JSON.stringify(
        suggestedProject(site.kind, site.name).assumptions,
      ),
    }));
    setShowSpacePicker(false);
    setCreatedGeo("");
    setFlowVersion((v) => v + 1);
    setFlowTarget("new");
    setFlowStarted(true);
    setTokenizeOpen(true);
  };
  const compatible = state.rights.filter(
    (r) =>
      accountReady &&
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
  const purchaseListing = (
    listing: Listing,
    amount: string,
    accepted: boolean,
  ) =>
    run("Purchase rights", async () => {
      if (!active || !accountReady)
        throw new Error("Wait for your wallet balances to load.");
      if (!accepted)
        throw new Error("Review and accept the right’s terms first.");
      const current = state.listings.find((item) => item.id === listing.id);
      const right = state.rights.find((item) => item.id === listing.rightId);
      if (
        !current ||
        current.cancelled ||
        current.unitPrice !== listing.unitPrice ||
        current.token !== "rights" ||
        !right ||
        !available(right) ||
        same(current.seller, active)
      )
        throw new Error("This offer is no longer available to your wallet.");
      if (
        !/^[1-9]\d{0,11}$/.test(amount) ||
        BigInt(amount) > BigInt(current.remaining)
      )
        throw new Error("Enter a whole quantity within the available supply.");
      await approve(
        "settlement",
        "market",
        (BigInt(amount) * BigInt(current.unitPrice)).toString(),
      );
      if (activeRef.current !== active)
        throw new Error("Wallet changed. Review this purchase again.");
      await send("market", "purchase", [current.id, amount]);
    });
  const canVerifyAsset = DEMO
    ? actor === "Demo verifier"
    : same(verifierRoles.account, active) && verifierRoles.registry;
  const canVerifyRight = DEMO
    ? actor === "Demo verifier"
    : same(verifierRoles.account, active) && verifierRoles.rights;
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
        kind: form.kind,
        district: form.district,
        coordinates: [lng, lat],
        area: Number(form.area),
        capacity: Number(form.capacity),
        description: form.overview.trim() || form.terms,
        projectAssumptions: (() => {
          try {
            return parseAssumptions(JSON.parse(form.analysis));
          } catch {
            return null;
          }
        })(),
        planningBasis:
          "Illustrative AI-authored draft, edited by issuer; not a site appraisal or market forecast.",
        evidence: form.evidence,
        simulated: true,
      };
      const geo = keccak256(
        stringToHex(JSON.stringify({ coordinates: meta.coordinates })),
      );
      const uri = compactMetadataURI(meta);
      if (new TextEncoder().encode(uri).length > 4096)
        throw new Error(
          "Project details exceed this deployment’s 4 KB inline limit. Shorten the description or evidence reference before registering.",
        );
      await send("registry", "registerAsset", [
        geo,
        uri,
        assetTypeCode(form.kind),
      ]);
      setCreatedGeo(geo);
      setShowSpacePicker(false);
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
        permittedUse: form.purpose,
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
  const walletControl = DEMO ? (
    <label
      className="actor"
      title="Switch demo roles; no real wallet is connected"
    >
      <Wallet size={14} aria-hidden="true" />
      <span className="actor-label">Demo role</span>
      <select
        aria-label="Demo role"
        value={actor}
        onChange={(e) => setActor(e.target.value as keyof typeof ACTORS)}
      >
        {Object.keys(ACTORS).map((a) => (
          <option key={a}>{a}</option>
        ))}
      </select>
      <ChevronDown size={12} aria-hidden="true" />
    </label>
  ) : (
    <button className="wallet-button" onClick={connect} aria-haspopup="dialog">
      <Wallet size={14} />
      {account ? short(account) : "Connect wallet"}
    </button>
  );
  const feedback = (
    <>
      {error && (
        <div className="feedback error" role="alert">
          {error}
          <button onClick={() => setError("")} aria-label="Dismiss error">
            <X size={16} />
          </button>
        </div>
      )}
      {(busy || notice || transaction?.hash) && (
        <div className="feedback" role="status">
          {busy ? (
            <>
              <span className="spinner" />
              {DEMO
                ? `${busy}…`
                : `${busy} · ${transaction ? transactionPhase[transaction.phase] : "Preparing"}`}
            </>
          ) : (
            <>
              <Check size={16} />
              {notice ||
                (transaction ? transactionPhase[transaction.phase] : "")}
            </>
          )}
          {!DEMO && transaction?.hash && (
            <a
              className="transaction-link"
              href={transactionUrl(transaction.hash)}
              target="_blank"
              rel="noreferrer"
            >
              View transaction <ArrowUpRight size={14} />
            </a>
          )}
          <button
            onClick={() => {
              setNotice("");
              if (!busy) setTransaction(null);
            }}
            aria-label="Dismiss notice"
          >
            <X size={16} />
          </button>
        </div>
      )}
    </>
  );
  const activeNavigation = tab === "Explore" && !cityFocus ? "Dashboard" : tab;
  const navigationLabel =
    activeNavigation === "Portfolio"
      ? "My assets"
      : activeNavigation === "Namespaces"
        ? "ENS Index"
        : activeNavigation;
  const mapFilters = (
    <div className="section-row explore-filters">
      <div
        className="segmented asset-type-options"
        role="group"
        aria-label="Asset type filter"
      >
        {["All assets", ...ASSET_KINDS].map((k) => (
          <button
            className={kind === k ? "active" : ""}
            aria-pressed={kind === k}
            key={k}
            onClick={() => setKind(k)}
          >
            {k === "All assets" ? (
              <Layers3 size={14} />
            ) : (
              <AssetIcon kind={k as AssetKind} size={14} />
            )}{" "}
            {k}
          </button>
        ))}
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
      <div className="filter-actions">
        <button
          className="text-button reset-map-filters"
          disabled={
            kind === "All assets" &&
            status === "All stages" &&
            !ownedOnly &&
            !fundingOnly
          }
          onClick={() => {
            setKind("All assets");
            setStatus("All stages");
            setOwnedOnly(false);
            setFundingOnly(false);
          }}
        >
          <X size={13} />
          Reset filters
        </button>
        <button
          className="icon-button"
          aria-label="Refresh market"
          disabled={refreshing}
          onClick={() => void refresh(true)}
        >
          <RefreshCw size={15} className={refreshing ? "spin" : ""} />
        </button>
      </div>
    </div>
  );
  const mapTools = (
    <div className="map-lenses">
      <button
        className={xray ? "on" : ""}
        aria-pressed={xray}
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
        aria-pressed={ownedOnly}
        onClick={() => {
          if (!active) connect();
          else setOwnedOnly(!ownedOnly);
        }}
      >
        <Wallet size={13} /> My spaces
      </button>
      {lens && (
        <div className="lens-count" aria-live="polite">
          <strong>{dormantCount(kind)} dormant opportunities</strong>
          <span>
            {kind === "All assets" ? "All kinds" : kind} ·{" "}
            {DORMANT_DATASET_LABEL}
          </span>
        </div>
      )}
    </div>
  );
  return (
    <div
      className={
        "app-shell" +
        (cityView ? " city-view" : "") +
        (sidebarExpanded ? " city-sidebar-expanded" : "") +
        (cityDetailsOpen ? " city-details-open" : "")
      }
    >
      <LoadingOverlay
        active={(!marketLoaded && !loadError) || foregroundRefresh || !!busy}
        title={
          busy || (marketLoaded ? "Updating market data…" : "Loading Tokyo…")
        }
        detail={
          busy
            ? transaction
              ? transaction.phase === "confirmed"
                ? "Updating your assets from the latest onchain activity."
                : transactionPhase[transaction.phase]
              : "Preparing your action…"
            : "Fetching assets, listings and onchain activity."
        }
      />
      <aside className="sidebar" id="app-sidebar">
        <a className="brand" href="/" aria-label="TOKENIZE TOKYO">
          <BrandPlate
            className="brand-cyberpunk"
            width={190}
            variant={logoVariant}
          />
          <BrandMark
            className="brand-compact"
            size={32}
            variant={logoVariant}
          />
          <span className="brand-mark">
            T<span>↗</span>
          </span>
          <span className="brand-original-text">
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
            {
              label: "Platform",
              items: [
                { name: "Explore", icon: MapPin },
                { name: "Dashboard", icon: LayoutDashboard },
                { name: "Markets", icon: Store },
                { name: "Namespaces", icon: Network },
                { name: "Activity", icon: Activity },
              ],
            },
            {
              label: "My workspace",
              items: [
                { name: "Portfolio", icon: Wallet },
                { name: "Compose", icon: Layers3 },
              ],
            },
          ].map(({ label, items }) => (
            <div
              className="nav-group"
              role="group"
              aria-label={label}
              key={label}
            >
              <span className="nav-group-label">{label}</span>
              {items.map(({ name, icon: Icon }) => (
                <button
                  key={name}
                  className={activeNavigation === name ? "active" : ""}
                  aria-current={activeNavigation === name ? "page" : undefined}
                  title={
                    name === "Portfolio"
                      ? "My assets"
                      : name === "Namespaces"
                        ? "ENS Index"
                        : name
                  }
                  onClick={() => {
                    if (name === "Dashboard" || name === "Explore") {
                      setCityFocus(name === "Explore");
                      setTab("Explore");
                    } else {
                      if (name === "Markets") {
                        setFinanceSource("");
                        setMarketView("assets");
                      }
                      setTab(name);
                    }
                  }}
                >
                  <Icon size={18} />
                  {name === "Portfolio"
                    ? "My assets"
                    : name === "Namespaces"
                      ? "ENS Index"
                      : name}
                  {name === "Compose" && <span className="nav-new">NEW</span>}
                </button>
              ))}
            </div>
          ))}
          <CityPreviewLink />
          <button
            className="guide-entry"
            title="Quick tour"
            onClick={() => setTutorialRequest((n) => n + 1)}
          >
            <BookOpen size={18} />
            Quick tour
          </button>
        </nav>
        <div className="sidebar-bottom">
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
          {cityView && (
            <button
              className="sidebar-toggle icon-button"
              aria-label="Toggle sidebar"
              aria-expanded={sidebarExpanded}
              aria-controls="app-sidebar"
              title={sidebarExpanded ? "Collapse sidebar" : "Expand sidebar"}
              onClick={() => setSidebarExpanded(!sidebarExpanded)}
            >
              {sidebarExpanded ? (
                <PanelLeftClose size={18} />
              ) : (
                <PanelLeftOpen size={18} />
              )}
            </button>
          )}
          <a
            className="city-brand"
            href={DEMO ? "/demo?theme=cyberpunk" : "/?theme=cyberpunk"}
            aria-label="TOKENIZE TOKYO"
          >
            <BrandPlate width={190} variant={logoVariant} />
          </a>
          <div className="breadcrumb">
            TOKYO <span>/</span> {navigationLabel.toUpperCase()}
          </div>
          <div className="top-actions">
            <span className={"mode " + (DEMO ? "demo" : "")}>
              <span />
              {DEMO
                ? "SIMULATED DEMO"
                : config.chainId === 11155111
                  ? "SEPOLIA TESTNET"
                  : config.chainId === 31337
                    ? "LOCAL ANVIL"
                    : config.chainId === 2017072401
                      ? "CURVEGRID TESTNET"
                      : `TESTNET ${config.chainId}`}
            </span>
            {marketLoaded && refreshing && (
              <span className="data-refresh" role="status">
                <RefreshCw size={14} className="spin" /> Updating
              </span>
            )}
            {!tokenizeOpen && walletControl}
            <button
              className="primary header-tokenize"
              aria-label="Tokenize a space"
              aria-haspopup="dialog"
              title="Tokenize a space"
              disabled={!marketLoaded}
              onClick={() => openTokenize()}
            >
              <Plus size={16} /> <span>Tokenize</span>
            </button>
          </div>
        </header>
        <div
          className={
            "main-content" + (tab === "Tokenize" ? " focused-page" : "")
          }
        >
          <Tutorial
            container={
              walletOpen
                ? walletTourContainer
                : tokenizeOpen
                  ? tutorialContainer
                  : null
            }
            request={tutorialRequest}
            state={state}
            hasSelectedSpace={!!asset && (!cityView || cityDetailsOpen)}
            hasOpenOffer={listings.length > 0}
            account={DEMO ? active : account}
            chainId={wallet.chainId}
            gasBalance={walletGasBalance}
            transactions={recentTransactions}
            demo={DEMO}
            onActive={setGuideActive}
            onActor={(name) => setActor(name as keyof typeof ACTORS)}
            onNavigate={(next) => {
              if (next === "Wallet") {
                setWalletOpen(true);
                return;
              }
              setWalletOpen(false);
              if (next === "Funding") {
                closeTokenize();
                setFinanceSource("");
                setMarketView("funding");
                setMarketRequest((n) => n + 1);
                setTab("Markets");
                return;
              }
              if (next === "Owner workspace") {
                if (!flowStarted) openTokenize(true);
                else setTokenizeOpen(true);
                return;
              }
              if (next === "Inspect right") {
                openExplore();
                setCityDetailsOpen(true);
                document
                  .querySelectorAll('[aria-label="Map controls"] details[open]')
                  .forEach((item) => item.removeAttribute("open"));
                return;
              }
              if (next === "Tokenize") openTokenize(true);
              else {
                closeTokenize();
                if (next === "Explore") openExplore();
                else setTab(next);
              }
              setKind("All assets");
              setStatus("All stages");
              setOwnedOnly(false);
            }}
          />

          <h1 className="sr-only">{navigationLabel}</h1>
          {activeNavigation === "Dashboard" && (
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
          )}
          {!tokenizeOpen && feedback}
          {!marketLoaded &&
            activeNavigation !== "Explore" &&
            activeNavigation !== "Portfolio" && (
              <DataStatus
                error={loadError}
                onRetry={() => void refresh(true)}
              />
            )}
          {marketLoaded && loadError && (
            <div className="sample-activity" role="status">
              <p>Update unavailable. Showing the last loaded data.</p>
              <button className="secondary" onClick={() => void refresh(true)}>
                Retry update
              </button>
            </div>
          )}
          {activeNavigation === "Dashboard" && DEMO && (
            <div className="sample-activity">
              <div>
                <b>Example market activity</b>
                <p>
                  Load 28 days of fictional purchases, resales, income deposits,
                  and a mixed-asset basket. Your existing demo work is kept.
                </p>
              </div>
              {state.baskets.some(
                (b) => b.name === "Tokyo Mixed Income Basket · Example",
              ) ? (
                <button
                  className="secondary"
                  onClick={() => {
                    setActor("Investor C");
                    setTab("Portfolio");
                  }}
                >
                  View sample holdings
                </button>
              ) : (
                <button
                  className="secondary"
                  disabled={!!busy}
                  onClick={() =>
                    run("Load example activity", async () => {
                      addDemoActivity();
                    })
                  }
                >
                  Load example activity
                </button>
              )}
            </div>
          )}
          {marketLoaded && tab === "Explore" && !cityFocus && !guideActive && (
            <MarketOverview
              state={state}
              rightsAddress={addresses.rights}
              demo={DEMO}
              onFilter={(value) => {
                setKind(value);
                setStatus("All stages");
                setOwnedOnly(false);
                setCityFocus(true);
              }}
              onReview={() => openTokenize()}
              onFunded={() => {
                setKind("All assets");
                setStatus("Funded");
                setOwnedOnly(false);
                setCityFocus(true);
              }}
            />
          )}
          {tab === "Explore" && cityFocus && (
            <>
              {cityView ? (
                <MapControls
                  funding={{
                    count: visibleProjects.length,
                    active: fundingOnly,
                    loading: !marketLoaded,
                    onToggle: () => {
                      setFundingOnly((v) => !v);
                      setLens(false);
                    },
                    content: (
                      <MapFunding
                        projects={visibleProjects}
                        onView={viewAssetOnMap}
                      />
                    ),
                  }}
                  filters={mapFilters}
                  tools={mapTools}
                  filterLabel={[
                    !marketLoaded
                      ? "Loading spaces…"
                      : kind !== "All assets" ||
                          status !== "All stages" ||
                          ownedOnly ||
                          fundingOnly
                        ? `${filtered.length} matching spaces`
                        : "",
                    kind !== "All assets" ? kind : "",
                    status !== "All stages" ? status : "",
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                  toolLabel={[
                    xray ? "X-ray" : "",
                    lens ? "Opportunity Lens" : "",
                    ownedOnly ? "My spaces" : "",
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                />
              ) : (
                mapFilters
              )}
              <div className="explore-layout">
                <div className="map-wrap">
                  <TokyoMap
                    theme={theme}
                    assets={filtered}
                    selected={
                      cityView && !cityDetailsOpen ? undefined : selected
                    }
                    filterActive={
                      kind !== "All assets" ||
                      status !== "All stages" ||
                      ownedOnly ||
                      fundingOnly
                    }
                    fundingProjects={openProjects.map((c) => ({
                      assetId: c.asset.id,
                      percent: c.percent,
                    }))}
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
                  {!marketLoaded && (
                    <DataStatus
                      compact
                      error={loadError}
                      onRetry={() => void refresh()}
                    />
                  )}
                  {marketLoaded && (
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
                  )}
                  {!cityView && mapTools}
                  <div className="map-stats">
                    <span>
                      <i className="green" /> Revenue opportunity
                    </span>
                    <span>
                      <i className="amber" /> Usage opportunity
                    </span>
                  </div>
                  <details className="city-map-info">
                    <summary aria-label="About this map" title="About this map">
                      <Info size={16} />
                    </summary>
                    <div>
                      <strong>About this map</strong>
                      <p>
                        Test assets only. Verification, highlighted spaces and
                        dimensions are simulated. Map data does not prove
                        property ownership.
                      </p>
                      <p>
                        3D basemap: OpenStreetMap / OpenFreeMap. Mock JPY has no
                        monetary value.
                      </p>
                    </div>
                  </details>
                </div>
                <aside className="asset-detail" id="asset-detail-panel">
                  <div className="city-detail-heading">
                    <span>THE SPACE & THE RIGHT</span>
                    <button
                      aria-label="Close asset details"
                      onClick={() => setCityDetailsOpen(false)}
                    >
                      <X size={18} />
                    </button>
                  </div>
                  {asset ? (
                    <>
                      <div className="detail-art">
                        {theme === "cyberpunk" ? (
                          <div className="asset-space-summary">
                            <div className="asset-space-icon">
                              <AssetIcon kind={asset.kind} size={24} />
                            </div>
                            <div>
                              <strong>{asset.kind}</strong>
                              <span>
                                {asset.area.toLocaleString()} m² · Demo space
                              </span>
                            </div>
                          </div>
                        ) : (
                          <>
                            {asset.kind === "Rooftop" ? (
                              <div className="mini-building">
                                <span />
                                <span />
                                <span />
                                <span />
                                <span />
                                <span />
                              </div>
                            ) : (
                              <div
                                className="space-illustration"
                                style={{ color: SPACE_TYPES[asset.kind].color }}
                              >
                                <AssetIcon kind={asset.kind} size={46} />
                                <strong>{asset.kind}</strong>
                              </div>
                            )}
                            <span className="sim-badge">SIMULATED ASSET</span>
                            <div className="art-coords">
                              {asset.coordinates[1].toFixed(4)} N<br />
                              {asset.coordinates[0].toFixed(4)} E
                            </div>
                            <span className="art-number">
                              {asset.id.padStart(3, "0")}
                            </span>
                          </>
                        )}
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
                        <section
                          className="asset-overview"
                          aria-label="About this space"
                        >
                          <h3>ABOUT THIS SPACE</h3>
                          <p
                            className="description"
                            style={{ whiteSpace: "pre-line" }}
                          >
                            {asset.description}
                          </p>
                          {(() => {
                            const a = parseAssumptions(
                              parseMetadata(asset.metadataURI)
                                .projectAssumptions,
                            );
                            return a ? (
                              <details className="wizard-details">
                                <summary>
                                  Project economics · illustrative scenarios
                                </summary>
                                <ProjectEconomics assumptions={a} />
                              </details>
                            ) : null;
                          })()}
                        </section>
                        <SpaceEnsPreview
                          demo={DEMO}
                          asset={asset}
                          rights={rights}
                          onInspect={(name) => {
                            setEnsSelection(name);
                            setTab("Namespaces");
                          }}
                        />
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
                              ? "A proportional share of revenue actually deposited by this project."
                              : SPACE_TYPES[asset.kind].terms}
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
                              ) : rights[0]?.kind === "Revenue Share" ? (
                                "Income"
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
                        {campaigns
                          .filter(
                            (c) =>
                              c.asset.id === asset.id && !c.listing.cancelled,
                          )
                          .map((c) => (
                            <FundingProgress key={c.listing.id} campaign={c} />
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
                                <CardPaymentOption
                                  listing={l}
                                  quantity={quantity}
                                  account={active}
                                  accepted={termsAccepted}
                                  demo={DEMO}
                                  busy={!!busy}
                                  onConnect={connect}
                                >
                                  <button
                                    className="primary"
                                    disabled={
                                      !!busy ||
                                      (!!active && !termsAccepted) ||
                                      same(l.seller, active)
                                    }
                                    onClick={() => {
                                      if (!active) return connect();
                                      return purchaseListing(
                                        l,
                                        quantity,
                                        termsAccepted,
                                      );
                                    }}
                                  >
                                    {!active
                                      ? "Connect wallet to buy"
                                      : same(l.seller, active)
                                        ? "Your listing"
                                        : "Acquire right"}
                                    <ArrowUpRight size={15} />
                                  </button>
                                </CardPaymentOption>
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
                                {!DEMO && isTxHash(e.txHash) ? (
                                  <a
                                    href={transactionUrl(e.txHash)}
                                    target="_blank"
                                    rel="noreferrer"
                                  >
                                    {e.name} · block {e.block} ↗
                                  </a>
                                ) : (
                                  <>
                                    {e.name} · block {e.block}
                                  </>
                                )}
                              </p>
                            ))}
                        </details>
                      </div>
                    </>
                  ) : (
                    <div className="empty">
                      {marketLoaded
                        ? "Select a space on the map to see its rights."
                        : "Loading spaces…"}
                    </div>
                  )}
                </aside>
              </div>
            </>
          )}
          {tab === "Portfolio" && !accountReady && (
            <AccountGate
              connected={!!active}
              loading={refreshing}
              error={loadError}
              onConnect={connect}
              onRetry={() => void refresh()}
            />
          )}
          {tab === "Portfolio" && accountReady && (
            <section className="workspace">
              <div className="section-title">
                <h2>My assets</h2>
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
                        {x.token === "basket" ? (
                          <Layers3 />
                        ) : (
                          <AssetIcon
                            kind={
                              state.assets.find(
                                (a) =>
                                  a.id ===
                                  state.rights.find((r) => r.id === x.id)
                                    ?.assetId,
                              )?.kind || "Other"
                            }
                          />
                        )}
                      </div>
                      <div>
                        <span>{x.kind}</span>
                        <h3>{x.name}</h3>
                        <p>
                          {state.balances[x.token + ":" + x.id] || "0"} units
                          held{" "}
                          {x.kind !== "Usage Right" && (
                            <>
                              ·{" "}
                              {money(
                                state.claimable[x.token + ":" + x.id] || "0",
                              )}{" "}
                              mJPY claimable
                            </>
                          )}
                        </p>
                      </div>
                      <div className="holding-actions">
                        {x.kind !== "Usage Right" && (
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
                                  x.token === "rights"
                                    ? "claim"
                                    : "claimRevenue",
                                  [x.id],
                                ),
                              )
                            }
                          >
                            Claim revenue
                          </button>
                        )}
                        <button
                          className="secondary"
                          disabled={!!busy}
                          onClick={() => listRight(x.token, x.id)}
                        >
                          List for resale
                        </button>
                        {x.token === "rights" && (
                          <button
                            className="secondary"
                            onClick={() => {
                              setFinanceSource(x.id);
                              setMarketView("fraction");
                              setTab("Markets");
                            }}
                          >
                            {DEMO
                              ? "Fractionalize / lend · mock"
                              : "Split / rent rights"}
                          </button>
                        )}
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
                  <h3>You don’t own any assets yet.</h3>
                  <p>
                    Find a space, review its rights, and make your first
                    purchase.
                  </p>
                  <button className="primary" onClick={openExplore}>
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
          {marketLoaded && tab === "Compose" && (
            <section className="compose-layout">
              <div className="workspace">
                <h2>Create an income basket</h2>
                <p className="description">
                  Combine revenue rights from rooftops, parking, advertising,
                  and other assets. Each share is backed by one unit of every
                  selected right held in the vault.
                </p>
                {!accountReady ? (
                  <AccountGate
                    connected={!!active}
                    loading={refreshing}
                    error={loadError}
                    title="Start with the income rights you own"
                    description="Connect to choose your holdings. You can browse existing baskets without connecting."
                    onConnect={connect}
                    onRetry={() => void refresh()}
                  />
                ) : (
                  <>
                    <h3>01 / Choose 2–8 income rights</h3>
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
                          <AssetIcon
                            kind={
                              state.assets.find((a) => a.id === r.assetId)
                                ?.kind || "Other"
                            }
                            size={19}
                          />
                          <span>
                            <b>
                              {
                                state.assets.find((a) => a.id === r.assetId)
                                  ?.name
                              }
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
                        Acquire at least two compatible revenue rights to create
                        a basket. Usage rights are not eligible. Rights already
                        in a pool can be deposited into that existing basket.
                      </div>
                    )}
                    <h3>02 / Name and review your basket</h3>
                    <label>
                      Basket name
                      <input
                        value={basketName}
                        maxLength={80}
                        onChange={(e) => setBasketName(e.target.value)}
                      />
                    </label>
                    {compose.length > 0 && (
                      <p className="caption">
                        One basket share will contain one unit of each selected
                        income right ({compose.length} rights in total).
                      </p>
                    )}
                    <button
                      className="primary wide"
                      disabled={
                        !!busy ||
                        compose.length < 2 ||
                        compose.length > 8 ||
                        !basketName.trim()
                      }
                      onClick={() =>
                        run("Create basket", async () => {
                          await send("basket", "createBasket", [
                            compose,
                            compose.map(() => "1"),
                            metadataURI({
                              name: basketName.trim(),
                              simulated: true,
                            }),
                          ]);
                          setCompose([]);
                        })
                      }
                    >
                      Save basket plan <ArrowRight size={16} />
                    </button>
                    <p className="caption">
                      This records the combination; your rights stay in your
                      wallet. Next, open the basket and choose “Add your rights”
                      to deposit them and receive shares.
                    </p>
                  </>
                )}
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
                <h3>Browse income baskets</h3>
                {state.baskets.map((b) => (
                  <BasketPoolCard
                    key={`${active}:${b.id}`}
                    basket={b}
                    state={state}
                    connected={!!active}
                    ready={accountReady}
                    busy={!!busy}
                    demo={DEMO}
                    onConnect={connect}
                    onDeposit={(shares) =>
                      run("Create backed basket shares", async () => {
                        await approve("rights", "basket");
                        await send("basket", "depositUnderlying", [
                          b.id,
                          shares,
                        ]);
                        setHighlighted(
                          state.rights
                            .filter((r) => b.rightIds.includes(r.id))
                            .map((r) => r.assetId),
                        );
                      })
                    }
                    onView={() => {
                      setHighlighted(
                        state.rights
                          .filter((r) => b.rightIds.includes(r.id))
                          .map((r) => r.assetId),
                      );
                      openExplore();
                    }}
                    onManage={() => setTab("Portfolio")}
                  />
                ))}
                {!state.baskets.length && (
                  <div className="empty">
                    <Layers3 size={42} />
                    <h3>The city is your building block.</h3>
                    <p>Create a basket backed by compatible revenue rights.</p>
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
                    <BasketOfferCard
                      key={`${active}:${l.id}`}
                      listing={l}
                      basket={state.baskets.find((b) => b.id === l.rightId)}
                      state={state}
                      account={active}
                      busy={!!busy}
                      demo={DEMO}
                      onConnect={connect}
                      onPurchase={(shares) =>
                        run("Purchase basket shares", async () => {
                          if (
                            !/^\d+$/.test(shares) ||
                            BigInt(shares) <= 0n ||
                            BigInt(shares) > BigInt(l.remaining)
                          )
                            throw new Error(
                              "Enter a whole quantity within the available supply.",
                            );
                          await approve(
                            "settlement",
                            "market",
                            (BigInt(shares) * BigInt(l.unitPrice)).toString(),
                          );
                          await send("market", "purchase", [l.id, shares]);
                        })
                      }
                    />
                  ))}
              </div>
            </section>
          )}
          {marketLoaded && tab === "Markets" && (
            <FinanceMarkets
              key={marketRequest}
              market={state}
              directory={
                <AssetDirectory
                  assets={state.assets}
                  rights={state.rights}
                  filters={directoryFilters}
                  onFiltersChange={setDirectoryFilters}
                  listingsFor={listingFor}
                  stage={stage}
                  demo={DEMO}
                  onOpenDetails={() => {
                    if (!busy) {
                      setError("");
                      setNotice("");
                      setTransaction(null);
                    }
                  }}
                  actions={{
                    account: active,
                    ready: accountReady,
                    demo: DEMO,
                    busy: !!busy,
                    canVerifyAsset,
                    canVerifyRight,
                    balances: state.balances,
                    walletControl,
                    feedback,
                    onConnect: connect,
                    onPurchase: purchaseListing,
                    onRequestVerification: (asset) =>
                      run("Submit for verification", () => {
                        if (
                          !accountReady ||
                          !same(asset.issuer, active) ||
                          asset.status !== "Draft"
                        )
                          throw new Error(
                            "Only the draft issuer can request verification.",
                          );
                        return send("registry", "requestVerification", [
                          asset.id,
                        ]);
                      }),
                    onReviewAsset: (asset, approved) =>
                      run(approved ? "Approve asset" : "Reject asset", () => {
                        if (
                          !accountReady ||
                          !canVerifyAsset ||
                          asset.status !== "Pending verification"
                        )
                          throw new Error(
                            "An authorized asset verifier is required.",
                          );
                        return send("registry", "verifyAsset", [
                          asset.id,
                          approved,
                        ]);
                      }),
                    onReviewRight: (right, approved) =>
                      run(approved ? "Approve right" : "Reject right", () => {
                        if (
                          !accountReady ||
                          !canVerifyRight ||
                          right.status !== "Pending verification"
                        )
                          throw new Error(
                            "An authorized rights verifier is required.",
                          );
                        return send("rights", "verifyRight", [
                          right.id,
                          approved,
                        ]);
                      }),
                    onActivateRight: (right) =>
                      run("Activate right", () => {
                        if (
                          !accountReady ||
                          !canVerifyRight ||
                          right.status !== "Verified"
                        )
                          throw new Error(
                            "An authorized rights verifier is required.",
                          );
                        return send("rights", "activateRight", [right.id]);
                      }),
                  }}
                  onView={(id) => {
                    setKind("All assets");
                    setStatus("All stages");
                    setOwnedOnly(false);
                    setLens(false);
                    setHighlighted([]);
                    setFundingOnly(false);
                    setDirectorySelection(id);
                    openExplore();
                  }}
                />
              }
              view={marketView}
              onViewChange={setMarketView}
              sourceId={financeSource}
              demo={DEMO}
              account={account || undefined}
              provider={wallet.provider}
              onConnect={() => setWalletOpen(true)}
              onRefresh={refresh}
              onCreate={() => openTokenize(true)}
              onView={(id) => {
                setKind("All assets");
                setStatus("All stages");
                setOwnedOnly(false);
                setFundingOnly(false);
                setDirectorySelection(id);
                openExplore();
              }}
            />
          )}
          {marketLoaded && tab === "Namespaces" && (
            <NamespaceDashboard
              account={account}
              provider={wallet.provider}
              onConnect={connect}
              initialSelection={ensSelection}
              state={state}
              demo={DEMO}
              onView={(id) => {
                setKind("All assets");
                setStatus("All stages");
                setOwnedOnly(false);
                setLens(false);
                setHighlighted([]);
                setFundingOnly(false);
                setDirectorySelection(id);
                openExplore();
              }}
            />
          )}
          {marketLoaded && tab === "Activity" && (
            <section className="workspace">
              <div className="section-title">
                <h2>Urban activity ledger</h2>
                <span>
                  {DEMO ? "SIMULATED EVENTS" : "MULTIBAAS EVENT QUERIES"}
                </span>
              </div>
              <ActivityFeed events={state.events} demo={DEMO} />
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
          {marketLoaded && activeNavigation === "Dashboard" && (
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
                <strong>
                  {activeAssets.length.toString().padStart(2, "0")}
                </strong>
                <span>ASSETS ACTIVATED</span>
              </div>
              <div className="impact-number">
                <strong>
                  {activeAssets
                    .reduce((n, a) => n + a.area, 0)
                    .toLocaleString()}
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
          )}
          <footer>
            <span>
              TOKENIZE TOKYO <b>© 2026</b>
            </span>
            <span>
              {DEMO
                ? "Demo simulation · no on-chain transactions"
                : state.events.some((event) => event.source === "rpc-bootstrap")
                  ? "Data: MultiBaas + verified Sepolia setup logs"
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
      {!DEMO && (
        <WalletPanel
          open={walletOpen}
          onClose={() => setWalletOpen(false)}
          wallet={wallet}
          cash={state.cash}
          cashReady={accountReady}
          onViewAssets={() => {
            setWalletOpen(false);
            setTab("Portfolio");
          }}
          actionError={error}
          tourHost={setWalletTourContainer}
          tourActive={guideActive}
          onGasBalance={setWalletGasBalance}
          busy={!!busy}
          transactions={recentTransactions.filter(
            (tx) => tx.chainId === config.chainId && same(tx.account, account),
          )}
          onMint={() =>
            run("Mint MockJPY", () =>
              send("settlement", "mint", [
                active,
                parseEther("1000000").toString(),
              ]),
            )
          }
        />
      )}
      <TokenizeDialog
        open={tokenizeOpen}
        onClose={closeTokenize}
        wallet={tokenizeOpen ? walletControl : null}
        tourHost={setTutorialContainer}
      >
        {tokenizeOpen && feedback}
        <div hidden={showSpacePicker}>
          {flowStarted && (
            <TokenizeFlow
              key={flowVersion}
              form={form}
              setForm={setForm}
              state={state}
              active={active}
              actor={actor}
              demo={DEMO}
              verifierRoles={verifierRoles}
              busy={!!busy}
              initialTarget={flowTarget}
              createdAsset={
                createdGeo
                  ? state.assets
                      .filter((a) => a.geoReference === createdGeo)
                      .at(-1)
                  : undefined
              }
              onPick={() => setShowSpacePicker(true)}
              onActor={(name) => setActor(name as keyof typeof ACTORS)}
              issuerActor={(address) =>
                Object.entries(ACTORS).find(([, a]) => same(a, address))?.[0] ||
                "Owner A"
              }
              onRegister={createAsset}
              onIssue={createRight}
              onAction={(label, contract, method, args) =>
                run(label, () => send(contract, method, args))
              }
              onCampaign={() => {
                closeTokenize();
                setFinanceSource("");
                setMarketView("funding");
                setMarketRequest((n) => n + 1);
                setTab("Markets");
              }}
              onPublish={(r, amount) =>
                run("Primary listing", async () => {
                  const held = BigInt(state.balances["rights:" + r.id] || "0");
                  if (
                    !/^\d+$/.test(amount) ||
                    BigInt(amount) <= 0n ||
                    BigInt(amount) > held
                  )
                    throw new Error(
                      "Enter a whole offer quantity within your holdings.",
                    );
                  const reserved = state.listings
                    .filter(
                      (l) =>
                        l.token === "rights" &&
                        l.rightId === r.id &&
                        !l.cancelled &&
                        same(l.seller, active),
                    )
                    .reduce((n, l) => n + BigInt(l.remaining), 0n);
                  if (BigInt(amount) + reserved > held)
                    throw new Error(
                      "Some units are already offered. Cancel the existing listing first.",
                    );
                  const price = parseEther(form.price);
                  if (price <= 0n) throw new Error("Enter a positive price.");
                  await approve("rights", "market");
                  await send("market", "createListing", [
                    addresses.rights,
                    r.id,
                    amount,
                    price.toString(),
                  ]);
                })
              }
              onActivate={(r) =>
                run("Activate project", () =>
                  send("rights", "activateRight", [r.id]),
                )
              }
              onDeposit={(r, value) =>
                run("Deposit project revenue", async () => {
                  const amount = parseEther(value).toString();
                  await approve("settlement", "revenue", amount);
                  await send("revenue", "depositRevenue", [r.id, amount]);
                })
              }
              onView={(id) => {
                closeTokenize();
                setKind("All assets");
                setStatus("All stages");
                setOwnedOnly(false);
                setFundingOnly(false);
                setDirectorySelection(id);
                openExplore();
              }}
            />
          )}
        </div>
        {showSpacePicker && (
          <section
            className="location-modal"
            aria-label="Select an asset location"
          >
            <div className="section-title">
              <div>
                <span className="eyebrow">01 / SELECT YOUR SPACE</span>
                <h2>A new possibility starts here.</h2>
              </div>
              <button
                className="icon-button"
                onClick={() => setShowSpacePicker(false)}
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
              theme={theme}
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
                onClick={() => setShowSpacePicker(false)}
              >
                Define the right <ArrowRight size={16} />
              </button>
            </div>
          </section>
        )}
      </TokenizeDialog>
    </div>
  );
}
