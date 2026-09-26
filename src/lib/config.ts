export const config = {
  mode: process.env.NEXT_PUBLIC_APP_MODE === "multibaas" ? "multibaas" : "demo",
  url: process.env.NEXT_PUBLIC_MULTIBAAS_URL || "",
  key: process.env.NEXT_PUBLIC_MULTIBAAS_DAPP_KEY || "",
  chainId: Number(process.env.NEXT_PUBLIC_CHAIN_ID || 31337),
  rpc: process.env.NEXT_PUBLIC_RPC_URL || "",
  addresses: {
    registry: process.env.NEXT_PUBLIC_REGISTRY_ADDRESS || "",
    rights: process.env.NEXT_PUBLIC_RIGHTS_ADDRESS || "",
    market: process.env.NEXT_PUBLIC_MARKET_ADDRESS || "",
    revenue: process.env.NEXT_PUBLIC_REVENUE_ADDRESS || "",
    basket: process.env.NEXT_PUBLIC_BASKET_ADDRESS || "",
    settlement: process.env.NEXT_PUBLIC_SETTLEMENT_ADDRESS || "",
  },
} as const;
export type ContractKey = keyof typeof config.addresses;
export const labels: Record<ContractKey, string> = {
  registry: "urbanassetregistry",
  rights: "urbanrighttoken",
  market: "urbanmarketplace",
  revenue: "revenuevault",
  basket: "basketvault",
  settlement: "mockjpy",
};
