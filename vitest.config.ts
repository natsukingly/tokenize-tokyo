import { resolve } from "node:path";
import { defineConfig } from "vitest/config";
export default defineConfig({
  resolve: { alias: { "@": resolve(process.cwd(), "src") } },
  test: {
    include: ["src/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: [
        "src/lib/webhook.ts",
        "src/lib/finance-lab.ts",
        "src/lib/catalog.ts",
        "src/lib/queries.ts",
        "src/lib/projection.ts",
        "src/lib/transactions.ts",
        "src/lib/rights-finance.ts",
        "src/lib/managed-wallet.ts",
        "src/server/cloud-wallet-setup.ts",
      ],
      thresholds: { lines: 80, functions: 80, statements: 80, branches: 80 },
    },
  },
});
