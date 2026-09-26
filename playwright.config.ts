import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "tests",
  // Account tests need a MultiBaas-mode app; run them with their isolated fixture config.
  testIgnore: ["**/account-access.spec.ts"],
  // End-to-end issuance scenarios project the expanded 265-space demo after each action.
  timeout: 120000,
  workers: process.env.CI ? 2 : undefined,
  use: {
    // Full Chromium's headless mode keeps WebGL map interactions responsive.
    channel: "chromium",
    baseURL: process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:3000",
    viewport: { width: 1512, height: 1050 },
    screenshot: "only-on-failure",
  },
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : {
        command: "npm run dev -- --port 3000",
        url: "http://127.0.0.1:3000",
        reuseExistingServer: true,
      },
});
