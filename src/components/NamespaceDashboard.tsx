"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowUpRight,
  Building2,
  ChevronDown,
  ChevronRight,
  Copy,
  Globe2,
  KeyRound,
  Layers3,
  MapPin,
  Network,
  Search,
  ShieldCheck,
  X,
} from "lucide-react";
import type { MarketState } from "@/lib/model";
import { short } from "@/lib/model";
import {
  filterNamespaces,
  flattenNamespaces,
  namespaceHierarchy,
  type NamespaceNode,
} from "@/lib/ens/hierarchy";
import styles from "./NamespaceDashboard.module.css";
import EnsDelegation from "./EnsDelegation";
import {
  ensBindingConfiguration,
  loadEnsBinding,
  type LiveEnsBinding,
} from "@/lib/ens/authority";
import { config } from "@/lib/config";
import type { WalletProvider } from "@/lib/transactions";

const icons = {
  City: Globe2,
  District: MapPin,
  Asset: Building2,
  Space: Layers3,
  Right: KeyRound,
};
export default function NamespaceDashboard({
  state,
  demo,
  onView,
  initialSelection = "",
  account = "",
  provider = null,
  onConnect = () => {},
}: {
  initialSelection?: string;
  state: MarketState;
  demo: boolean;
  onView(assetId: string): void;
  account?: string;
  provider?: WalletProvider | null;
  onConnect?(): void;
}) {
  const configured = useMemo(() => {
    if (demo || config.chainId !== 11155111) return null;
    try {
      return ensBindingConfiguration();
    } catch {
      return null;
    }
  }, [demo]);
  const root = useMemo(
    () => namespaceHierarchy(state.assets, state.rights, configured?.parent),
    [state.assets, state.rights, configured],
  );
  const [query, setQuery] = useState("");
  const [selection, setSelection] = useState(initialSelection);
  const [detailsOpen, setDetailsOpen] = useState(!!initialSelection);
  const dialog = useRef<HTMLDialogElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const backdropPress = useRef(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [copyMessage, setCopyMessage] = useState("");
  const [live, setLive] = useState<LiveEnsBinding | null>(null);
  const [bindingError, setBindingError] = useState(false);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let active = true;
    setLive(null);
    setBindingError(false);
    if (configured)
      loadEnsBinding()
        .then((value) => {
          if (active) setLive(value);
        })
        .catch(() => {
          if (active) setBindingError(true);
        });
    return () => {
      active = false;
    };
  }, [configured, revision]);
  const filtered = filterNamespaces(root, query);
  const all = flattenNamespaces(root);
  const selected = all.find((node) => node.name === selection);
  const connectedSpace = all.find(
    (node) =>
      !!configured &&
      node.kind === "Space" &&
      node.assetId === configured.assetId &&
      node.label ===
        ["rooftop", "interior", "wall", "land", "whole"][configured.scope],
  );
  const hasBinding = !!selected && selected.name === connectedSpace?.name;
  const registeredNode = live?.binding.path.find(
    (_, index) =>
      [...live.binding.path.slice(0, index + 1)]
        .reverse()
        .map((node) => node.label)
        .join(".") +
        ".eth" ===
      selected?.name,
  );
  const inConfiguredPath =
    !!selected &&
    !!connectedSpace &&
    (selected.name === connectedSpace.name ||
      connectedSpace.name.endsWith(`.${selected.name}`));
  const usesConnectedSpace =
    selected?.kind === "Right" &&
    !!connectedSpace &&
    selected.name.endsWith(`.${connectedSpace.name}`);
  const showDetails = detailsOpen && !!selected;
  useEffect(() => {
    const element = dialog.current;
    if (!showDetails || !element) return;
    const opener = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    element.showModal();
    document.body.style.overflow = "hidden";
    closeButton.current?.focus();
    return () => {
      element.close();
      document.body.style.overflow = previousOverflow;
      if (opener?.isConnected) opener.focus({ preventScroll: true });
    };
  }, [showDetails]);
  const asset = state.assets.find((item) => item.id === selected?.assetId);
  const right = state.rights.find((item) => item.id === selected?.rightId);
  const path = selected
    ? all
        .filter(
          (node) =>
            node.name === selected.name ||
            selected.name.endsWith(`.${node.name}`),
        )
        .sort((a, b) => a.name.length - b.name.length)
    : [];
  const choose = (name: string) => {
    setSelection(name);
    setDetailsOpen(true);
    setCopyMessage("");
  };
  const nodeView = (node: NamespaceNode) => {
    const Icon = icons[node.kind];
    const open = query.trim()
      ? true
      : (expanded[node.name] ??
        (node.kind === "City" ||
          !!selected?.name.endsWith(`.${node.name}`) ||
          selected?.name === node.name));
    return (
      <li key={node.name}>
        <div
          className={`${styles.node} ${selected?.name === node.name ? styles.selected : ""}`}
        >
          {node.children.length ? (
            <button
              className={styles.expand}
              aria-label={`${open ? "Collapse" : "Expand"} ${node.label}`}
              aria-expanded={open}
              onClick={() =>
                setExpanded((current) => ({ ...current, [node.name]: !open }))
              }
            >
              {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </button>
          ) : (
            <span className={styles.leaf} />
          )}
          <button
            className={styles.select}
            aria-label={`Inspect ${node.name}`}
            aria-pressed={selected?.name === node.name}
            onClick={() => choose(node.name)}
          >
            <Icon size={17} />
            <span>
              <strong>{node.label}</strong>
              <small>{node.title}</small>
            </span>
            <em>{node.kind}</em>
          </button>
        </div>
        {open && node.children.length > 0 && (
          <ul>{node.children.map(nodeView)}</ul>
        )}
      </li>
    );
  };
  return (
    <section className={styles.page} aria-label="ENS Index">
      <div className={styles.notice}>
        <Network size={18} />
        <div>
          <strong>
            ENS Index · {configured ? "Sepolia" : "ENSv2 preview"}
          </strong>
          <p>
            {configured
              ? "Start with the connected rooftop to manage who can issue rights or report energy. Other spaces show proposed names."
              : "This simulated market shows example names. Open the Sepolia rooftop to explore connected ENS permissions."}
          </p>
        </div>
        <span>{configured ? "SEPOLIA" : "PREVIEW"}</span>
      </div>
      <section className={styles.connected} aria-label="Connected ENS space">
        <div className={styles.sectionLabel}>
          <ShieldCheck size={15} /> SPACE PERMISSIONS
        </div>
        <h2>Give each person the access they need.</h2>
        <p>
          The rooftop operator prepares rights within the owner's limits. The
          energy reporter updates one report. The owner can revoke either
          permission.
        </p>
        {configured && (
          <div role="status" className={styles.bindingStatus}>
            {live ? (
              <>
                <strong>Connected on Sepolia</strong>
                <code>{live.name}</code>
                <small>Binding checked at block {live.block.toString()}</small>
              </>
            ) : bindingError ? (
              <>
                <span>Connection check unavailable. Please retry.</span>
                <button onClick={() => setRevision((value) => value + 1)}>
                  Retry ENS connection
                </button>
              </>
            ) : (
              <span>Checking the registered rooftop on Sepolia…</span>
            )}
          </div>
        )}
        <div className={styles.connectedActions}>
          <a href="/ens">
            Open rooftop permissions <ArrowUpRight size={14} />
          </a>
          {live && (
            <a
              href={`https://explorer.ens.dev/${encodeURIComponent(live.name)}`}
              target="_blank"
              rel="noreferrer"
            >
              View on ENS Explorer <ArrowUpRight size={14} />
            </a>
          )}
          {live && connectedSpace?.name === live.name && (
            <button onClick={() => choose(live.name)}>
              Inspect connected rooftop
            </button>
          )}
        </div>
      </section>
      <div className={styles.layout}>
        <section className={styles.treePanel} aria-label="ENS hierarchy">
          <div className={styles.treeHeader}>
            <span>SPACE HIERARCHY</span>
            <small>
              {state.assets.length} assets ·{" "}
              {demo ? "Demo data" : "Protocol data"}
            </small>
          </div>
          <label className={styles.search}>
            <Search size={16} />
            <input
              aria-label="Search ENS names"
              placeholder="Find a space or name…"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setCopyMessage("");
              }}
            />
          </label>
          <div className={styles.tree}>
            {filtered ? (
              <ul>{nodeView(filtered)}</ul>
            ) : (
              <div className={styles.empty}>
                <p>No ENS names match this search.</p>
                <button onClick={() => setQuery("")}>Clear search</button>
              </div>
            )}
          </div>
          <p className={styles.treeNote}>
            City → District → Asset → Space → Right · Select a name to view
            details.
          </p>
        </section>
        {showDetails && selected && (
          <dialog
            ref={dialog}
            className={styles.dialog}
            aria-label="ENS name details"
            onCancel={(event) => {
              event.preventDefault();
              setDetailsOpen(false);
            }}
            onPointerDown={(event) => {
              backdropPress.current = event.target === event.currentTarget;
            }}
            onClick={(event) => {
              if (backdropPress.current && event.target === event.currentTarget)
                setDetailsOpen(false);
              backdropPress.current = false;
            }}
          >
            <section className={styles.inspector} aria-label="ENS details">
              <div className={styles.inspectorHeader}>
                <span>{selected.kind.toUpperCase()} ENS NAME</span>
                <span className={styles.badge}>
                  {registeredNode
                    ? "Registered on Sepolia"
                    : inConfiguredPath
                      ? "Check Sepolia binding"
                      : "Unregistered preview"}
                </span>
                <button
                  ref={closeButton}
                  className={styles.close}
                  aria-label="Close ENS details"
                  onClick={() => setDetailsOpen(false)}
                >
                  <X size={20} />
                </button>
              </div>
              <h2>{asset?.name || selected.title}</h2>
              <div className={styles.path} aria-label="Selected ENS path">
                {path.map((node, i) => (
                  <span key={node.name}>
                    {i > 0 && <ChevronRight size={12} />}
                    <button onClick={() => choose(node.name)}>
                      {node.label}
                    </button>
                  </span>
                ))}
              </div>
              <div className={styles.fullName}>
                <code>{selected.name}</code>
                <button
                  aria-label={
                    hasBinding || registeredNode
                      ? "Copy ENS name"
                      : "Copy example ENS name"
                  }
                  title={
                    hasBinding || registeredNode
                      ? "Copy ENS name"
                      : "Copy example ENS name"
                  }
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(selected.name);
                      setCopyMessage(
                        hasBinding || registeredNode
                          ? "ENS name copied"
                          : "Example name copied",
                      );
                    } catch {
                      setCopyMessage("Select the name to copy it manually");
                    }
                  }}
                >
                  <Copy size={15} />
                </button>
              </div>
              {copyMessage && (
                <p className={styles.copyStatus} role="status">
                  {copyMessage}
                </p>
              )}
              {hasBinding ? (
                <EnsDelegation
                  name={selected.name}
                  account={account}
                  provider={provider}
                  onConnect={onConnect}
                />
              ) : inConfiguredPath ? (
                <div className={styles.delegation}>
                  <p>
                    {registeredNode
                      ? "This name is part of the registered rooftop's ENS hierarchy. Manage issuance and reporting at the rooftop."
                      : bindingError
                        ? "Could not verify this name's registration. Retry the ENS connection before managing permissions."
                        : "Checking this name against the connected rooftop's ENS hierarchy. Registration is shown only after verification."}
                  </p>
                  {registeredNode && (
                    <p>
                      Name controller: <code>{registeredNode.controller}</code>
                    </p>
                  )}
                  <button
                    className={styles.mapAction}
                    onClick={() => choose(connectedSpace!.name)}
                  >
                    Open connected rooftop <ArrowUpRight size={14} />
                  </button>
                </div>
              ) : (
                <>
                  <dl className={styles.facts}>
                    <div>
                      <dt>Resolved address</dt>
                      <dd>None · no ENS record registered</dd>
                    </div>
                    <div>
                      <dt>Parent ownership</dt>
                      <dd>Not verified · example only</dd>
                    </div>
                    <div>
                      <dt>ENS target network</dt>
                      <dd>Sepolia</dd>
                    </div>
                    <div>
                      <dt>ENS controller</dt>
                      <dd>Not connected</dd>
                    </div>
                    {asset && (
                      <div>
                        <dt>
                          {demo ? "Demo asset issuer" : "Protocol asset issuer"}
                        </dt>
                        <dd title={asset.issuer}>{short(asset.issuer)}</dd>
                      </div>
                    )}
                    {right && (
                      <>
                        <div>
                          <dt>Linked protocol right</dt>
                          <dd>
                            {right.kind} #{right.id}
                          </dd>
                        </div>
                        <div>
                          <dt>Right status {demo && "(demo)"}</dt>
                          <dd>{right.status}</dd>
                        </div>
                      </>
                    )}
                  </dl>
                  <p className={styles.addressNote}>
                    This example name is built from the district, asset ID and
                    space. It has not been registered through this app. The
                    asset issuer is the wallet that registered the asset in our
                    protocol, not this name&apos;s ENS controller or resolved
                    address.
                  </p>
                  <div className={styles.delegation}>
                    <div className={styles.sectionLabel}>
                      <ShieldCheck size={15} /> THIS NAME IS A PREVIEW
                    </div>
                    <div className={styles.controlFlow}>
                      <span>Asset issuer</span>
                      <ChevronRight size={14} />
                      <strong>{selected.scope || "Selected space"}</strong>
                      <ChevronRight size={14} />
                      <span>Operator</span>
                    </div>
                    <p>
                      {usesConnectedSpace
                        ? "This right uses its parent rooftop's ENS identity. A separate ENS name has not been registered for this individual right."
                        : "This example name is not connected to ENS. Permissions cannot be managed for it yet."}
                    </p>
                    <details>
                      <summary>What does ENS control allow?</summary>
                      <p>
                        The connected Sepolia rooftop supports delegated
                        issuance and report-only access. Issuance checks both an
                        ENS role and the owner's separate limits. Reporting
                        access only allows the energy report to be updated.
                        Property verification stays separate.
                      </p>
                      <a
                        href="https://docs.ens.domains/ensv2/enhanced-access-control/"
                        target="_blank"
                        rel="noreferrer"
                      >
                        ENSv2 access control <ArrowUpRight size={12} />
                      </a>
                    </details>
                    {usesConnectedSpace ? (
                      <button
                        className={styles.mapAction}
                        onClick={() => choose(connectedSpace!.name)}
                      >
                        Manage this right's rooftop <ArrowUpRight size={14} />
                      </button>
                    ) : (
                      <a href="/ens">
                        Open connected rooftop permissions{" "}
                        <ArrowUpRight size={14} />
                      </a>
                    )}
                  </div>
                </>
              )}
              {asset && (
                <button
                  className={styles.mapAction}
                  onClick={() => onView(asset.id)}
                >
                  <MapPin size={16} /> View this space on map{" "}
                  <ArrowUpRight size={16} />
                </button>
              )}
            </section>
          </dialog>
        )}
      </div>
    </section>
  );
}
