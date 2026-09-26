import { test, expect } from "@playwright/test";
import { ACTORS, DEMO_ADDRESSES } from "../src/lib/demo";
import { DEMO_CATALOG_VERSION } from "../src/lib/demo-catalog";
import { metadataURI, type ChainEvent } from "../src/lib/model";

test("basket consent is per listing, independent of other cards and reset for another buyer", async ({
  page,
}) => {
  const events: ChainEvent[] = [];
  for (const id of ["1", "2", "3"]) {
    const common = {
      block: Number(id),
      txHash: "0x" + id.repeat(64),
      timestamp: new Date().toISOString(),
    };
    events.push({
      ...common,
      contract: "basket",
      name: "BasketCreated",
      args: {
        basketId: id,
        creator: ACTORS["Owner A"],
        rightIds: ["1", "2"],
        unitsPerShare: ["1", "1"],
        metadataURI: metadataURI({ name: `Income pool ${id}` }),
      },
    });
    events.push({
      ...common,
      contract: "market",
      name: "ListingCreated",
      args: {
        listingId: id,
        seller: ACTORS["Owner A"],
        token: DEMO_ADDRESSES.basket,
        rightId: id,
        amount: "2",
        unitPrice: "5000000000000000000000",
      },
    });
  }
  await page.addInitScript(
    (fixture) => {
      localStorage.setItem("tokenize-tokyo-demo-v2", JSON.stringify(fixture));
    },
    {
      events,
      catalogVersion: DEMO_CATALOG_VERSION,
      balances: {},
      cash: {},
      claims: {},
    },
  );
  await page.goto("/demo");
  await page
    .locator(".sidebar nav")
    .getByRole("button", { name: /^Compose/ })
    .click();
  const cards = page
    .locator(".basket-pool")
    .filter({
      has: page.getByRole("button", { name: "Acquire basket shares" }),
    });
  await expect(cards).toHaveCount(3);
  const checks = cards.getByRole("checkbox");
  const buy = (index: number) =>
    cards.nth(index).getByRole("button", { name: "Acquire basket shares" });
  await checks.nth(0).check();
  await expect(checks.nth(0)).toBeChecked();
  await expect(buy(0)).toBeEnabled();
  for (const i of [1, 2]) {
    await expect(checks.nth(i)).not.toBeChecked();
    await expect(buy(i)).toBeDisabled();
  }
  await checks.nth(1).check();
  await checks.nth(0).uncheck();
  await expect(checks.nth(1)).toBeChecked();
  await expect(buy(1)).toBeEnabled();
  await expect(buy(0)).toBeDisabled();
  await page.getByLabel("Demo role").selectOption("Investor C");
  for (const i of [0, 1, 2]) {
    await expect(checks.nth(i)).not.toBeChecked();
    await expect(buy(i)).toBeDisabled();
  }
});
