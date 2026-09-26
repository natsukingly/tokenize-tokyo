import { expect, test } from "@playwright/test";
import { PITCH_EVIDENCE } from "../src/lib/pitch-tour";

test("ordinary owner tutorial keeps its unfilled form", async ({ page }) => {
  await page.goto("/demo?tour=1");
  const welcome = page.getByRole("dialog", { name: "Welcome to TOKENIZE TOKYO" });
  await welcome.getByRole("button", { name: "List my space", exact: true }).click();
  await expect(page.getByLabel("Asset name", { exact: true })).toHaveValue("");
  await expect(page.getByRole("region", { name: "Quick tour", exact: true })).toContainText("Define your space");
  await expect(page.getByRole("region", { name: "Finalist demo", exact: true })).toHaveCount(0);
});

test("finalist pitch runs without typing and preserves the demo between slides and evidence", async ({
  page,
  context,
}) => {
  await context.route("https://sepolia.etherscan.io/**", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: "<h1>Explorer test destination</h1>",
    }),
  );
  await page.goto("/present");
  await expect(
    page.getByRole("navigation", { name: "Presentation controls" }),
  ).toBeHidden();
  await expect(page.getByAltText("Tokyo's vacant homes")).toBeVisible();
  for (let i = 0; i < 4; i++) await page.keyboard.press("ArrowRight");
  const frame = page.frameLocator('iframe[title="Guided Tokenize Tokyo demo"]');
  const guide = frame.getByRole("region", {
    name: "Finalist demo",
    exact: true,
  });
  const action = (name: string) =>
    frame.getByRole("button", { name, exact: true }).click();
  const next = () =>
    guide.getByRole("button", { name: "Continue", exact: true }).click();
  await guide.getByRole("button", { name: "Start guided demo" }).click();
  await guide.getByRole("button", { name: "Open prepared project" }).click();
  await expect(frame.getByLabel("Asset name", { exact: true })).toHaveValue(
    "Tokyo Home Solar Roof · Pitch",
  );
  await frame.getByLabel("Asset name", { exact: true }).press("Alt+3");
  await expect(page.locator('iframe[title="Tokenize Tokyo architecture"]')).toHaveAttribute("data-visible", "true");
  const architecture = page.frameLocator('iframe[title="Tokenize Tokyo architecture"]');
  await expect(architecture.getByRole("heading", { name: "RWA Tokenization Platform" })).toBeVisible();
  await page.keyboard.press("ArrowRight");
  await expect(architecture.locator("#caption")).toContainText("Structure + launch");
  await page.keyboard.press("p");
  await page.keyboard.press("d");
  await expect(page.locator('iframe[title="Guided Tokenize Tokyo demo"]')).toHaveAttribute("data-visible", "true");
  await expect(frame.getByLabel("Asset name", { exact: true })).toHaveValue(
    "Tokyo Home Solar Roof · Pitch",
  );
  await frame.getByLabel("Asset name", { exact: true }).press("Alt+3");
  await expect(architecture.locator("#caption")).toContainText("Structure + launch");
  await expect(architecture.locator("#play")).toHaveText("Play · P");
  await page.keyboard.press("d");
  await frame.getByLabel("Asset name", { exact: true }).press("Alt+1");
  await expect(page.getByAltText("So we built Tokenize Tokyo")).toBeVisible();
  await page.keyboard.press("Alt+2");
  await expect(frame.getByLabel("Asset name", { exact: true })).toHaveValue(
    "Tokyo Home Solar Roof · Pitch",
  );
  await action("Continue to rights");
  await expect(
    frame.getByLabel("Primary price (mJPY)", { exact: true }),
  ).toHaveValue("1000");
  await expect(frame.getByLabel("Right supply", { exact: true })).toHaveValue(
    "100",
  );
  await action("Review & publish");
  await action("Register demo asset");
  await expect(
    guide.getByRole("button", { name: "Continue", exact: true }),
  ).toBeDisabled();
  await action("Submit for verification");
  await next();
  await expect(frame.getByLabel("Demo role", { exact: true })).toHaveValue(
    "Demo verifier",
  );
  await action("Demo verify asset");
  await next();
  await action("Issue right");
  await next();
  await action("Demo verify right");
  await next();
  await expect(frame.getByLabel("Units to offer")).toHaveValue("100");
  await action("Launch crowdfunding");
  await next();
  await expect(
    frame.getByLabel("Purchase quantity", { exact: true }),
  ).toHaveValue("10");
  await expect(
    guide.getByRole("button", { name: "Continue", exact: true }),
  ).toBeDisabled();
  await frame.getByLabel("I have reviewed the rights and their terms.").check();
  await action("Acquire right");
  await expect(
    guide.getByRole("button", { name: "Continue", exact: true }),
  ).toBeEnabled();
  await guide.getByRole("button", { name: "Continue", exact: true }).press("s");
  await expect(page.getByAltText("So we built Tokenize Tokyo")).toBeVisible();
  await page.keyboard.press("ArrowLeft");
  await expect(
    page.getByAltText("Assets missing from investment listings"),
  ).toBeVisible();
  await page.keyboard.press("d");
  await expect(guide.getByRole("heading")).toHaveText(
    "A different person participates",
  );
  await expect(
    guide.getByRole("button", { name: "Continue", exact: true }),
  ).toBeEnabled();
  const purchaseProof = guide.getByRole("link", {
    name: "Open Sepolia purchase",
  });
  await expect(purchaseProof).toHaveAttribute(
    "href",
    `https://sepolia.etherscan.io/tx/${PITCH_EVIDENCE.purchase.hash}`,
  );
  const popupPromise = page.waitForEvent("popup");
  await purchaseProof.click();
  const popup = await popupPromise;
  await popup.waitForLoadState();
  expect(popup.url()).toContain(PITCH_EVIDENCE.purchase.hash);
  await popup.close();
  await next();
  await action("Activate project");
  await next();
  await expect(frame.getByLabel("Revenue deposit amount (mJPY)")).toHaveValue(
    "10000",
  );
  await action("Deposit revenue");
  await next();
  const holding = frame
    .locator(".holding")
    .filter({ hasText: "Tokyo Home Solar Roof · Pitch" });
  await expect(holding).toContainText("10 units held");
  await expect(holding).toContainText("1,000 mJPY claimable");
  await holding
    .getByRole("button", { name: "Claim revenue", exact: true })
    .click();
  await expect(holding).toContainText("0 mJPY claimable");
  await next();
  await expect(frame.getByLabel("Resale / redeem quantity")).toHaveValue("2");
  await expect(frame.getByLabel("Resale price per unit (mJPY)")).toHaveValue(
    "1000",
  );
  await holding
    .getByRole("button", { name: "List for resale", exact: true })
    .click();
  await expect(holding).toContainText("10 units held");
  await next();
  await expect(
    frame.getByRole("heading", { name: "Market activity", exact: true }),
  ).toBeVisible();
  await next();
  await expect(guide).toContainText("separate execution examples");
  const cardProof = guide.getByRole("link", {
    name: "Open CloudWallet purchase",
  });
  await expect(cardProof).toHaveAttribute(
    "href",
    `https://sepolia.etherscan.io/tx/${PITCH_EVIDENCE.card.hash}`,
  );
  const cardPopupPromise = page.waitForEvent("popup");
  await cardProof.click();
  const cardPopup = await cardPopupPromise;
  await cardPopup.waitForLoadState();
  expect(cardPopup.url()).toContain(PITCH_EVIDENCE.card.hash);
  await cardPopup.close();
  await expect(
    guide.getByRole("link", { name: "Open Sepolia revenue claim" }),
  ).toHaveAttribute(
    "href",
    `https://sepolia.etherscan.io/tx/${PITCH_EVIDENCE.claim.hash}`,
  );
  await next();
  await guide.getByRole("button", { name: "Finish demo" }).click();
  await expect(guide).toHaveCount(0);
  await page.keyboard.press("h");
  await expect(
    page.getByRole("navigation", { name: "Presentation controls" }),
  ).toBeVisible();
  await page.keyboard.press("h");
  await expect(
    page.getByRole("navigation", { name: "Presentation controls" }),
  ).toBeHidden();
  expect((await page.request.get("/demo")).headers()["x-frame-options"]).toBe(
    "SAMEORIGIN",
  );
  expect((await page.request.get("/pitch/architecture/index.html")).headers()["x-frame-options"]).toBe(
    "SAMEORIGIN",
  );
  expect((await page.request.get("/")).headers()["x-frame-options"]).toBe(
    "DENY",
  );
});
