import { test, expect, type Page } from "@playwright/test";
import { readFileSync, writeFileSync } from "node:fs";
import {
  createPublicClient,
  createWalletClient,
  http,
  parseEther,
  type Address,
  type Hex,
} from "viem";
import { foundry } from "viem/chains";

test("real custody, fraction purchase/income/redemption and timed rental through the UI", async ({
  page,
}) => {
  const d = JSON.parse(
    readFileSync(process.env.FINANCE_TEST_MANIFEST!, "utf8"),
  );
  const c = createPublicClient({
    chain: foundry,
    transport: http(d.rpc),
    cacheTime: 0,
  });
  let actor = d.owner as Address;
  const hashes: string[] = [];
  const abi = (name: string) =>
    JSON.parse(readFileSync(`contracts/out/${name}.sol/${name}.json`, "utf8"))
      .abi;
  const read = (key: string, name: string, fn: string, args: unknown[]) =>
    c.readContract({
      address: d.addresses[key],
      abi: abi(name),
      functionName: fn,
      args,
    });
  async function write(key: string, name: string, fn: string, args: unknown[]) {
    const w = createWalletClient({
      account: d.owner as Address,
      chain: foundry,
      transport: http(d.rpc),
    });
    const tx = {
      account: d.owner as Address,
      address: d.addresses[key],
      abi: abi(name),
      functionName: fn,
      args,
    };
    const gas = await c.estimateContractGas(tx);
    const hash = await w.writeContract({ ...tx, gas: (gas * 12n) / 10n });
    expect((await c.waitForTransactionReceipt({ hash })).status).toBe(
      "success",
    );
    hashes.push(hash);
  }
  await page.exposeFunction(
    "__financeWallet",
    async ({ method, params = [] }: { method: string; params: any[] }) => {
      if (method === "eth_accounts" || method === "eth_requestAccounts")
        return [actor];
      if (method === "eth_chainId") return "0x7a69";
      if (method === "eth_getBalance")
        return "0x" + (await c.getBalance({ address: actor })).toString(16);
      if (method === "eth_sendTransaction") {
        expect(params[0].from.toLowerCase()).toBe(actor.toLowerCase());
        const w = createWalletClient({
          account: actor,
          chain: foundry,
          transport: http(d.rpc),
        });
        const tx = {
          account: actor,
          to: params[0].to,
          data: params[0].data,
          value: 0n,
        };
        const gas = await c.estimateGas(tx);
        const hash = await w.sendTransaction({ ...tx, gas: (gas * 12n) / 10n });
        hashes.push(hash);
        return hash;
      }
      throw new Error(`Unexpected wallet method ${method}`);
    },
  );
  await page.addInitScript(() => {
    const listeners: Record<string, Function[]> = {};
    (window as any).ethereum = {
      request: (a: unknown) => (window as any).__financeWallet(a),
      on: (name: string, fn: Function) => (listeners[name] ??= []).push(fn),
      removeListener: (name: string, fn: Function) => {
        listeners[name] = (listeners[name] || []).filter((f) => f !== fn);
      },
    };
    (window as any).__switchFinanceAccount = (address: string) => {
      for (const fn of listeners.accountsChanged || []) fn([address]);
    };
  });
  await page.goto("/");
  await expect(page.getByText("LOCAL ANVIL", { exact: true })).toBeVisible();
  await page
    .getByRole("button", { name: "Connect wallet", exact: true })
    .click();
  await page
    .getByRole("dialog", { name: "Connect your wallet", exact: true })
    .getByRole("button", { name: "Browser wallet", exact: true })
    .click();
  const wallet = page.getByRole("dialog", {
    name: "Your account",
    exact: true,
  });
  await expect(wallet).toContainText(d.owner);
  await wallet.getByRole("button", { name: /Close/ }).click();
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Markets", exact: true })
    .click();
  await page.getByRole("tab", { name: "Fractional", exact: true }).click();
  const ui = page.getByRole("region", { name: "Rights finance" });
  await expect(ui.getByLabel("Right to deposit")).toContainText(
    "Finance Test Roof",
  );
  const confirm = async () => {
    const dialog = page.getByRole("dialog", {
      name: "Review finance transaction",
    });
    await expect(dialog).toBeVisible();
    await expect(
      dialog.getByRole("button", { name: "Confirm transaction", exact: true }),
    ).toBeDisabled();
    await dialog.getByRole("checkbox").check();
    await dialog
      .getByRole("button", { name: "Confirm transaction", exact: true })
      .click();
    await expect(dialog).not.toBeVisible({ timeout: 30000 });
    await expect(ui.getByRole("alert")).toHaveCount(0);
  };
  await ui.getByRole("button", { name: "Review deposit and split" }).click();
  await confirm();
  const position = ui.getByRole("article", { name: "Fraction pool 1" });
  await expect(position).toContainText("1000 fraction shares held");
  expect(
    await read("rights", "UrbanRightToken", "balanceOf", [
      d.addresses.fraction,
      1n,
    ]),
  ).toBe(1n);
  await position.getByLabel("Fraction quantity", { exact: true }).fill("250");
  await position
    .getByRole("button", { name: "List fractions for resale" })
    .click();
  await confirm();
  async function change(address: Address) {
    actor = address;
    await page.evaluate(
      (a) => (window as any).__switchFinanceAccount(a),
      address,
    );
    await expect(
      ui.getByRole("button", { name: "Refresh positions" }),
    ).toBeEnabled();
  }
  await change(d.buyer);
  const offer = ui.getByRole("article", { name: "Fraction offer 1" });
  await expect(
    offer.getByRole("button", { name: "Review fraction purchase" }),
  ).toBeVisible();
  await offer.getByLabel("Shares to buy").fill("250");
  await offer.getByRole("button", { name: "Review fraction purchase" }).click();
  await confirm();
  await expect(position).toContainText("250 fraction shares held");
  await write("settlement", "MockJPY", "approve", [
    d.addresses.revenue,
    parseEther("10000"),
  ]);
  await write("revenue", "RevenueVault", "depositRevenue", [
    1n,
    parseEther("10000"),
  ]);
  await ui.getByRole("button", { name: "Refresh positions" }).click();
  await expect(position).toContainText("25 mJPY claimable");
  await page.screenshot({
    path: ".data/finance-e2e/fractions-desktop.png",
    fullPage: true,
  });
  await position
    .getByRole("button", { name: "Claim fraction revenue" })
    .click();
  await confirm();
  await expect(position).toContainText("0 mJPY claimable");
  expect(
    await read("fraction", "FractionVault", "balanceOf", [d.buyer, 1n]),
  ).toBe(250n);

  // Purchase remaining shares via an actual listing so the buyer can redeem one whole right.
  await change(d.owner);
  await expect(position).toContainText("750 fraction shares held");
  await position.getByLabel("Fraction quantity", { exact: true }).fill("750");
  await position
    .getByRole("button", { name: "List fractions for resale" })
    .click();
  await confirm();
  await change(d.buyer);
  const second = ui.getByRole("article", { name: "Fraction offer 2" });
  await second.getByLabel("Shares to buy").fill("750");
  await second
    .getByRole("button", { name: "Review fraction purchase" })
    .click();
  await confirm();
  await expect(position).toContainText("1000 fraction shares held");
  await position.getByLabel("Fraction quantity", { exact: true }).fill("1000");
  await position
    .getByRole("button", { name: "Redeem underlying rights", exact: true })
    .click();
  await confirm();
  expect(
    await read("rights", "UrbanRightToken", "balanceOf", [d.buyer, 1n]),
  ).toBe(1n);
  expect(await read("fraction", "FractionVault", "totalSupply", [1n])).toBe(0n);

  await change(d.owner);
  await page.getByRole("tab", { name: "Rental", exact: true }).click();
  await expect(ui.getByLabel("Right to deposit")).toContainText(
    "Finance Test Storage",
  );
  await ui.getByLabel("Rental price per day (mJPY)").fill("10");
  await ui.getByRole("button", { name: "Review rental offer" }).click();
  await confirm();
  expect(
    await read("rights", "UrbanRightToken", "balanceOf", [
      d.addresses.rental,
      2n,
    ]),
  ).toBe(1n);
  await change(d.buyer);
  const rental = ui.getByRole("article", { name: "Rental offer 1" });
  await rental
    .getByRole("button", { name: "Review rental", exact: true })
    .click();
  await confirm();
  expect(
    (
      (await read("rental", "RentalEscrow", "userOf", [1n])) as string
    ).toLowerCase(),
  ).toBe(d.buyer.toLowerCase());
  await page.screenshot({
    path: ".data/finance-e2e/rental-desktop.png",
    fullPage: true,
  });
  await change(d.owner);
  await expect(
    rental.getByRole("button", { name: "Withdraw usage right" }),
  ).toBeDisabled();
  await change(d.buyer);
  await rental.getByRole("button", { name: "Return rental early" }).click();
  await confirm();
  expect(await read("rental", "RentalEscrow", "userOf", [1n])).toBe(
    "0x0000000000000000000000000000000000000000",
  );
  await change(d.owner);
  await rental.getByRole("button", { name: "Withdraw usage right" }).click();
  await confirm();
  expect(
    await read("rights", "UrbanRightToken", "balanceOf", [d.owner, 2n]),
  ).toBe(1n);
  await ui.getByText("Finance activity · MultiBaas", { exact: true }).click();
  await expect(ui.getByRole("link", { name: /RentalWithdrawn/ })).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: ".data/finance-e2e/finance-mobile.png",
    fullPage: true,
  });
  writeFileSync(
    ".data/finance-e2e/verification.json",
    JSON.stringify(
      {
        checkedAt: new Date().toISOString(),
        chainId: 31337,
        network: "isolated Anvil",
        multibaas:
          "local wire-format fixture; not a live MultiBaas service verification",
        scenarios: [
          "custody-backed fraction creation",
          "fraction trading",
          "deposited income claim",
          "whole-unit redemption",
          "rental payment and access",
          "active withdrawal rejection",
          "early return",
          "owner recovery",
          "indexed activity",
          "mobile layout",
        ],
        hashes,
      },
      null,
      2,
    ),
  );
});
