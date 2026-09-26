import { test, expect } from "@playwright/test";

test("initial fetch shows a loader instead of empty dashboards or asset lists", async ({
  page,
}) => {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("https://*.multibaas.com/api/v0/**", async (route) => {
    await gate;
    await route.fulfill({
      json: { status: 200, message: "success", result: { rows: [] } },
    });
  });
  await page.goto("/?view=dashboard");
  await expect(
    page.getByText("Loading market data…", { exact: true }),
  ).toBeVisible();
  await expect(page.locator(".metrics")).toHaveCount(0);
  await expect(
    page.getByRole("region", { name: "Market analysis" }),
  ).toHaveCount(0);
  await page
    .locator(".sidebar nav")
    .getByRole("button", { name: "Markets", exact: true })
    .click();
  await expect(
    page.getByText("Loading market data…", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("tab", { name: "Funding", exact: true }),
  ).toHaveCount(0);
  await page
    .locator(".sidebar nav")
    .getByRole("button", { name: "Dashboard", exact: true })
    .click();
  release();
  await expect(
    page.getByText("Loading market data…", { exact: true }),
  ).toHaveCount(0);
  await expect(page.locator(".metrics")).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Market analysis" }),
  ).toBeVisible();
});

test("guest enters My assets through wallet connection and account changes clear the previous balance", async ({
  page,
}) => {
  const first = "0x1111111111111111111111111111111111111111";
  const second = "0x2222222222222222222222222222222222222222";
  await page.addInitScript(
    ({ first }) => {
      let account = first;
      const listeners: Record<string, ((...args: unknown[]) => void)[]> = {};
      (window as any).ethereum = {
        request: async ({ method }: { method: string }) => {
          if (["eth_accounts", "eth_requestAccounts"].includes(method))
            return [account];
          if (method === "eth_chainId") return "0x783a1511";
          if (method === "eth_getBalance") return "0xde0b6b3a7640000";
          throw new Error(
            "This account UI test cannot sign or send transactions.",
          );
        },
        on: (name: string, fn: (...args: unknown[]) => void) => {
          (listeners[name] ||= []).push(fn);
        },
        removeListener: (name: string, fn: (...args: unknown[]) => void) => {
          listeners[name] = listeners[name]?.filter((f) => f !== fn) || [];
        },
      };
      (window as any).__changeAccount = (next: string) => {
        account = next;
        listeners.accountsChanged?.forEach((fn) => fn(next ? [next] : []));
      };
    },
    { first },
  );
  await page.route("https://*.multibaas.com/api/v0/**", async (route) => {
    const body = route.request().postDataJSON();
    let result: unknown;
    if (body?.events) result = { rows: [] };
    else {
      const method = new URL(route.request().url()).pathname.split("/").at(-1);
      if (method === "balanceOf" && body.args[0] === second)
        await new Promise((r) => setTimeout(r, 700));
      result = {
        kind: "MethodCallResponse",
        output:
          method === "balanceOf"
            ? body.args[0] === first
              ? "123000000000000000000"
              : "7000000000000000000"
            : false,
      };
    }
    await route.fulfill({ json: { status: 200, message: "success", result } });
  });
  await page.goto("/");
  await page
    .locator(".sidebar nav")
    .getByRole("button", { name: "My assets", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Your assets, in one place" }),
  ).toBeVisible();
  await expect(page.getByLabel("Resale / redeem quantity")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Connect wallet to continue" })
    .click();
  await page
    .getByRole("button", { name: "Browser wallet", exact: true })
    .click();
  await page.getByRole("button", { name: "Open My assets" }).click();
  await expect(page.locator(".section-title")).toContainText("123 mJPY");
  await page.getByLabel("Resale / redeem quantity").fill("9");
  await page.evaluate(
    (address) => (window as any).__changeAccount(address),
    second,
  );
  await expect(
    page.getByRole("region", { name: "Account access" }),
  ).toBeVisible();
  await expect(page.locator(".section-title")).toHaveCount(0);
  await expect(page.locator(".section-title")).toContainText("7 mJPY");
  await expect(page.getByLabel("Resale / redeem quantity")).toHaveValue("1");
  await page.evaluate(() => (window as any).__changeAccount(""));
  await expect(
    page.getByRole("heading", { name: "Your assets, in one place" }),
  ).toBeVisible();
  await expect(page.locator(".section-title")).toHaveCount(0);
});

test("populated demo shows historical analytics, a mixed basket and a clear custody preview", async ({
  page,
}) => {
  await page.goto("/demo?view=dashboard&sample=1");
  await expect(
    page.getByRole("img", { name: "Twenty-four-hour volume in mJPY" }),
  ).toBeVisible();
  await page
    .getByRole("combobox", { name: "Activity period" })
    .selectOption("weekly");
  await expect(
    page.getByRole("img", { name: "Four-week volume in mJPY" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "View sample holdings" }).click();
  await expect(
    page.locator(".holding").filter({ hasText: "Tokyo Mixed Income Basket" }),
  ).toContainText("8 units held");
  await page
    .locator(".sidebar nav")
    .getByRole("button", { name: /^Compose/ })
    .click();
  const basket = page.locator("article.basket-pool").filter({
    has: page.getByText("Add your rights to this basket", { exact: true }),
  });
  await expect(basket).toContainText("Example · Akihabara Parking Income");
  await basket
    .getByText("Add your rights to this basket", { exact: true })
    .click();
  await basket.getByLabel("Shares to receive").fill("2");
  await expect(basket).toContainText("2 needed");
  await basket
    .getByRole("button", { name: "Deposit rights & receive shares" })
    .click();
  await page
    .locator(".sidebar nav")
    .getByRole("button", { name: "My assets", exact: true })
    .click();
  await expect(
    page.locator(".holding").filter({ hasText: "Tokyo Mixed Income Basket" }),
  ).toContainText("10 units held");
});
