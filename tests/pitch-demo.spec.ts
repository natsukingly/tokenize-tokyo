import { test, expect } from "@playwright/test";
import { DEMO_SITES } from "../src/lib/demo-catalog";

// Rehearsal uses a fresh Playwright context; it never resets the presenter's browser.
test("pitch story: one building, three scopes, rejected conflict, funded then activated", async ({
  page,
}, testInfo) => {
  test.setTimeout(120_000);
  page.setDefaultTimeout(15000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const nav = async (name: string) => {
    const close = page.getByRole("button", {
      name: "Close tokenization",
      exact: true,
    });
    if (await close.isVisible()) await close.click();
    if (name === "Tokenize") {
      await page
        .getByRole("button", { name: "Tokenize a space", exact: true })
        .click();
    } else {
      await page
        .getByRole("navigation")
        .getByRole("button", { name, exact: true })
        .click();
    }
  };
  const actor = (name: string) =>
    page.getByLabel("Demo role").selectOption(name);
  const screenshot = async (name: string) => {
    const path = testInfo.outputPath(name + ".png");
    await page.screenshot({ path });
    await testInfo.attach(name, { path, contentType: "image/png" });
  };
  const date = new Date();
  const start = date.toISOString().slice(0, 10);
  const endDate = new Date(date);
  endDate.setUTCFullYear(endDate.getUTCFullYear() + 10);
  const end = endDate.toISOString().slice(0, 10);
  const issue = async (scope: string, purpose: string) => {
    await page
      .getByRole("button", { name: "Create another right", exact: true })
      .click();
    await page
      .getByLabel("Right type", { exact: true })
      .selectOption("Usage Right");
    await page.getByLabel("Start date", { exact: true }).fill(start);
    await page.getByLabel("End date", { exact: true }).fill(end);
    await page.getByText("Terms & advanced settings", { exact: true }).click();
    await page.getByLabel("Spatial scope", { exact: true }).selectOption(scope);
    await page.getByLabel("Purpose (canonical label)").fill(purpose);
    await page
      .locator(".wizard-details[open] textarea")
      .fill(
        `Exclusive ${scope.toLowerCase()} access for ${purpose.toLowerCase()} during the stated period. Simulated terms.`,
      );
    await page.getByRole("button", { name: "Review & publish" }).click();
    await page
      .getByRole("button", { name: "Issue right", exact: true })
      .click();
    await actor("Demo verifier");
    await page
      .getByRole("button", { name: "Demo verify right", exact: true })
      .click();
    await actor("Owner A");
  };
  await page.goto("/?theme=original");
  await expect(page.getByText("SIMULATED DEMO", { exact: true })).toBeVisible();
  await actor("Owner A");
  await nav("Tokenize");
  await page.getByLabel("Working on").selectOption("1");
  // Preparation: interior and wall are verified through normal UI actions.
  await issue("Interior", "WORKSHOP");
  await issue("Wall", "ADVERTISING");
  await actor("Investor B");
  await nav("Explore");
  await page.getByRole("button", { name: "Rooftop", exact: true }).click();
  await page.getByLabel("Lifecycle filter").selectOption("Available");
  await page
    .getByRole("button", { name: "Opportunity Lens", exact: true })
    .click();
  await expect(page.locator(".lens-count")).toContainText(
    "Demo dataset · not real listings",
  );
  await expect(page.locator(".map-pin")).toHaveCount(
    DEMO_SITES.filter((s) => s.kind === "Rooftop").length,
    { timeout: 30000 },
  );
  await page.waitForTimeout(1600); // Let the map camera complete before capturing evidence.
  await screenshot("pitch-discover");
  await page.getByRole("button", { name: "City X-ray", exact: true }).click();
  await expect(
    page.getByText("URBAN RIGHTS / X-RAY", { exact: true }),
  ).toBeVisible();
  await screenshot("pitch-xray");

  await actor("Owner A");
  await nav("Tokenize");
  await page.getByLabel("Working on").selectOption("1");
  await issue("Rooftop", "SOLAR");
  await page
    .getByRole("button", { name: "Create another right", exact: true })
    .click();
  await page.getByText("Terms & advanced settings", { exact: true }).click();
  await page.getByLabel("Purpose (canonical label)").fill("RESTAURANT");
  await page.getByRole("button", { name: "Review & publish" }).click();
  await page.getByRole("button", { name: "Issue right", exact: true }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "Spatial Right Conflict" }),
  ).toBeVisible();
  await screenshot("pitch-conflict");

  await actor("Investor B");
  await nav("Explore");
  await page.getByLabel("Lifecycle filter").selectOption("All stages");
  await page
    .getByRole("button", { name: "Explore Nihonbashi Solar Roof", exact: true })
    .click();
  await page.getByLabel("I have reviewed the rights and their terms.").check();
  await page.getByLabel("Purchase quantity").fill("100");
  await page
    .getByRole("button", { name: "Acquire right", exact: true })
    .click();
  await expect(page.locator(".asset-detail .badges")).toContainText("Funded");
  await expect(page.locator(".asset-detail .badges")).not.toContainText(
    "Active",
  );
  await screenshot("pitch-funded");

  await actor("Demo verifier");
  await nav("Tokenize");
  await page.getByLabel("Working on").selectOption("1");
  await page.getByLabel("Manage right").selectOption("1");
  await page
    .getByRole("button", { name: "Activate project", exact: true })
    .click();
  await nav("Explore");
  await expect(page.locator(".asset-detail .badges")).toContainText("Active");
  await expect(
    page.getByText("URBAN RIGHTS / X-RAY", { exact: true }),
  ).toBeVisible();
  await page.waitForTimeout(1600);
  await screenshot("pitch-activated");
  const store = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("tokenize-tokyo-demo-v2") || "{}"),
  );
  const scoped = store.events.filter(
    (e: { name: string; args: { assetId: string } }) =>
      e.name === "RightScopeDefined" && e.args.assetId === "1",
  );
  expect(
    new Set(scoped.map((e: { args: { scope: number } }) => e.args.scope)),
  ).toEqual(new Set([0, 1, 2]));
  expect(
    store.events.filter((e: { name: string }) => e.name === "RightCreated"),
  ).toHaveLength(DEMO_SITES.length + 3); // Rejected restaurant never issued.
  expect(errors).toEqual([]);
});
