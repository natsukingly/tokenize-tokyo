"use client";
import { useEffect, useState } from "react";
import { ArrowUpRight, LoaderCircle } from "lucide-react";
import {
  encodeFunctionData,
  getAddress,
  isAddress,
  keccak256,
  stringToHex,
  type Abi,
} from "viem";
import {
  authorityAbi,
  eacAbi,
  delegatedRightsAbi,
  loadEnsBinding,
  loadIssuanceGrant,
  ensClient,
  type LiveEnsBinding,
} from "@/lib/ens/authority";
import { ENS_OPERATOR_ROLE } from "@/lib/ens/registry";
import { config } from "@/lib/config";
import { sendVerifiedCallViaMultiBaas } from "@/lib/multibaas";
import type { WalletProvider } from "@/lib/transactions";
import type { TransactionProgress } from "@/lib/wallet";
import styles from "./EnsDelegation.module.css";
import { loadEnsAudit } from "@/lib/ens/events";
import { positionalArguments } from "@/lib/ens/call";
import LoadingOverlay from "./LoadingOverlay";
import { transactionPhase } from "@/lib/wallet";

export default function EnsDelegation({
  name,
  account,
  provider,
  onConnect,
}: {
  name: string;
  account: string;
  provider: WalletProvider | null;
  onConnect(): void;
}) {
  const [live, setLive] = useState<LiveEnsBinding | null>(null);
  const [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  const [operator, setOperator] = useState("");
  const [quantity, setQuantity] = useState("10"),
    [limit, setLimit] = useState("100");
  const [grant, setGrant] = useState<Awaited<
    ReturnType<typeof loadIssuanceGrant>
  > | null>(null);
  const [revision, setRevision] = useState(0),
    [busy, setBusy] = useState(false),
    [reviewed, setReviewed] = useState(false);
  const [progress, setProgress] = useState<TransactionProgress | null>(null),
    [hashes, setHashes] = useState<string[]>([]);
  const [audit, setAudit] = useState<Awaited<ReturnType<typeof loadEnsAudit>>>(
      [],
    ),
    [auditStatus, setAuditStatus] = useState("");
  const issuer =
    !!live && account.toLowerCase() === live.binding.issuer.toLowerCase();
  const actor = issuer ? operator : account;
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    setLive(null);
    loadEnsBinding()
      .then((value) => {
        if (value.name !== name)
          throw new Error(
            "Selected name does not match the registered binding.",
          );
        if (active) setLive(value);
      })
      .catch(() => {
        if (active)
          setError(
            "Could not verify this Sepolia ENS binding. Check the connection and retry.",
          );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [name, revision]);
  useEffect(() => {
    let active = true;
    setAudit([]);
    if (live) {
      setAuditStatus("Loading indexed activity…");
      loadEnsAudit(live)
        .then((rows) => {
          if (active) {
            setAudit(rows);
            setAuditStatus(rows.length ? "" : "No indexed activity yet.");
          }
        })
        .catch(() => {
          if (active)
            setAuditStatus(
              "Indexed activity is unavailable. Transaction receipts remain available below.",
            );
        });
    }
    return () => {
      active = false;
    };
  }, [live]);
  useEffect(() => {
    let active = true;
    setGrant(null);
    setReviewed(false);
    if (live && isAddress(actor))
      loadIssuanceGrant(live, getAddress(actor))
        .then((value) => {
          if (active) setGrant(value);
        })
        .catch(() => {
          if (active)
            setError(
              "Could not load issuance permissions. Retry before signing.",
            );
        });
    return () => {
      active = false;
    };
  }, [live, actor]);
  const update = (p: TransactionProgress) => {
    setProgress(p);
    if ("hash" in p && p.hash)
      setHashes((prev) => (prev.includes(p.hash!) ? prev : [...prev, p.hash!]));
  };
  const send = async (
    address: string,
    label: string,
    abi: Abi,
    method: string,
    args: unknown[],
  ) => {
    if (!provider || !account) throw new Error("Connect your wallet first.");
    const data = encodeFunctionData({ abi, functionName: method, args });
    // The ABI-encoded intent is checked byte-for-byte against MultiBaas before wallet confirmation.
    const jsonArgs = positionalArguments(abi, method, args);
    await sendVerifiedCallViaMultiBaas(
      provider,
      account,
      { address, label, method, args: jsonArgs, data },
      update,
    );
  };
  const run = async (action: "delegate" | "revoke" | "issue") => {
    if (!live || !provider || !isAddress(actor) || !reviewed) return;
    setBusy(true);
    setError("");
    setHashes([]);
    setProgress(null);
    try {
      const op = getAddress(actor),
        leaf = live.binding.path[3],
        labelId = BigInt(keccak256(stringToHex(leaf.label)));
      if (action === "delegate") {
        if (
          !/^\d+$/.test(limit) ||
          BigInt(limit) < 1n ||
          BigInt(limit) > 1000000n
        )
          throw new Error("Choose 1–1,000,000 units.");
        const current = await ensClient().getBlock();
        const start = Number(current.timestamp),
          end = Math.min(start + 30 * 86400, Number(live.expiry));
        if (end <= start) throw new Error("This ENS space has expired.");
        await send(leaf.registry, "ensuserregistry", eacAbi, "grantRoles", [
          labelId,
          ENS_OPERATOR_ROLE,
          op,
        ]);
        await send(
          live.setting.authority,
          "urbannamespaceauthority",
          authorityAbi,
          "grantIssuance",
          [
            live.id,
            op,
            {
              purpose: keccak256(stringToHex("SOLAR")),
              kind: 1,
              policy: 0,
              exclusive: false,
              minStart: start,
              maxEnd: end,
              validUntil: end,
              maxSupply: BigInt(limit),
            },
          ],
        );
      } else if (action === "revoke") {
        await send(
          live.setting.authority,
          "urbannamespaceauthority",
          authorityAbi,
          "revokeIssuance",
          [live.id, op],
        );
        await send(leaf.registry, "ensuserregistry", eacAbi, "revokeRoles", [
          labelId,
          ENS_OPERATOR_ROLE,
          op,
        ]);
      } else {
        if (
          !grant ||
          !/^\d+$/.test(quantity) ||
          BigInt(quantity) < 1n ||
          BigInt(quantity) > grant.available
        )
          throw new Error("Quantity exceeds the remaining permission.");
        const l = grant.grant.limits;
        const terms = `data:application/json,${encodeURIComponent(JSON.stringify({ name: "Delegated solar revenue right", space: name, issuer: live.binding.issuer, operator: op, simulation: true, description: "Sepolia test right; no legal entitlement or guaranteed income." }))}`;
        await send(
          config.addresses.rights,
          "urbanrighttoken",
          delegatedRightsAbi,
          "createScopedRightForIssuer",
          [
            {
              assetId: live.binding.assetId,
              kind: l.kind,
              supply: BigInt(quantity),
              terms,
              termsHash: keccak256(stringToHex(terms)),
              start: l.minStart,
              end: l.maxEnd,
              policy: l.policy,
              scope: live.binding.scope,
              purpose: l.purpose,
              exclusive: l.exclusive,
            },
          ],
        );
      }
      setRevision((v) => v + 1);
      setReviewed(false);
    } catch (e) {
      setError(
        e instanceof Error && e.constructor === Error
          ? e.message
          : "Action was not completed. If a transaction was submitted, check its receipt below before retrying.",
      );
    } finally {
      setBusy(false);
    }
  };
  if (loading)
    return (
      <div className={styles.panel} role="status">
        <LoadingOverlay
          active
          title="Verifying ENS delegation…"
          detail="Checking the registered name on Sepolia."
        />
        <LoaderCircle className={styles.spin} size={16} /> Checking the
        registered name on Sepolia…
      </div>
    );
  if (!live)
    return (
      <div className={styles.panel}>
        <p role="alert">{error}</p>
        <button onClick={() => setRevision((v) => v + 1)}>
          Retry connection
        </button>
      </div>
    );
  return (
    <section className={styles.panel} aria-label="ENS delegated issuance">
      <LoadingOverlay
        active={busy}
        title="Updating ENS delegation…"
        detail={
          progress
            ? transactionPhase[progress.phase]
            : "Preparing your reviewed action."
        }
      />
      <div className={styles.heading}>
        <strong>Registered space · Sepolia</strong>
        <span>Binding #{live.binding.nonce.toString()}</span>
      </div>
      <dl>
        <div>
          <dt>Name controller / asset issuer</dt>
          <dd>
            <a
              href={`https://sepolia.etherscan.io/address/${live.binding.issuer}`}
              target="_blank"
              rel="noreferrer"
            >
              {live.binding.issuer}
              <ArrowUpRight size={12} />
            </a>
          </dd>
        </div>
        <div>
          <dt>Linked right contract</dt>
          <dd>
            <a
              href={`https://sepolia.etherscan.io/address/${config.addresses.rights}`}
              target="_blank"
              rel="noreferrer"
            >
              ERC-1155 · Asset #{live.binding.assetId.toString()}
              <ArrowUpRight size={12} />
            </a>
          </dd>
        </div>
        <div>
          <dt>ENS registry</dt>
          <dd>
            <a
              href={`https://sepolia.etherscan.io/address/${live.binding.path[3].registry}`}
              target="_blank"
              rel="noreferrer"
            >
              View the rooftop registration
              <ArrowUpRight size={12} />
            </a>
          </dd>
        </div>
      </dl>
      <p>
        This name identifies a space. The on-chain binding above links it to the
        right contract and asset ID. Resolver records can change; they are not
        proof of issuance permission or a payment destination.
      </p>
      {!account ? (
        <button onClick={onConnect}>Connect wallet to manage this space</button>
      ) : (
        <>
          <h3>
            {issuer
              ? "Let an operator prepare rights for this roof"
              : "Your permission for this space"}
          </h3>
          {issuer && (
            <>
              <label>
                Operator wallet address
                <input
                  value={operator}
                  onChange={(e) => setOperator(e.target.value)}
                  placeholder="0x…"
                  autoComplete="off"
                  disabled={busy}
                />
              </label>
              <label>
                Maximum units
                <input
                  type="number"
                  min="1"
                  max="1000000"
                  value={limit}
                  onChange={(e) => setLimit(e.target.value)}
                  disabled={busy}
                />
              </label>
              <p>
                Solar revenue rights · this rooftop only · 30 days · open
                transfer. Two wallet confirmations grant the ENS resolver role
                and the issuance limit. Renewing permission resets its quota.
                Rights are delivered to you and still need verifier approval.
              </p>
            </>
          )}
          {grant && (
            <p className={styles.remaining}>
              {grant.available.toString()} units can currently be issued by this
              operator.
            </p>
          )}
          {!issuer && grant && grant.available > 0n && (
            <label>
              Units to prepare
              <input
                type="number"
                min="1"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                disabled={busy}
              />
            </label>
          )}
          <label className={styles.review}>
            <input
              type="checkbox"
              checked={reviewed}
              onChange={(e) => setReviewed(e.target.checked)}
              disabled={busy}
            />
            I reviewed the space, recipient and limits. These are test rights.
          </label>
          <div className={styles.actions}>
            {issuer ? (
              <>
                <button
                  disabled={busy || !reviewed || !isAddress(operator)}
                  onClick={() => run("delegate")}
                >
                  Delegate roof issuance
                </button>
                <button
                  disabled={busy || !reviewed || !isAddress(operator)}
                  onClick={() => run("revoke")}
                >
                  Revoke operator permission
                </button>
              </>
            ) : (
              <button
                disabled={busy || !reviewed || !grant || grant.available === 0n}
                onClick={() => run("issue")}
              >
                Prepare rights for the issuer
              </button>
            )}
          </div>
        </>
      )}
      {progress && (
        <p role="status">
          {progress.phase === "confirmed"
            ? "Confirmed on Sepolia"
            : progress.phase === "signature"
              ? "Confirm in your wallet"
              : progress.phase === "submitted"
                ? "Submitted · waiting for confirmation"
                : progress.phase}
        </p>
      )}
      {error && <p role="alert">{error}</p>}
      {hashes.map((hash, i) => (
        <a
          className={styles.receipt}
          key={hash}
          href={`https://sepolia.etherscan.io/tx/${hash}`}
          target="_blank"
          rel="noreferrer"
        >
          Transaction {i + 1} · View on Etherscan <ArrowUpRight size={13} />
        </a>
      ))}
      <details>
        <summary>Permission history</summary>
        <p>
          Initial setup is verified from Sepolia logs; new activity is indexed
          by MultiBaas.
        </p>
        {auditStatus && <p>{auditStatus}</p>}
        {audit.map((entry, i) => (
          <a
            className={styles.receipt}
            key={entry.hash + entry.eventName + i}
            href={`https://sepolia.etherscan.io/tx/${entry.hash}`}
            target="_blank"
            rel="noreferrer"
          >
            {entry.eventName} · block {entry.block} <ArrowUpRight size={12} />
          </a>
        ))}
      </details>
    </section>
  );
}
