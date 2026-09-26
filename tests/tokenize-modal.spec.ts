import { test, expect } from "@playwright/test";

test("Cyberpunk is the main UI without a theme switch; Original is an explicit preview", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "cyberpunk");
  await expect(page.locator(".city-view")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Cyberpunk theme", exact: true }),
  ).toHaveCount(0);
  await page.goto("/?theme=original");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "original");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "original");
  await page.evaluate(() =>
    localStorage.setItem("tokenize-tokyo-theme", "original"),
  );
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "cyberpunk");
});

test("tokenization preserves the map, filters and draft, with keyboard and backdrop dismissal", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByLabel("Filters", { exact: true }).click();
  await page.getByRole("button", { name: "Rooftop", exact: true }).click();
  await expect(page.locator(".maplibregl-canvas")).toBeVisible();
  const canvas = await page.locator(".maplibregl-canvas").elementHandle();
  const url = page.url();
  const opener = page.getByRole("button", {
    name: "Tokenize a space",
    exact: true,
  });
  await opener.click();
  const dialog = page.getByRole("dialog", {
    name: "Tokenize a space",
    exact: true,
  });
  await expect(dialog).toBeVisible();
  await expect(page.locator(".breadcrumb")).toContainText("EXPLORE");
  expect(page.url()).toBe(url);
  expect(await canvas!.evaluate((el) => el.isConnected)).toBe(true);
  await dialog
    .getByLabel("Asset name", { exact: true })
    .fill("Modal rooftop draft");
  await dialog.getByRole("button", { name: "Choose on map" }).click();
  await expect(
    dialog.getByRole("region", { name: "Select an asset location" }),
  ).toBeVisible();
  await dialog.getByRole("button", { name: "Close location picker" }).click();
  await expect(dialog.getByLabel("Asset name", { exact: true })).toHaveValue(
    "Modal rooftop draft",
  );
  await dialog.getByRole("button", { name: "Continue to rights" }).click();
  // The native dialog must keep keyboard focus away from the background.
  for (let i = 0; i < 18; i++) {
    await page.keyboard.press("Tab");
    expect(
      await dialog.evaluate((el) => el.contains(document.activeElement)),
    ).toBe(true);
  }
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await expect(opener).toBeFocused();
  await page.getByLabel("Filters", { exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Rooftop", exact: true }),
  ).toHaveClass(/active/);
  await opener.click();
  await expect(
    dialog.getByRole("heading", { name: "What can people use?" }),
  ).toBeVisible();
  await page.mouse.click(5, 5);
  await expect(dialog).not.toBeVisible();
  await page
    .getByRole("button", { name: "Tokenize a space", exact: true })
    .click();
  await expect(
    dialog.getByRole("heading", { name: "What can people use?" }),
  ).toBeVisible();
});

for (const width of [390, 1512]) {
  test(`owner tutorial stays interactive inside the modal at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.goto("/");
    await page.getByRole("button", { name: "Quick tour", exact: true }).click();
    await page.getByRole("button", { name: "List my space" }).click();
    const dialog = page.getByRole("dialog", {
      name: "Tokenize a space",
      exact: true,
    });
    await expect(
      dialog.getByRole("region", { name: "Quick tour" }),
    ).toBeVisible();
    await dialog
      .getByRole("region", { name: "Quick tour" })
      .getByRole("button", { name: "Close tour" })
      .click({ trial: true });
    await expect(dialog.getByLabel("Demo role")).toHaveValue("Owner A");
    await dialog
      .getByLabel("Asset name", { exact: true })
      .fill("Guided storage draft");
    await dialog.getByRole("button", { name: "Continue to rights" }).click();
    await dialog.getByRole("button", { name: "Review & publish" }).click();
    await dialog
      .getByRole("button", { name: "Register demo asset", exact: true })
      .click();
    await dialog
      .getByRole("region", { name: "Quick tour" })
      .getByRole("button", { name: "Continue", exact: true })
      .click();
    await expect(
      dialog.getByRole("heading", { name: "Verify the asset" }),
    ).toBeVisible();
    expect(
      await dialog
        .locator(".tokenize-focus")
        .evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
    ).toBe(true);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await dialog.getByRole("button", { name: "Close tokenization" }).click();
    await expect(dialog).not.toBeVisible();
    await expect(
      page.getByRole("region", { name: "Quick tour" }),
    ).toBeVisible();
  });
}
