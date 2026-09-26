import { test, expect } from "@playwright/test";
const id = "fde9ed92-8d7f-480f-8ef6-77d104fe6600";
const receipt = {
  id,
  state: "awaiting_payment",
  txHash: null,
  recipient: `0x${"b".repeat(40)}`,
  quantity: "2",
  amountJpy: 200,
  chainId: 11155111,
};

for (const width of [390, 1512]) {
  test(`receipt verifies delivery separately from redirect at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 1000 });
    let state = "awaiting_payment";
    await page.route(`**/api/card-checkout/orders/${id}`, (route) =>
      route.fulfill({
        json: {
          ...receipt,
          state,
          txHash: state === "fulfilled" ? `0x${"a".repeat(64)}` : null,
        },
      }),
    );
    await page.goto(`/checkout/${id}`);
    await expect(
      page.getByRole("heading", { name: "Waiting for test payment" }),
    ).toBeVisible();
    await expect(
      page.getByText("Your rights have arrived", { exact: true }),
    ).toHaveCount(0);
    await expect(page.getByText("¥200", { exact: true })).toBeVisible();
    const card = await page
      .getByRole("region", { name: "Card purchase status" })
      .boundingBox();
    expect(Math.abs(card!.x + card!.width / 2 - width / 2)).toBeLessThan(1);
    state = "submitted";
    await page
      .getByRole("button", { name: "Check payment & delivery" })
      .click();
    await expect(
      page.getByRole("heading", { name: "Your rights are on the way" }),
    ).toBeVisible();
    state = "fulfilled";
    await page
      .getByRole("button", { name: "Check payment & delivery" })
      .click();
    await expect(
      page.getByRole("heading", { name: "Your rights have arrived" }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "View transaction" }),
    ).toHaveAttribute(
      "href",
      `https://sepolia.etherscan.io/tx/0x${"a".repeat(64)}`,
    );
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `.data/card-checkout/receipt-${width}.png`,
      fullPage: true,
    });
  });
}
test("cancelled open Checkout can resume the same session", async ({
  page,
}) => {
  await page.route(`**/api/card-checkout/orders/${id}`, (route) =>
    route.fulfill({
      json: {
        ...receipt,
        checkoutUrl: "https://checkout.stripe.com/c/pay/cs_test_fixture",
      },
    }),
  );
  await page.goto(`/checkout/${id}?cancelled=1`);
  await expect(
    page.getByText("You returned from Stripe.", { exact: false }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Resume test payment" }),
  ).toHaveAttribute(
    "href",
    "https://checkout.stripe.com/c/pay/cs_test_fixture",
  );
});
test("uncertain delivery requests review instead of showing success or retrying a charge", async ({
  page,
}) => {
  await page.route(`**/api/card-checkout/orders/${id}`, (route) =>
    route.fulfill({ json: { ...receipt, state: "review" } }),
  );
  await page.goto(`/checkout/${id}`);
  await expect(
    page.getByRole("heading", {
      name: "Payment received · delivery needs review",
    }),
  ).toBeVisible();
  await expect(
    page.getByText("Do not pay again.", { exact: false }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Resume test payment" }),
  ).toHaveCount(0);
});
test("the receipt never shows successful delivery when browser authorization is missing", async ({
  page,
}) => {
  await page.route(`**/api/card-checkout/orders/${id}`, (route) =>
    route.fulfill({
      status: 404,
      json: { error: "Order not found in this browser." },
    }),
  );
  await page.goto(`/checkout/${id}`);
  await expect(
    page
      .getByRole("region", { name: "Card purchase status" })
      .getByRole("alert"),
  ).toHaveText("Order not found in this browser.");
  await expect(
    page.getByText("Your rights have arrived", { exact: true }),
  ).toHaveCount(0);
});
test("purchase offers expose card review and preserve wallet purchase", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 1000 });
  await page.goto("/demo?theme=original");
  const payment = page.getByRole("group", { name: "Payment method" }).first();
  await expect(payment).toBeVisible();
  await payment.getByRole("radio", { name: "Card TEST" }).check();
  await expect(
    page.getByText("Test payment total", { exact: true }).first(),
  ).toBeVisible();
  await expect(
    page
      .getByText(
        "Card payments are available in the testnet marketplace, after setup.",
      )
      .first(),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Continue to Stripe" }).first(),
  ).toBeDisabled();
  await page.screenshot({
    path: ".data/card-checkout/payment-mobile.png",
    fullPage: true,
  });
  await payment.getByRole("radio", { name: "Wallet", exact: true }).check();
  await expect(
    page.getByRole("button", { name: "Acquire right", exact: true }).first(),
  ).toBeVisible();
});
