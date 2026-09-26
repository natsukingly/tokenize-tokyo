import { test, expect } from "@playwright/test";
import { mkdirSync } from "node:fs";

test("buy from space details with quantity validation and account-specific consent", async ({
  page,
}) => {
  await page.goto("/demo");
  await page.getByLabel("Demo role").selectOption("Investor B");
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Markets", exact: true })
    .click();
  const directory = page.getByRole("region", { name: "Asset directory" });
  await directory.getByLabel("Find a space").fill("Akihabara Parking Bay");
  await directory.getByRole("button", { name: /^View details for/ }).click();
  const dialog = page.getByRole("dialog");
  const buy = dialog.getByRole("button", {
    name: "Acquire right",
    exact: true,
  });
  await expect(buy).toBeDisabled();
  await dialog.getByLabel("I have reviewed this right and its terms.").check();
  await dialog.getByLabel("Purchase quantity").fill("2");
  await expect(buy).toBeDisabled();
  await dialog.getByLabel("Purchase quantity").fill("1");
  await expect(buy).toBeEnabled();
  await dialog.getByLabel("Demo role").selectOption("Investor C");
  await expect(
    dialog.getByLabel("I have reviewed this right and its terms."),
  ).not.toBeChecked();
  await expect(buy).toBeDisabled();
  await dialog.getByLabel("Demo role").selectOption("Owner A");
  await expect(
    dialog.getByRole("button", { name: "Your listing" }),
  ).toBeDisabled();
  await dialog.getByLabel("Demo role").selectOption("Investor B");
  await dialog.getByLabel("I have reviewed this right and its terms.").check();
  await buy.click();
  await expect(dialog.locator(".feedback[role='status']")).toContainText(
    "Purchase rights · simulated successfully",
  );
  await expect(dialog).toContainText("You hold 1 unit");
  await expect(
    dialog.getByRole("button", { name: "Acquire right", exact: true }),
  ).toHaveCount(0);
  await expect(dialog).toBeVisible();
  await expect(page.locator(".map-wrap")).toHaveCount(0);
});

for (const approved of [true, false]) {
  test(`review assets and rights in the modal with verifier permissions (${approved ? "approve" : "reject"})`, async ({
    page,
  }) => {
    await page.goto("/demo");
    await page.waitForFunction(
      () => localStorage.getItem("tokenize-tokyo-demo-v2") !== null,
    );
    // Put one existing demo asset back into review, without changing the role checks.
    await page.evaluate(() => {
      const key = "tokenize-tokyo-demo-v2";
      const data = JSON.parse(localStorage.getItem(key)!);
      const asset = data.events.find(
        (event: { name: string; args: { metadataURI?: string } }) =>
          event.name === "AssetRegistered" &&
          decodeURIComponent(event.args.metadataURI || "").includes(
            "Akihabara Parking Bay",
          ),
      );
      const aid = asset.args.assetId;
      const rid = data.events.find(
        (event: { name: string; args: { assetId?: string } }) =>
          event.name === "RightCreated" && event.args.assetId === aid,
      ).args.rightId;
      data.events = data.events.filter(
        (event: {
          name: string;
          args: { assetId?: string; rightId?: string };
        }) =>
          !(
            event.args.assetId === aid &&
            ["AssetVerificationRequested", "AssetVerified"].includes(event.name)
          ) &&
          !(
            event.args.rightId === rid &&
            ["RightVerified", "RightActivated"].includes(event.name)
          ),
      );
      localStorage.setItem(key, JSON.stringify(data));
    });
    await page.reload();
    await page.getByLabel("Demo role").selectOption("Investor B");
    await page
      .getByRole("navigation")
      .getByRole("button", { name: "Markets", exact: true })
      .click();
    const directory = page.getByRole("region", { name: "Asset directory" });
    await directory.getByLabel("Find a space").fill("Akihabara Parking Bay");
    await directory.getByRole("button", { name: /^View details for/ }).click();
    const dialog = page.getByRole("dialog");
    await expect(
      dialog.getByRole("button", {
        name: "Submit for verification",
        exact: true,
      }),
    ).toHaveCount(0);
    await dialog.getByLabel("Demo role").selectOption("Owner A");
    await dialog
      .getByRole("button", { name: "Submit for verification", exact: true })
      .click();
    await expect(
      dialog.getByRole("button", { name: "Approve asset", exact: true }),
    ).toHaveCount(0);
    await dialog.getByLabel("Demo role").selectOption("Demo verifier");
    const approveAsset = dialog.getByRole("button", {
      name: "Approve asset",
      exact: true,
    });
    await expect(approveAsset).toBeDisabled();
    await dialog
      .getByLabel("I have reviewed the asset details and evidence.")
      .check();
    await approveAsset.click();
    await expect(dialog.locator(".feedback[role='status']")).toContainText(
      "Approve asset · simulated successfully",
    );
    const action = dialog.getByRole("button", {
      name: approved ? "Approve right" : "Reject right",
      exact: true,
    });
    await expect(action).toBeDisabled();
    await dialog
      .getByLabel("I have reviewed the right terms, scope and period.")
      .check();
    await action.click();
    await expect(dialog.locator(".feedback[role='status']")).toContainText(
      `${approved ? "Approve" : "Reject"} right · simulated successfully`,
    );
    await expect(
      dialog.getByRole("button", { name: "Approve right", exact: true }),
    ).toHaveCount(0);
    if (approved)
      await expect(
        dialog.getByRole("button", { name: "Activate right", exact: true }),
      ).toBeVisible();
    else await expect(dialog).toContainText("Rejected");
  });
}

test("directory rows open details without losing filters; the map action remains separate", async ({
  page,
}) => {
  await page.goto("/demo?theme=cyberpunk");
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Markets", exact: true })
    .click();
  const directory = page.getByRole("region", { name: "Asset directory" });
  await directory.getByLabel("Find a space").fill("Akihabara Parking Bay");
  const row = directory.locator("tbody tr").first();
  await expect(row).toBeVisible();
  const name = await row.locator("strong").first().innerText();
  await row.locator('td[data-label="State"]').click();
  const dialog = page.getByRole("dialog", { name });
  await expect(dialog).toBeVisible();
  await expect(
    dialog.getByRole("heading", { name: "Rights & offers" }),
  ).toBeVisible();
  mkdirSync(".data/asset-details", { recursive: true });
  await page.screenshot({ path: ".data/asset-details/desktop.png" });
  await expect(page.locator(".map-wrap")).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  const detailButton = directory.getByRole("button", {
    name: `View details for ${name}`,
  });
  await expect(detailButton).toBeFocused();
  await expect(directory.getByLabel("Find a space")).toHaveValue(
    "Akihabara Parking Bay",
  );
  await detailButton.press("Enter");
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Close space details" }).click();
  await directory.getByRole("button", { name: `View ${name} on map` }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.locator(".asset-detail h2")).toHaveText(name);
});

test("space details stay within the mobile screen and can open the map", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/demo?theme=cyberpunk");
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Markets", exact: true })
    .click();
  const directory = page.getByRole("region", { name: "Asset directory" });
  await directory
    .getByRole("button", { name: /^View details for/ })
    .first()
    .click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  expect(
    await dialog.evaluate(
      (element) => element.scrollWidth <= element.clientWidth + 1,
    ),
  ).toBe(true);
  mkdirSync(".data/asset-details", { recursive: true });
  await page.screenshot({ path: ".data/asset-details/mobile.png" });
  await dialog
    .getByRole("button", { name: "View on map", exact: true })
    .click();
  await expect(dialog).toHaveCount(0);
  await expect(page.locator(".asset-detail")).toBeVisible();
});
