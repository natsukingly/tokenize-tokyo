"use client";
import {
  PrivyProvider,
  useConnectWallet,
  useLogin,
  useModalStatus,
  usePrivy,
  useWallets,
} from "@privy-io/react-auth";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { defineChain } from "viem";
import { sepolia } from "viem/chains";
import { config } from "@/lib/config";
import { NETWORK_NAME, walletError } from "@/lib/wallet";
import { connectManagedWallet, type ManagedWallet } from "@/lib/managed-wallet";
import type { useBrowserWallet } from "@/lib/use-browser-wallet";
import { WalletConnectionContext } from "./WalletConnection";

type BrowserConnection = ReturnType<typeof useBrowserWallet>;
type DisconnectableWallet = ManagedWallet & { disconnect: () => void };
const chain =
  config.chainId === sepolia.id
    ? sepolia
    : defineChain({
        id: config.chainId,
        name: NETWORK_NAME,
        nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
        rpcUrls: { default: { http: config.rpc ? [config.rpc] : [] } },
        testnet: true,
      });

export default function PrivyConnection({
  appId,
  browser,
  children,
}: {
  appId: string;
  browser: BrowserConnection;
  children: ReactNode;
}) {
  return (
    <PrivyProvider
      appId={appId}
      config={{
        loginMethods: ["email", "google"],
        appearance: {
          theme: "dark",
          accentColor: "#f3df18",
          walletChainType: "ethereum-only",
          walletList: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID
            ? [
                "metamask",
                "detected_ethereum_wallets",
                "wallet_connect_qr",
                "wallet_connect",
              ]
            : ["metamask", "detected_ethereum_wallets"],
        },
        defaultChain: chain,
        supportedChains: [chain],
        embeddedWallets: {
          ethereum: { createOnLogin: "all-users" },
          showWalletUIs: true,
        },
        ...(process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID
          ? {
              walletConnectCloudProjectId:
                process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID,
            }
          : {}),
      }}
    >
      <Session browser={browser}>{children}</Session>
    </PrivyProvider>
  );
}

function Session({
  browser,
  children,
}: {
  browser: BrowserConnection;
  children: ReactNode;
}) {
  const { ready, authenticated, logout } = usePrivy();
  const { isOpen: modalOpen } = useModalStatus();
  const { wallets, ready: walletsReady } = useWallets();
  const [waitingForEmbedded, setWaitingForEmbedded] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState("");
  const operation = useRef(0);
  const authenticatedRef = useRef(authenticated);
  authenticatedRef.current = authenticated;
  const selected = useRef<DisconnectableWallet | null>(null);
  const browserRef = useRef(browser);
  browserRef.current = browser;
  useEffect(
    () => () => {
      operation.current++;
    },
    [],
  );

  const attach = useCallback(async (wallet: DisconnectableWallet) => {
    const version = ++operation.current;
    setError("");
    setConnecting(true);
    browserRef.current.disconnect();
    selected.current = null;
    try {
      const candidate = await connectManagedWallet(
        wallet,
        config.chainId,
        () =>
          version === operation.current &&
          (wallet.walletClientType !== "privy" || authenticatedRef.current),
      );
      if (version !== operation.current) return;
      await browserRef.current.connect(candidate);
      if (version !== operation.current) return;
      if (wallet.walletClientType === "privy" && !authenticatedRef.current) {
        browserRef.current.disconnect();
        return;
      }
      selected.current = wallet;
    } catch (e) {
      if (version === operation.current) setError(walletError(e));
    } finally {
      if (version === operation.current) setConnecting(false);
    }
  }, []);
  const { login } = useLogin({
    onComplete: () => setWaitingForEmbedded(true),
    onError: () => {
      setWaitingForEmbedded(false);
      setError(
        "Login was not completed. You can try again or connect a wallet.",
      );
    },
  });
  const { connectWallet } = useConnectWallet({
    onSuccess: ({ wallet }) => {
      if (wallet.type === "ethereum") void attach(wallet);
    },
    onError: () => setError("Wallet connection was not completed."),
  });
  useEffect(() => {
    if (!waitingForEmbedded) return;
    const timeout = setTimeout(() => {
      setWaitingForEmbedded(false);
      setError(
        "Wallet creation did not finish. Retry email login or connect MetaMask.",
      );
    }, 30000);
    return () => clearTimeout(timeout);
  }, [waitingForEmbedded]);
  useEffect(() => {
    if (!waitingForEmbedded || !ready || !authenticated || !walletsReady)
      return;
    const embedded = wallets.find(
      (wallet) => wallet.walletClientType === "privy",
    );
    if (!embedded) return;
    setWaitingForEmbedded(false);
    void attach(embedded);
  }, [waitingForEmbedded, ready, authenticated, walletsReady, wallets, attach]);
  useEffect(() => {
    if (!ready || !walletsReady || !selected.current) return;
    const current = selected.current;
    if (
      (current.walletClientType === "privy" && !authenticated) ||
      !wallets.some(
        (w) => w.address.toLowerCase() === current.address.toLowerCase(),
      )
    ) {
      operation.current++;
      selected.current = null;
      browserRef.current.disconnect();
      setConnecting(false);
    }
  }, [ready, walletsReady, authenticated, wallets]);

  return (
    <WalletConnectionContext.Provider
      value={{
        ...browser,
        connecting: browser.connecting || connecting || waitingForEmbedded,
        disconnect: async () => {
          operation.current++;
          const previous = selected.current;
          selected.current = null;
          setWaitingForEmbedded(false);
          setConnecting(false);
          browserRef.current.disconnect();
          if (previous?.walletClientType === "privy") await logout();
          else if (previous) await previous.disconnect();
        },
        access: {
          ready: ready && walletsReady,
          modalOpen,
          error,
          login: () => {
            setError("");
            const embedded = wallets.find(
              (w) => w.walletClientType === "privy",
            );
            if (authenticated && embedded) void attach(embedded);
            else login({ loginMethods: ["email", "google"] });
          },
          connectExternal: () => {
            setError("");
            connectWallet();
          },
        },
      }}
    >
      {children}
    </WalletConnectionContext.Provider>
  );
}
