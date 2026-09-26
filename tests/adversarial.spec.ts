import { test, expect, type Page } from "@playwright/test";
test.setTimeout(45000);
test.beforeEach(({ page }) => {
  page.setDefaultTimeout(10000);
});

async function nav(page: Page, name: string) {
  await page
    .getByRole("navigation")
    .getByRole("button", {
      name: name === "Compose" ? /^Compose(?:\s*NEW)?$/ : name,
      exact: true,
    })
    .click();
}
async function purchase(page: Page) {
  await page.goto("/demo");
  await page.getByLabel("Demo role").selectOption("Investor B");
  await nav(page, "Markets");
  await page
    .getByLabel("Find a space", { exact: true })
    .fill("Akihabara Parking Bay");
  await page.getByRole("button", { name: /^View details for/ }).click();
  return page.getByRole("dialog");
}

test("invalid quantities and rapid clicks cannot purchase more than one remaining right", async ({
  page,
}) => {
  const dialog = await purchase(page);
  await dialog.getByLabel("I have reviewed this right and its terms.").check();
  const buy = dialog.getByRole("button", {
    name: "Acquire right",
    exact: true,
  });
  for (const value of [
    "0",
    "-1",
    "0.5",
    "2",
    "1000000000000000000000000",
    "1e2",
    "",
  ]) {
    await dialog.getByLabel("Purchase quantity").fill(value);
    await expect(buy, `quantity ${value}`).toBeDisabled();
  }
  await dialog.getByLabel("Purchase quantity").fill("1");
  await expect(buy).toBeEnabled();
  const before = await page.evaluate(
    () =>
      JSON.parse(localStorage.getItem("tokenize-tokyo-demo-v2")!).events.filter(
        (event: { name: string }) => event.name === "ListingPurchased",
      ).length,
  );
  await buy.evaluate((button: HTMLButtonElement) => {
    button.click();
    button.click();
    button.click();
  });
  await expect(dialog).toContainText("You hold 1 unit");
  const after = await page.evaluate(
    () =>
      JSON.parse(localStorage.getItem("tokenize-tokyo-demo-v2")!).events.filter(
        (event: { name: string }) => event.name === "ListingPurchased",
      ).length,
  );
  expect(after - before).toBe(1);
});

test("asset creation rejects negative and empty area before reaching rights", async ({
  page,
}) => {
  await page.goto("/demo");
  await page
    .getByRole("button", { name: "Tokenize a space", exact: true })
    .click();
  const dialog = page.getByRole("dialog", {
    name: "Tokenize a space",
    exact: true,
  });
  await dialog.getByLabel("Asset name", { exact: true }).fill("Boundary roof");
  await dialog.getByText("Location details", { exact: false }).click();
  for (const area of ["-1", "0", ""]) {
    await dialog.getByLabel("Area (m², simulated)").fill(area);
    await dialog.getByRole("button", { name: "Continue to rights" }).click();
    await expect(dialog.getByRole("alert")).toContainText(/area/i);
  }
});

test("right review rejects a supply beyond the supported limit", async ({
  page,
}) => {
  await page.goto("/demo");
  await page
    .getByRole("button", { name: "Tokenize a space", exact: true })
    .click();
  const dialog = page.getByRole("dialog", {
    name: "Tokenize a space",
    exact: true,
  });
  await dialog
    .getByLabel("Asset name", { exact: true })
    .fill("Oversized supply roof");
  await dialog.getByRole("button", { name: "Continue to rights" }).click();
  await dialog
    .getByLabel("Right type", { exact: true })
    .selectOption("Revenue Share");
  await dialog.getByLabel("Right supply").fill("1000000000001");
  await dialog.getByRole("button", { name: "Review & publish" }).click();
  await expect(dialog.getByRole("alert")).toContainText(/supply/i);
});

test("malformed saved demo data recovers without trapping the user in a connection error", async ({
  page,
}) => {
  await page.addInitScript(() =>
    localStorage.setItem(
      "tokenize-tokyo-demo-v2",
      JSON.stringify({
        catalogVersion: 999,
        events: null,
        balances: {},
        cash: {},
        claims: {},
      }),
    ),
  );
  await page.goto("/demo");
  await nav(page, "Markets");
  await expect(
    page.getByRole("region", { name: "Asset directory" }),
  ).toBeVisible();
  await expect(page.locator("tbody tr").first()).toBeVisible();
  await expect(
    page.getByText("Check your connection and try again.", { exact: false }),
  ).toHaveCount(0);
});

test("malformed finance entries cannot crash the market or its other tabs", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.addInitScript(() =>
    localStorage.setItem(
      "tokenize-tokyo-finance-lab-v1",
      JSON.stringify({
        version: 1,
        offers: [null],
        positions: [],
        resales: [],
        rentals: [],
        cash: 1000,
      }),
    ),
  );
  await page.goto("/demo");
  await nav(page, "Markets");
  await page.getByRole("tab", { name: "Fractional", exact: false }).click();
  await expect(
    page.getByRole("tab", { name: "Fractional", exact: false }),
  ).toHaveAttribute("aria-selected", "true");
  await page.getByRole("tab", { name: "All assets", exact: true }).click();
  await expect(page.getByLabel("Find a space")).toBeVisible();
  expect(errors).toEqual([]);
});

test("320px navigation and coming-soon lending stay usable through repeated tab switches", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 740 });
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/demo");
  for (const name of [
    "Dashboard",
    "Markets",
    "ENS Index",
    "My assets",
    "Compose",
    "Explore",
    "Markets",
  ]) {
    await nav(page, name);
    await expect
      .poll(
        () =>
          page.evaluate(
            () => document.documentElement.scrollWidth - innerWidth,
          ),
        { message: `overflow on ${name}` },
      )
      .toBeLessThanOrEqual(1);
  }
  await page.getByRole("tab", { name: /Lending/ }).click();
  await expect(
    page.getByRole("button", { name: "Lending — coming soon", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Borrowing — coming soon", exact: true }),
  ).toBeDisabled();
  expect(errors).toEqual([]);
});

test("checkout handles a non-JSON outage and can retry without pretending payment succeeded", async ({
  page,
}) => {
  const id = "fde9ed92-8d7f-480f-8ef6-77d104fe6600";
  let fail = true;
  await page.route(`**/api/card-checkout/orders/${id}`, (route) =>
    fail
      ? route.fulfill({
          status: 502,
          contentType: "text/html",
          body: "<h1>Bad Gateway</h1>",
        })
      : route.fulfill({
          json: {
            id,
            state: "awaiting_payment",
            txHash: null,
            recipient: `0x${"b".repeat(40)}`,
            quantity: "2",
            amountJpy: 200,
            chainId: 11155111,
          },
        }),
  );
  await page.goto(`/checkout/${id}`);
  await expect(
    page
      .getByRole("region", { name: "Card purchase status" })
      .getByRole("alert"),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Your rights have arrived" }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("status", { name: "Loading progress" }),
  ).toHaveCount(0);
  fail = false;
  await page.getByRole("button", { name: "Check payment & delivery" }).click();
  await expect(
    page.getByRole("heading", { name: "Waiting for test payment" }),
  ).toBeVisible();
});

test("invalid transaction and checkout deep links render not-found instead of a client crash", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  for (const url of ["/tx/not-a-hash", "/checkout/not-an-order"]) {
    const response = await page.goto(url);
    expect(response?.status()).toBe(404);
    await expect(page.getByText("This page could not be found.")).toBeVisible();
  }
  expect(errors).toEqual([]);
});

test("a stalled checkout status request releases the loading state and permits retry", async ({
  page,
}) => {
  const id = "fde9ed92-8d7f-480f-8ef6-77d104fe6600";
  await page.clock.install();
  await page.route(
    `**/api/card-checkout/orders/${id}`,
    () => new Promise(() => {}),
  );
  const request = page.waitForRequest(`**/api/card-checkout/orders/${id}`);
  await page.goto(`/checkout/${id}`, { waitUntil: "domcontentloaded" });
  await request;
  await page.clock.fastForward(31000);
  await expect(
    page
      .getByRole("region", { name: "Card purchase status" })
      .getByRole("alert"),
  ).toContainText(/timed out|try again/i);
  await expect(
    page.getByRole("button", { name: "Check payment & delivery" }),
  ).toBeEnabled();
  await expect(
    page.getByRole("status", { name: "Loading progress" }),
  ).toHaveCount(0);
});

test("an invalid checkout response shows an error rather than crashing or confirming delivery", async ({
  page,
}) => {
  const id = "fde9ed92-8d7f-480f-8ef6-77d104fe6600";
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route(`**/api/card-checkout/orders/${id}`, (route) =>
    route.fulfill({ json: { id, state: "unknown" } }),
  );
  await page.goto(`/checkout/${id}`);
  await expect(
    page
      .getByRole("region", { name: "Card purchase status" })
      .getByRole("alert"),
  ).toContainText(/check|response|try again/i);
  await expect(
    page.getByRole("heading", { name: "Your rights have arrived" }),
  ).toHaveCount(0);
  expect(errors).toEqual([]);
});
