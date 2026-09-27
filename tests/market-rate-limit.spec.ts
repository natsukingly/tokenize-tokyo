import { expect, test } from "@playwright/test";

// Opt-in against the real Sepolia deployment. Public address only: the injected
// provider cannot sign, submit transactions or authenticate an account.
test.skip(
  process.env.MARKET_RATE_LIMIT_QA !== "1",
  "Requires live Sepolia configuration",
);

test("connected portfolio loads while MultiBaas contract methods return 429", async ({
  page,
}, testInfo) => {
  let sdkReads = 0;
  let rpcReads = 0;
  const rpcFailures: number[] = [];
  if (new URL(String(testInfo.project.use.baseURL)).hostname === "127.0.0.1") {
    // Temporary QA ports are outside the deployment's CORS allowlist. Forward
    // real index responses in the test runner; the public-origin run is direct.
    await page.route(
      "https://*.multibaas.com/api/v0/queries**",
      async (route) => {
        await route.fulfill({ response: await route.fetch() });
      },
    );
  }
  await page.addInitScript(() => {
    const account = "0x83d04b1c4511fb874ebbfec6a816355d1e0f7cc8";
    const listeners: Record<string, ((...args: unknown[]) => void)[]> = {};
    const provider = {
      isMetaMask: true,
      isConnected: () => true,
      request: async ({ method }: { method: string }) => {
        if (["eth_accounts", "eth_requestAccounts"].includes(method))
          return [account];
        if (method === "eth_chainId") return "0xaa36a7";
        if (method === "net_version") return "11155111";
        if (method === "eth_getBalance") return "0x0";
        throw Object.assign(
          new Error("Read-only QA wallet: unsupported method " + method),
          { code: 4200 },
        );
      },
      on: (name: string, fn: (...args: unknown[]) => void) => {
        (listeners[name] ||= []).push(fn);
      },
      removeListener: (name: string, fn: (...args: unknown[]) => void) => {
        listeners[name] = listeners[name]?.filter((f) => f !== fn) || [];
      },
    };
    (window as any).ethereum = provider;
    const announce = () =>
      window.dispatchEvent(
        new CustomEvent("eip6963:announceProvider", {
          detail: {
            info: {
              uuid: "00000000-0000-4000-8000-000000000001",
              name: "MetaMask",
              rdns: "io.metamask",
              icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg'/>",
            },
            provider,
          },
        }),
      );
    window.addEventListener("eip6963:requestProvider", announce);
    announce();
  });
  await page.route("https://*.multibaas.com/**/methods/**", async (route) => {
    sdkReads++;
    await route.fulfill({
      status: 429,
      json: { message: "request exceeds the plan’s rate limit" },
    });
  });
  page.on("response", (response) => {
    const body = response.request().postData();
    if (body?.includes('"eth_call"')) {
      rpcReads++;
      if (!response.ok()) rpcFailures.push(response.status());
    }
  });
  await page.goto("/?view=dashboard");
  await expect(page.locator(".metrics")).toBeVisible({ timeout: 30000 });
  await page
    .getByRole("button", { name: "Connect wallet", exact: true })
    .first()
    .click();
  const external = page.getByRole("button", {
    name: "Connect MetaMask",
    exact: true,
  });
  if (await external.isVisible()) {
    await expect(external).toBeEnabled({ timeout: 20000 });
    await external.click();
  }
  await page.getByRole("button", { name: "MetaMask", exact: true }).click();
  await page
    .getByRole("button", { name: "Open My assets", exact: true })
    .click({ timeout: 30000 });
  await expect(page.locator(".section-title")).toContainText("mJPY", {
    timeout: 30000,
  });
  await expect(page.locator(".holding").first()).toBeVisible();
  await expect(
    page.getByText("Market data could not be loaded", { exact: true }),
  ).toHaveCount(0);
  await expect(page.getByText(/usage limit has been reached/)).toHaveCount(0);
  expect(sdkReads).toBe(0);
  expect(rpcReads).toBeGreaterThan(0);
  expect(rpcFailures).toEqual([]);
  await testInfo.attach("account-read-evidence", {
    body: JSON.stringify({
      sdkReads,
      rpcReads,
      rpcFailures,
      holdings: await page.locator(".holding").count(),
    }),
    contentType: "application/json",
  });
});
