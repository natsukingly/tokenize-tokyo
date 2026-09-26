import { expect, test, type Page } from "@playwright/test";

// Opt-in, read-only smoke against an origin configured in the real Privy app.
// Does not submit an email, start OAuth, create an account or sign anything.
test.skip(process.env.PRIVY_SMOKE !== "1", "Requires an activated Privy app");

async function openEmailLogin(page: Page) {
  const wallet = page.getByRole("dialog", { name: "Connect your wallet" });
  await expect(
    wallet.getByRole("button", { name: "Connect MetaMask", exact: true }),
  ).toBeVisible();
  await wallet
    .getByRole("button", { name: "Continue with email / Google", exact: true })
    .click();
  const email = page.getByPlaceholder("your@email.com");
  await expect(email).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Google", exact: true }),
  ).toBeVisible();
  // Visibility alone cannot detect a native dialog covering Privy's portal.
  await expect(page.locator("dialog[open]")).toHaveCount(0);
  await email.click({ timeout: 15000 });
  await expect(email).toBeFocused();
}

for (const mobile of [false, true]) {
  test(`email/Google login and MetaMask choice (${mobile ? "mobile" : "desktop"})`, async ({
    page,
  }) => {
    if (mobile) await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    await page
      .getByRole("button", { name: "Connect wallet", exact: true })
      .first()
      .click();
    await openEmailLogin(page);
    await page
      .getByRole("button", { name: "close modal", exact: true })
      .click();
    await expect(page.getByPlaceholder("your@email.com")).toBeHidden();
    await page
      .getByRole("button", { name: "Connect wallet", exact: true })
      .first()
      .click();
    await page
      .getByRole("button", { name: "Connect MetaMask", exact: true })
      .click();
    await expect(page.getByRole("button", { name: /MetaMask/ })).toBeVisible();
    await page
      .getByRole("button", { name: "close modal", exact: true })
      .click();
  });
}

test("tokenization draft survives opening and cancelling Privy login", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Tokenize a space", exact: true })
    .click();
  const tokenization = page.getByRole("dialog", {
    name: "Tokenize a space",
    exact: true,
  });
  await tokenization
    .getByRole("textbox", { name: "Asset name", exact: true })
    .fill("Unsubmitted rooftop draft");
  await tokenization
    .getByRole("button", { name: "Connect wallet", exact: true })
    .click();
  await openEmailLogin(page);
  await page.getByRole("button", { name: "close modal", exact: true }).click();
  await expect(tokenization).toBeVisible();
  await expect(
    tokenization.getByRole("textbox", { name: "Asset name", exact: true }),
  ).toHaveValue("Unsubmitted rooftop draft");
  await tokenization
    .getByRole("button", { name: "Close tokenization", exact: true })
    .click();
});

test("asset purchase details survive cancelling Privy login", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Markets", exact: true })
    .click();
  const directory = page.getByRole("region", { name: "Asset directory" });
  await directory.getByLabel("Find a space").fill("Akihabara Parking Bay");
  await directory
    .getByRole("button", { name: /^View details for/ })
    .first()
    .click();
  const details = page.locator(
    'dialog[aria-labelledby="directory-asset-title"]',
  );
  await details
    .getByRole("button", { name: "Connect wallet to buy", exact: true })
    .click();
  await openEmailLogin(page);
  await page.getByRole("button", { name: "close modal", exact: true }).click();
  await expect(details).toBeVisible();
  await expect(details).toContainText("Akihabara Parking Bay");
});
