"use client";
import { useEffect, useRef, useState } from "react";
import { ArrowUpRight, Copy, LogOut, Wallet, X } from "lucide-react";
import { formatEther, stringToHex } from "viem";
import { config } from "@/lib/config";
import { useBrowserWallet } from "@/lib/use-browser-wallet";
import {
  assertWallet,
  NETWORK_NAME,
  switchNetwork,
  transactionPhase,
  transactionUrl,
  walletError,
  type RecentTransaction,
} from "@/lib/wallet";
import { short } from "@/lib/model";
import styles from "./WalletPanel.module.css";

type WalletConnection = ReturnType<typeof useBrowserWallet>;
export default function WalletPanel({
  open,
  onClose,
  wallet,
  cash,
  cashReady,
  actionError,
  tourHost,
  tourActive,
  onGasBalance,
  transactions,
  busy,
  onMint,
  onViewAssets,
}: {
  open: boolean;
  onClose: () => void;
  wallet: WalletConnection;
  cash: string;
  cashReady: boolean;
  actionError?: string;
  tourHost?: (element: HTMLDivElement | null) => void;
  tourActive?: boolean;
  onGasBalance?: (balance: string | null) => void;
  transactions: RecentTransaction[];
  busy: boolean;
  onMint: () => Promise<unknown>;
  onViewAssets: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [gas, setGas] = useState<string | null>(null);
  const [working, setWorking] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const { account, provider } = wallet;
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog || !open) return;
    dialog.showModal();
    return () => dialog.close();
  }, [open]);
  useEffect(() => {
    setMessage("");
    setError("");
  }, [account]);
  useEffect(() => {
    setGas(null);
    onGasBalance?.(null);
    if (!open || !provider || !account || wallet.chainId !== config.chainId)
      return;
    let cancelled = false;
    const refresh = async () => {
      try {
        const balance = String(
          await provider.request({
            method: "eth_getBalance",
            params: [account, "latest"],
          }),
        );
        if (!cancelled) {
          setGas(BigInt(balance).toString());
          onGasBalance?.(BigInt(balance).toString());
        }
      } catch {
        if (!cancelled) {
          setGas(null);
          onGasBalance?.(null);
        }
      }
    };
    void refresh();
    const timer = setInterval(refresh, 4000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [open, account, provider, wallet.chainId, onGasBalance]);
  const perform = async (label: string, fn: () => Promise<unknown>) => {
    if (working) return;
    setWorking(label);
    setError("");
    setMessage("");
    try {
      await fn();
    } catch (e) {
      setError(walletError(e));
    } finally {
      setWorking("");
    }
  };
  const requestGas = async () => {
    if (!provider || !account) return;
    await assertWallet(provider, account);
    const post = async (body: unknown) => {
      const response = await fetch("/api/test-gas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error || "Test gas request failed.");
      return data;
    };
    const data = await post({ action: "challenge", address: account });
    await assertWallet(provider, account);
    const signature = await provider.request({
      method: "personal_sign",
      params: [stringToHex(data.message), account],
    });
    await assertWallet(provider, account);
    const result = await post({
      action: "claim",
      challenge: data.challenge,
      signature,
    });
    setMessage(result.message);
  };
  const blocked = !!working || busy || wallet.connecting;
  return (
    <dialog
      ref={ref}
      className={styles.dialog}
      aria-labelledby="wallet-title"
      data-tour-surface="wallet"
      data-tour-open={tourActive || undefined}
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className={styles.surface}>
        <header>
          <h2 id="wallet-title">
            <Wallet size={20} />{" "}
            {account ? "Your account" : "Connect your wallet"}
          </h2>
          <button
            onClick={onClose}
            className="icon-button"
            aria-label="Close wallet"
          >
            <X size={20} />
          </button>
        </header>
        <p className={styles.network}>
          {NETWORK_NAME} · Chain {config.chainId}
        </p>
        {!account ? (
          <>
            <p>Choose a wallet. You approve every transaction.</p>
            <div className={styles.providers}>
              {wallet.wallets.map((w) => (
                <button
                  key={w.id}
                  data-tour="wallet-provider"
                  className={styles.provider}
                  disabled={blocked}
                  onClick={() => perform("Connecting", () => wallet.connect(w))}
                >
                  <Wallet size={18} aria-hidden="true" />
                  <span>{w.name}</span>
                  <ArrowUpRight size={16} aria-hidden="true" />
                </button>
              ))}
            </div>
            {!wallet.wallets.length && (
              <p className={styles.hint}>
                No browser wallet found. Open this site in a browser with
                MetaMask or Rabby, or in a wallet’s built-in browser.
                WalletConnect is not configured.
              </p>
            )}
            <a href="/demo" className={styles.link}>
              Explore demo without a wallet <ArrowUpRight size={14} />
            </a>
          </>
        ) : (
          <>
            <div className={styles.address}>
              <code>{account}</code>
              <button
                aria-label="Copy wallet address"
                title="Copy address"
                onClick={() =>
                  perform("Copying", async () => {
                    await navigator.clipboard.writeText(account);
                    setMessage("Address copied.");
                  })
                }
              >
                <Copy size={16} />
              </button>
            </div>
            <button className="secondary" onClick={onViewAssets}>
              Open My assets <ArrowUpRight size={16} />
            </button>
            {wallet.chainId !== config.chainId ? (
              <button
                data-tour="switch-network"
                className="primary"
                disabled={blocked}
                onClick={() =>
                  perform("Switching network", async () => {
                    await switchNetwork(provider!);
                  })
                }
              >
                Switch to {NETWORK_NAME}
              </button>
            ) : (
              <>
                <div className={styles.balances}>
                  <div>
                    <span>Gas balance</span>
                    <strong>
                      {gas === null
                        ? "…"
                        : Number(formatEther(BigInt(gas))).toLocaleString(
                            "en-US",
                            { maximumFractionDigits: 5 },
                          )}{" "}
                      ETH
                    </strong>
                  </div>
                  <div>
                    <span>Settlement balance</span>
                    <strong>
                      {cashReady
                        ? Number(
                            formatEther(BigInt(cash || "0")),
                          ).toLocaleString("en-US", {
                            maximumFractionDigits: 0,
                          })
                        : "…"}{" "}
                      mJPY
                    </strong>
                  </div>
                </div>
                <ol className={styles.steps}>
                  <li>
                    <div>
                      <strong>Get test gas</strong>
                      <p>
                        Test ETH pays network fees. Sign a message to request
                        it.
                      </p>
                    </div>
                    <button
                      data-tour="test-gas"
                      disabled={
                        blocked ||
                        gas === null ||
                        BigInt(gas) >= 10n ** 16n ||
                        config.chainId !== 2017072401
                      }
                      onClick={() =>
                        perform(
                          "Confirm the test gas message in your wallet",
                          requestGas,
                        )
                      }
                    >
                      {gas !== null && BigInt(gas) >= 10n ** 16n
                        ? "Gas ready"
                        : "Get test ETH"}
                    </button>
                  </li>
                  <li>
                    <div>
                      <strong>Get MockJPY</strong>
                      <p>
                        Test currency to buy rights. Confirm one mint
                        transaction.
                      </p>
                    </div>
                    <button
                      disabled={blocked || gas === null || BigInt(gas) === 0n}
                      data-tour="mint-currency"
                      onClick={() => perform("Minting MockJPY", onMint)}
                    >
                      Mint MockJPY
                    </button>
                  </li>
                  <li>
                    <div>
                      <strong>Choose a right</strong>
                      <p>
                        Open a space or a funding offer. Review terms, approve
                        payment, then purchase.
                      </p>
                    </div>
                    <button onClick={onClose}>Explore</button>
                  </li>
                </ol>
              </>
            )}
            <p className={styles.hint}>
              Test assets and test tokens only. Verification remains simulated.
              Connecting a wallet does not grant issuer or verifier permissions.
            </p>
            <button
              className={styles.disconnect}
              disabled={blocked}
              onClick={() => {
                wallet.disconnect();
                setGas(null);
              }}
            >
              <LogOut size={15} /> Disconnect
            </button>
            {transactions.length > 0 && (
              <section className={styles.recent}>
                <h3>Your recent transactions</h3>
                {transactions.slice(0, 6).map((tx) => (
                  <a
                    href={transactionUrl(tx.hash)}
                    key={tx.hash}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <span>
                      <strong>{tx.label}</strong>
                      <small>
                        {transactionPhase[tx.phase]} · {short(tx.hash)}
                      </small>
                    </span>
                    <ArrowUpRight size={16} />
                  </a>
                ))}
              </section>
            )}
          </>
        )}
        {working && <p role="status">{working}…</p>}
        {message && <p role="status">{message}</p>}
        {(error || actionError) && (
          <p className={styles.error} role="alert">
            {error || actionError}
          </p>
        )}
      </div>
      <div ref={tourHost} />
    </dialog>
  );
}
