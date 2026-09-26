import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "tests",
  testMatch: "account-access.spec.ts",
  workers: 1,
  timeout: 60000,
  use: {
    baseURL: "http://127.0.0.1:3211",
    viewport: { width: 1512, height: 1050 },
    screenshot: "only-on-failure",
  },
  outputDir: ".data/account-e2e/results",
  webServer: {
    command: "npm run dev -- --port 3211",
    url: "http://127.0.0.1:3211",
    reuseExistingServer: false,
    env: {
      TOKENIZE_NEXT_DIST_DIR: ".data/account-e2e/next",
      NEXT_PUBLIC_APP_MODE: "multibaas",
      NEXT_PUBLIC_MULTIBAAS_URL: "https://fixture.multibaas.com",
      NEXT_PUBLIC_MULTIBAAS_DAPP_KEY: "fixture-read-only",
      NEXT_PUBLIC_CHAIN_ID: "2017072401",
      NEXT_PUBLIC_RPC_URL: "http://127.0.0.1:1",
      NEXT_PUBLIC_PRIVY_APP_ID: "",
      NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID: "",
      ...Object.fromEntries(
        ["REGISTRY", "RIGHTS", "MARKET", "REVENUE", "BASKET", "SETTLEMENT"].map(
          (name, i) => [
            `NEXT_PUBLIC_${name}_ADDRESS`,
            `0x${String(i + 1).padStart(40, "0")}`,
          ],
        ),
      ),
    },
  },
});
