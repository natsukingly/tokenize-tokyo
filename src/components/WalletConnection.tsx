"use client";
import { createContext, useContext, type ReactNode } from "react";
import dynamic from "next/dynamic";
import { useBrowserWallet } from "@/lib/use-browser-wallet";

export type WalletConnection = Omit<
  ReturnType<typeof useBrowserWallet>,
  "disconnect"
> & {
  disconnect: () => void | Promise<void>;
  access?: {
    ready: boolean;
    login: () => void;
    connectExternal: () => void;
    error: string;
  };
};
export const WalletConnectionContext = createContext<WalletConnection | null>(
  null,
);
const PrivyConnection = dynamic(() => import("./PrivyConnection"), {
  ssr: false,
  loading: () => <p role="status">Loading account services…</p>,
});

export function WalletConnectionProvider({
  enabled,
  children,
}: {
  enabled: boolean;
  children: ReactNode;
}) {
  const browser = useBrowserWallet(enabled);
  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID?.trim();
  if (enabled && appId)
    return (
      <PrivyConnection appId={appId} browser={browser}>
        {children}
      </PrivyConnection>
    );
  return (
    <WalletConnectionContext.Provider value={browser}>
      {children}
    </WalletConnectionContext.Provider>
  );
}

export function useWalletConnection() {
  const wallet = useContext(WalletConnectionContext);
  if (!wallet) throw new Error("Wallet connection provider is missing.");
  return wallet;
}
