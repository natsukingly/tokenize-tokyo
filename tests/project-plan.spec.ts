import { test, expect } from "@playwright/test";
test("project draft keeps edits, recalculates downside and persists the full overview", async ({
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
    .fill("Neighborhood storage plan");
  await dialog
    .getByLabel("Asset type", { exact: true })
    .selectOption("Storage");
  const description = dialog.getByLabel("Project description", { exact: true });
  await expect(description).toHaveValue(/secure, bookable storage/);
  await expect(dialog.getByRole("table")).toContainText("Conservative");
  await dialog.getByLabel("Annual sales / booking revenue (JPY)").fill("0");
  await expect(dialog.getByRole("table")).toContainText("Not recovered");
  await description.fill(
    "A local storage business with a detailed operating plan.\n\nCustomers: neighborhood retailers.\n\nRisks: low occupancy and higher insurance costs.",
  );
  await dialog.getByRole("button", { name: "Use suggested plan" }).click();
  await dialog.getByRole("button", { name: "Keep mine" }).click();
  await expect(description).toHaveValue(/neighborhood retailers/);
  await dialog.getByRole("button", { name: "Continue to rights" }).click();
  await dialog.getByRole("button", { name: "Review & publish" }).click();
  await dialog
    .getByRole("button", { name: "Register demo asset", exact: true })
    .click();
  await expect(
    dialog.getByRole("heading", {
      name: "Neighborhood storage plan",
      exact: true,
    }),
  ).toBeVisible();
  await dialog
    .getByRole("button", { name: "Space", exact: false })
    .first()
    .click();
  await expect(description).toHaveValue(/neighborhood retailers/);
  await expect(dialog.getByRole("alert")).toHaveCount(0);
  await dialog.getByRole("button", { name: "Close tokenization" }).click();
  await page.reload();
  await page.getByRole("button", { name: "Tokenize a space", exact: true }).click();
  await dialog.getByLabel("Working on").selectOption({ label: "Neighborhood storage plan" });
  await dialog.getByRole("button", { name: "Space", exact: false }).first().click();
  await expect(description).toHaveValue(/neighborhood retailers/);
  await expect(dialog.getByLabel("Annual sales / booking revenue (JPY)")).toHaveValue("0");
});
