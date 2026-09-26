"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { WalletProvider } from "./transactions";
import { isAddress, switchNetwork } from "./wallet";

type BrowserWallet = { id: string; name: string; provider: WalletProvider };
export function useBrowserWallet(enabled: boolean) {
  const [wallets, setWallets] = useState<BrowserWallet[]>([]);
  const [provider, setProvider] = useState<WalletProvider | null>(null);
  const [account, setAccount] = useState("");
  const [chainId, setChainId] = useState<number | null>(null);
  const [connecting, setConnecting] = useState(false);
  const epoch = useRef(0);
  useEffect(() => {
    if (!enabled) return;
    const announced = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      if (!detail?.provider?.request || typeof detail.info?.uuid !== "string")
        return;
      setWallets((previous) =>
        previous.some((w) => w.id === detail.info.uuid)
          ? previous
          : [
              ...previous.filter((w) => w.id !== "injected"),
              {
                id: detail.info.uuid,
                name: String(detail.info.name || "Browser wallet").slice(0, 60),
                provider: detail.provider,
              },
            ],
      );
    };
    window.addEventListener("eip6963:announceProvider", announced);
    window.dispatchEvent(new Event("eip6963:requestProvider"));
    const injected = (window as unknown as { ethereum?: WalletProvider })
      .ethereum;
    if (injected)
      setWallets((previous) =>
        previous.length
          ? previous
          : [{ id: "injected", name: "Browser wallet", provider: injected }],
      );
    return () =>
      window.removeEventListener("eip6963:announceProvider", announced);
  }, [enabled]);
  useEffect(() => {
    if (!provider) return;
    const accountsChanged = (...args: unknown[]) => {
      epoch.current++;
      const accounts = args[0] as string[];
      setAccount(isAddress(accounts?.[0]) ? accounts[0] : "");
    };
    const chainChanged = (...args: unknown[]) => {
      try {
        setChainId(Number(BigInt(String(args[0]))));
      } catch {
        setChainId(null);
      }
    };
    const disconnected = () => {
      epoch.current++;
      setAccount("");
      setChainId(null);
    };
    provider.on?.("accountsChanged", accountsChanged);
    provider.on?.("chainChanged", chainChanged);
    provider.on?.("disconnect", disconnected);
    return () => {
      provider.removeListener?.("accountsChanged", accountsChanged);
      provider.removeListener?.("chainChanged", chainChanged);
      provider.removeListener?.("disconnect", disconnected);
    };
  }, [provider]);
  const connect = useCallback(async (wallet: BrowserWallet) => {
    const version = ++epoch.current;
    setConnecting(true);
    try {
      // Bind only after the account/network prompts complete; events during onboarding
      // cannot accidentally reconnect an account which was just disconnected.
      await wallet.provider.request({ method: "eth_requestAccounts" });
      await switchNetwork(wallet.provider);
      const accounts = (await wallet.provider.request({
        method: "eth_accounts",
      })) as string[];
      if (version !== epoch.current) return;
      if (!isAddress(accounts?.[0]))
        throw new Error("No wallet account selected.");
      const connectedChain = Number(
        BigInt(
          String(await wallet.provider.request({ method: "eth_chainId" })),
        ),
      );
      if (version !== epoch.current) return;
      setProvider(wallet.provider);
      setChainId(connectedChain);
      setAccount(accounts[0]);
    } finally {
      setConnecting(false);
    }
  }, []);
  const disconnect = () => {
    epoch.current++;
    setProvider(null);
    setAccount("");
    setChainId(null);
  };
  return {
    wallets,
    provider,
    account,
    chainId,
    connecting,
    connect,
    disconnect,
  };
}
