import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "contract-e2e",
  workers: 1,
  timeout: 180000,
  use: {
    channel: "chromium",
    baseURL: process.env.FINANCE_APP_URL,
    viewport: { width: 1440, height: 1000 },
    screenshot: "only-on-failure",
  },
  outputDir: ".data/finance-e2e/results",
});
