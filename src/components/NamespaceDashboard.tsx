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
import { ensBindingConfiguration } from "@/lib/ens/authority";
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
  const filtered = filterNamespaces(root, query);
  const all = flattenNamespaces(root);
  const selected = all.find((node) => node.name === selection);
  const hasBinding =
    !!configured &&
    selected?.kind === "Space" &&
    selected.assetId === configured.assetId &&
    selected.label ===
      ["rooftop", "interior", "wall", "land", "whole"][configured.scope];
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
              ? "Select a space to inspect its registered binding and manage delegated issuance. Other generated names remain previews."
              : "Explore the proposed hierarchy for your urban rights. No live ENS registrations or delegations are connected."}
          </p>
        </div>
        <span>{configured ? "SEPOLIA" : "PREVIEW"}</span>
      </div>
      <div className={styles.layout}>
        <a
          href="/ens"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            color: "var(--lime)",
            marginBottom: 16,
            fontSize: 13,
          }}
        >
          Open the ENSv2 permissions demo <ArrowUpRight size={14} />
        </a>
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
                  {hasBinding ? "Inspect on Sepolia" : "Unregistered preview"}
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
                    hasBinding ? "Copy ENS name" : "Copy example ENS name"
                  }
                  title={hasBinding ? "Copy ENS name" : "Copy example ENS name"}
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(selected.name);
                      setCopyMessage(
                        hasBinding ? "ENS name copied" : "Example name copied",
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
                      <dd>Sepolia · planned</dd>
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
                      <ShieldCheck size={15} /> SCOPED CONTROL · PLANNED
                    </div>
                    <div className={styles.controlFlow}>
                      <span>Asset issuer</span>
                      <ChevronRight size={14} />
                      <strong>{selected.scope || "Selected space"}</strong>
                      <ChevronRight size={14} />
                      <span>Operator</span>
                    </div>
                    <p>
                      Delegate one space, without giving control of the entire
                      building. No operator has been granted permissions here.
                    </p>
                    <details>
                      <summary>What does ENS control allow?</summary>
                      <p>
                        ENS permissions manage the name and its subregistry.
                        Issuing an Urban Right will also require a separate
                        issuer-approved application grant. That contract
                        integration is implemented and tested locally, but no
                        live binding is connected for this preview. Property
                        verification stays separate.
                      </p>
                      <a
                        href="https://docs.ens.domains/ensv2/enhanced-access-control/"
                        target="_blank"
                        rel="noreferrer"
                      >
                        ENSv2 access control <ArrowUpRight size={12} />
                      </a>
                    </details>
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
