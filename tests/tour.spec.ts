import { expect, test } from "@playwright/test";

const guide = (page: import("@playwright/test").Page) =>
  page.getByRole("region", { name: "Quick tour", exact: true });
test("demo purchase tour follows a real simulation action and remains restartable", async ({
  page,
}) => {
  await page.goto("/demo?tour=1");
  await expect(
    page.getByRole("button", {
      name: "Explore Nihonbashi Solar Roof",
      exact: true,
    }),
  ).toBeVisible();
  await guide(page)
    .getByRole("button", { name: "Buy a right", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Explore Nihonbashi Solar Roof", exact: true })
    .click();
  await guide(page)
    .getByRole("button", { name: "Inspect right", exact: true })
    .click();
  await expect(
    guide(page).getByRole("button", { name: "View My assets", exact: true }),
  ).toBeDisabled();
  await page.getByLabel("I have reviewed the rights and their terms.").check();
  await page
    .getByRole("button", { name: "Acquire right", exact: true })
    .click();
  await guide(page)
    .getByRole("button", { name: "View My assets", exact: true })
    .click();
  await expect(page.locator(".holding")).toContainText("1 units held");
  await expect(guide(page)).toContainText(
    "ENS space names · unregistered preview",
  );
  await guide(page)
    .getByRole("button", { name: "Finish tour", exact: true })
    .click();
  await expect(guide(page)).toHaveCount(0);
  await expect(page.locator(".guide-target")).toHaveCount(0);
  await page.getByRole("button", { name: "Quick tour", exact: true }).click();
  await expect(
    guide(page).getByRole("button", { name: "List my space", exact: true }),
  ).toBeVisible();
});

test("demo owner tour reaches the Funding campaign after separate asset and right review", async ({
  page,
}) => {
  await page.goto("/demo?tour=1");
  await expect(
    page.getByRole("button", {
      name: "Explore Nihonbashi Solar Roof",
      exact: true,
    }),
  ).toBeVisible();
  await guide(page)
    .getByRole("button", { name: "List my space", exact: true })
    .click();
  await page
    .getByLabel("Asset name", { exact: true })
    .fill("Quick tour solar project");
  await page
    .getByRole("button", { name: "Continue to rights", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Review & publish", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Register demo asset", exact: true })
    .click();
  await guide(page)
    .getByRole("button", { name: "Continue", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Submit for verification", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Switch to Demo verifier", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Demo verify asset", exact: true })
    .click();
  await guide(page)
    .getByRole("button", { name: "Continue", exact: true })
    .click();
  await page.getByRole("button", { name: "Issue right", exact: true }).click();
  await page
    .getByRole("button", { name: "Switch to Demo verifier", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Demo verify right", exact: true })
    .click();
  await guide(page)
    .getByRole("button", { name: "Continue", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Launch crowdfunding", exact: true })
    .click();
  await guide(page)
    .getByRole("button", { name: "View Funding", exact: true })
    .click();
  await expect(
    page.getByRole("tab", { name: "Funding", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await expect(guide(page)).toContainText(
    "Funding does not automatically activate",
  );
  await guide(page)
    .getByRole("button", { name: "Finish tour", exact: true })
    .click();
});

test("live mobile tour handles wallet onboarding without signing and ignores historical purchases", async ({
  page,
}) => {
  test.skip(
    process.env.RUN_TOUR_LIVE_QA !== "1",
    "Requires the live Curvegrid read configuration",
  );
  test.setTimeout(90000);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => {
    let chain = "0x1";
    const listeners: Record<string, ((...args: unknown[]) => void)[]> = {};
    (window as any).ethereum = {
      request: async ({
        method,
        params,
      }: {
        method: string;
        params: any[];
      }) => {
        if (method === "eth_requestAccounts" || method === "eth_accounts")
          return ["0xB0487691ac366Ef2F0b932151C5CC5c5D2b98Ba4"];
        if (method === "eth_chainId") return chain;
        if (method === "wallet_switchEthereumChain") {
          chain = params[0].chainId;
          return null;
        }
        if (method === "eth_getBalance") return "0xde0b6b3a7640000";
        throw new Error("Read-only tour QA does not allow signing: " + method);
      },
      on: (name: string, fn: (...args: unknown[]) => void) => {
        (listeners[name] ||= []).push(fn);
      },
      removeListener: (name: string, fn: (...args: unknown[]) => void) => {
        listeners[name] = listeners[name]?.filter((f) => f !== fn) || [];
      },
    };
    (window as any).__disconnectTourWallet = () =>
      listeners.accountsChanged?.forEach((fn) => fn([]));
  });
  await page.goto("/?tour=1");
  await expect(
    page.getByRole("button", {
      name: "Explore Nihonbashi Solar Roof · Demo",
      exact: true,
    }),
  ).toBeVisible({ timeout: 60000 });
  await guide(page)
    .getByRole("button", { name: "Buy a right", exact: true })
    .click();
  await expect(guide(page)).toContainText("1 / 7");
  await expect(
    guide(page).getByRole("button", { name: "Continue", exact: true }),
  ).toBeDisabled();
  await page
    .getByRole("button", { name: "Browser wallet", exact: true })
    .click();
  await guide(page)
    .getByRole("button", { name: "Continue", exact: true })
    .click();
  await expect(guide(page)).toContainText("Get test gas");
  const panel = await guide(page).boundingBox();
  const target = await page.locator('[data-tour="test-gas"]').boundingBox();
  expect(panel && target && panel.y >= target.y + target.height).toBeTruthy();
  await page.screenshot({ path: ".data/tour-wallet-mobile.png" });
  await guide(page)
    .getByRole("button", { name: "Continue", exact: true })
    .click();
  await expect(guide(page)).toContainText("Get MockJPY");
  await expect(
    guide(page).getByRole("button", { name: "Continue", exact: true }),
  ).toBeEnabled({ timeout: 60000 });
  await guide(page)
    .getByRole("button", { name: "Continue", exact: true })
    .click();
  await expect(
    page.getByRole("dialog", { name: "Your account", exact: true }),
  ).not.toBeVisible();
  await page
    .getByRole("button", {
      name: "Explore Nihonbashi Solar Roof · Demo",
      exact: true,
    })
    .click();
  await guide(page)
    .getByRole("button", { name: "Inspect right", exact: true })
    .click();
  await expect(guide(page)).toContainText(
    "confirm payment approval and purchase",
  );
  await expect(
    guide(page).getByRole("button", { name: "Check transaction", exact: true }),
  ).toBeDisabled();
  await page.evaluate(() => (window as any).__disconnectTourWallet());
  await expect(guide(page)).toContainText("Your wallet changed");
  await expect(
    guide(page).getByRole("button", { name: "Check transaction", exact: true }),
  ).toBeDisabled();
  await guide(page)
    .getByRole("button", { name: "Close tour", exact: true })
    .click();
  await expect(page.locator(".guide-target")).toHaveCount(0);
});

for (const viewport of [
  { width: 1512, height: 1050 },
  { width: 390, height: 844 },
]) {
  test(`Quick tour starts in a centered welcome modal at ${viewport.width}px`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await page.goto("/demo?view=dashboard");
    await page
      .getByRole("navigation")
      .getByRole("button", { name: "Quick tour", exact: true })
      .click();
    const welcome = page.getByRole("dialog", {
      name: "Welcome to TOKENIZE TOKYO",
    });
    await expect(welcome).toBeVisible();
    await expect(welcome.getByRole("heading")).toBeFocused();
    const box = (await welcome.boundingBox())!;
    expect(Math.abs(box.x + box.width / 2 - viewport.width / 2)).toBeLessThan(
      2,
    );
    expect(Math.abs(box.y + box.height / 2 - viewport.height / 2)).toBeLessThan(
      2,
    );
    await expect(page.locator(".guide-target")).toHaveCount(0);
    await page.keyboard.press("Escape");
    await expect(welcome).toHaveCount(0);
    await page
      .getByRole("navigation")
      .getByRole("button", { name: "Quick tour", exact: true })
      .click();
    await welcome
      .getByRole("button", { name: "Buy a right", exact: true })
      .click();
    await expect(welcome).toHaveCount(0);
    await expect(guide(page)).toContainText("Find a space");
    await expect(page.getByLabel("Filters", { exact: true })).toHaveClass(
      /guide-target/,
    );
  });
}
