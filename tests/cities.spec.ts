import { expect, test } from "@playwright/test";

// Keep interaction checks deterministic; live OpenFreeMap rendering is checked separately.
const emptyStyle = {
  version: 8,
  sources: {},
  layers: [
    {
      id: "background",
      type: "background",
      paint: { "background-color": "#15191c" },
    },
  ],
};

test.beforeEach(async ({ page }) => {
  await page.route("https://tiles.openfreemap.org/styles/dark", (route) =>
    route.fulfill({ json: emptyStyle }),
  );
});

test("city links, keyboard selection and reload keep the selected preview", async ({
  page,
}) => {
  const apiCalls: string[] = [];
  page.on("request", (request) => {
    if (new URL(request.url()).pathname.startsWith("/api/"))
      apiCalls.push(request.url());
  });
  await page.goto("/cities#new-york");
  await expect(
    page.getByRole("heading", { name: "New York", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("tab", { name: /New York/ })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await page.getByRole("tab", { name: /New York/ }).press("ArrowRight");
  await expect(
    page.getByRole("heading", { name: "Hong Kong", exact: true }),
  ).toBeVisible();
  await expect(page).toHaveURL(/#hong-kong$/);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Hong Kong", exact: true }),
  ).toBeVisible();
  await page.getByRole("tab", { name: /Tokyo/ }).click();
  await expect(
    page.getByRole("heading", { name: "Tokyo", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Overseas markets are not live.", { exact: false }),
  ).toBeVisible();
  expect(apiCalls).toEqual([]);
});

test("tour reaches all three cities and stops; manual selection cancels playback", async ({
  page,
}) => {
  await page.goto("/cities");
  await expect(
    page.getByRole("button", { name: "Play city tour" }),
  ).toBeVisible();
  await page.clock.install();
  await page.getByRole("button", { name: "Play city tour" }).click();
  await page.clock.runFor(9000);
  await expect(
    page.getByRole("heading", { name: "New York", exact: true }),
  ).toBeVisible();
  await page.clock.runFor(9000);
  await expect(
    page.getByRole("heading", { name: "Hong Kong", exact: true }),
  ).toBeVisible();
  await page.clock.runFor(9000);
  await expect(
    page.getByRole("button", { name: "Play city tour" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Play city tour" }).click();
  await page.getByRole("tab", { name: /New York/ }).click();
  await expect(
    page.getByRole("button", { name: "Play city tour" }),
  ).toBeVisible();
  await page.clock.runFor(10000);
  await expect(
    page.getByRole("heading", { name: "New York", exact: true }),
  ).toBeVisible();
});

test("a failed map can retry without losing the chosen city", async ({
  page,
}) => {
  await page.route("https://tiles.openfreemap.org/styles/dark", (route) =>
    route.abort(),
  );
  await page.goto("/cities#hong-kong");
  await expect(
    page.getByText("Map unavailable", { exact: true }),
  ).toBeVisible();
  await page.getByRole("tab", { name: /New York/ }).click();
  await page.route("https://tiles.openfreemap.org/styles/dark", (route) =>
    route.fulfill({ json: emptyStyle }),
  );
  await page.getByRole("button", { name: "Retry map" }).click();
  await expect(page.getByLabel("Interactive map of New York")).toHaveAttribute(
    "data-map-status",
    "ready",
  );
  await expect(
    page.getByRole("heading", { name: "New York", exact: true }),
  ).toBeVisible();
});

test("mobile previews fit the screen and invalid city links fall back to Tokyo", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/cities#unknown");
  await expect(
    page.getByRole("heading", { name: "Tokyo", exact: true }),
  ).toBeVisible();
  await page.getByRole("tab", { name: /Hong Kong/ }).click();
  await expect(
    page.getByRole("heading", { name: "Hong Kong", exact: true }),
  ).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
    390,
  );
  await expect(
    page.getByRole("link", { name: "Explore Tokyo demo" }),
  ).toHaveAttribute("href", "/demo");
});

test("the Tokyo sidebar opens city previews without changing demo holdings", async ({
  page,
}) => {
  await page.goto("/demo");
  await page.waitForFunction(
    () => localStorage.getItem("tokenize-tokyo-demo-v2") !== null,
  );
  const before = await page.evaluate(() =>
    localStorage.getItem("tokenize-tokyo-demo-v2"),
  );
  await page.getByRole("link", { name: "City preview", exact: true }).click();
  await expect(page).toHaveURL(/\/cities/);
  await page.getByRole("tab", { name: /Hong Kong/ }).click();
  const after = await page.evaluate(() =>
    localStorage.getItem("tokenize-tokyo-demo-v2"),
  );
  expect(after === before, "Existing demo holdings are preserved").toBe(true);
  await page.getByRole("link", { name: "Explore Tokyo demo" }).click();
  await expect(page).toHaveURL(/\/demo$/);
});
