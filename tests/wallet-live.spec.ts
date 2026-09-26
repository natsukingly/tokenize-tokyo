import { test, expect } from "@playwright/test";
import { loadEnvFile } from "node:process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import {
  decodeEventLog,
  parseAbiItem,
  createPublicClient,
  createWalletClient,
  defineChain,
  hexToString,
  http,
  type Hex,
} from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";

// Opt-in only: this test broadcasts valueless Curvegrid testnet transactions.
// The test signer stays in Node, never in the browser or a committed file.
test("real testnet wallet onboarding, mint, purchase, receipt explorer and portfolio", async ({
  page,
  context,
}) => {
  test.skip(
    process.env.RUN_LIVE_WALLET_E2E !== "1",
    "Requires explicit testnet run",
  );
  test.setTimeout(240000);
  page.setDefaultTimeout(20000);
  loadEnvFile(".env.local");
  expect(Number(process.env.NEXT_PUBLIC_CHAIN_ID)).toBe(2017072401);
  const file = process.env.LIVE_WALLET_FILE || ".data/wallet-browser-test.json";
  if (!existsSync(file))
    writeFileSync(file, JSON.stringify({ privateKey: generatePrivateKey() }), {
      mode: 0o600,
    });
  const signer = privateKeyToAccount(
    JSON.parse(readFileSync(file, "utf8")).privateKey,
  );
  const chain = defineChain({
    id: 2017072401,
    name: "Curvegrid Testnet",
    nativeCurrency: { name: "Test ETH", symbol: "ETH", decimals: 18 },
    rpcUrls: { default: { http: [process.env.NEXT_PUBLIC_RPC_URL!] } },
  });
  const publicClient = createPublicClient({ chain, transport: http() });
  const walletClient = createWalletClient({
    account: signer,
    chain,
    transport: http(),
  });
  let selectedChain = "0x1";
  const hashes: string[] = [];
  await page.exposeFunction(
    "__testWalletRequest",
    async ({ method, params = [] }: { method: string; params?: any[] }) => {
      if (method === "eth_requestAccounts" || method === "eth_accounts")
        return [signer.address];
      if (method === "eth_chainId") return selectedChain;
      if (method === "wallet_switchEthereumChain") {
        selectedChain = params[0].chainId;
        return null;
      }
      if (method === "eth_getBalance")
        return (
          "0x" +
          (await publicClient.getBalance({ address: params[0] })).toString(16)
        );
      if (method === "personal_sign")
        return signer.signMessage({ message: hexToString(params[0]) });
      if (method === "eth_sendTransaction") {
        expect(params[0].from.toLowerCase()).toBe(signer.address.toLowerCase());
        expect(BigInt(params[0].value)).toBe(0n);
        const hash = await walletClient.sendTransaction({
          to: params[0].to,
          data: params[0].data,
          value: 0n,
        });
        hashes.push(hash);
        writeFileSync(
          ".data/live-wallet-receipts.json",
          JSON.stringify(
            { address: signer.address, chainId: chain.id, hashes },
            null,
            2,
          ),
        );
        return hash;
      }
      throw new Error("Unexpected test wallet method: " + method);
    },
  );
  await page.addInitScript(() => {
    (window as any).ethereum = {
      request: (arg: unknown) => (window as any).__testWalletRequest(arg),
      on: () => {},
      removeListener: () => {},
    };
  });
  await page.goto("/?theme=cyberpunk");
  await expect(
    page.getByRole("button", {
      name: "Explore Nihonbashi Solar Roof",
      exact: true,
    }),
  ).toBeVisible({ timeout: 60000 });
  await page
    .getByRole("button", { name: "Connect wallet", exact: true })
    .click();
  const dialog = page.getByRole("dialog", {
    name: "Connect your wallet",
    exact: true,
  });
  await dialog
    .getByRole("button", { name: "Browser wallet", exact: true })
    .click();
  const wallet = page.getByRole("dialog", { name: "Your account", exact: true });
  await expect(wallet).toContainText(signer.address);
  if (
    (await publicClient.getBalance({ address: signer.address })) <
    10n ** 16n
  ) {
    await wallet
      .getByRole("button", { name: "Get test ETH", exact: true })
      .click();
    await expect(wallet).toContainText("Test gas requested", {
      timeout: 30000,
    });
  }
  await expect(
    wallet.getByRole("button", { name: "Gas ready", exact: true }),
  ).toBeVisible({ timeout: 20000 });
  await wallet
    .getByRole("button", { name: "Mint MockJPY", exact: true })
    .click();

  await expect(
    wallet.getByRole("link", { name: /mint · settlement/ }),
  ).toBeVisible();
  await expect(
    wallet.getByRole("link", { name: /mint · settlement/ }),
  ).toContainText("Confirmed", { timeout: 60000 });
  await wallet
    .getByRole("button", { name: "Close wallet", exact: true })
    .click();
  await page
    .getByRole("button", {
      name: "Explore Nihonbashi Solar Roof · Demo",
      exact: true,
    })
    .click();
  await page.getByLabel("I have reviewed the rights and their terms.").check();
  await page.getByLabel("Purchase quantity").fill("1");
  await page
    .getByRole("button", { name: "Acquire right", exact: true })
    .first()
    .click();
  await expect(page.getByRole("status")).toContainText(
    "Purchase rights · confirmed",
    { timeout: 60000 },
  );
  const link = page.getByRole("link", {
    name: "View transaction",
    exact: true,
  });
  await expect(link).toHaveAttribute("href", "/tx/" + hashes.at(-1));
  const [explorer] = await Promise.all([
    context.waitForEvent("page"),
    link.click(),
  ]);
  await expect(
    explorer.getByRole("heading", { name: "Function · purchase", exact: true }),
  ).toBeVisible({ timeout: 30000 });
  await expect(
    explorer.locator("summary").filter({ hasText: "ListingPurchased" }),
  ).toBeVisible();
  await expect(explorer.locator("body")).toContainText(
    signer.address.toLowerCase(),
  );
  await explorer.screenshot({
    path: ".data/live-purchase-explorer.png",
    fullPage: true,
  });
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "My assets", exact: true })
    .click();
  await expect(page.locator(".holding").first()).toContainText("units held", {
    timeout: 60000,
  });
  await page.screenshot({
    path: ".data/live-wallet-portfolio.png",
    fullPage: true,
  });
  await page.getByLabel("Resale / redeem quantity").fill("1");
  await page
    .locator(".holding")
    .first()
    .getByRole("button", { name: "List for resale", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText(
    "Create listing · confirmed",
    { timeout: 60000 },
  );
  const listingReceipt = await publicClient.getTransactionReceipt({
    hash: hashes.at(-1) as Hex,
  });
  const created = listingReceipt.logs
    .flatMap((log) => {
      try {
        return [
          decodeEventLog({
            abi: [
              parseAbiItem(
                "event ListingCreated(uint256 indexed listingId, address indexed seller, address indexed token, uint256 rightId, uint256 amount, uint256 unitPrice)",
              ),
            ],
            data: log.data,
            topics: log.topics,
          }),
        ];
      } catch {
        return [];
      }
    })
    .find((event) => event.eventName === "ListingCreated");
  expect(created).toBeDefined();
  // Wait for this specific newly confirmed event to reach the index, rather than
  // assuming an older listing on screen is the one this test just created.
  await expect(
    page
      .locator(".order")
      .filter({ hasText: `Listing ${created!.args.listingId} ·` }),
  ).toBeVisible({ timeout: 60000 });
  while (await page.locator(".order").count()) {
    const text = await page.locator(".order").last().innerText();
    const id = text.match(/Listing (\d+)/)![1];
    const row = page.locator(".order").filter({ hasText: `Listing ${id} ·` });
    await row
      .getByRole("button", { name: "Cancel listing", exact: true })
      .click();
    await expect(page.getByRole("status")).toContainText(
      "Cancel listing · confirmed",
      { timeout: 60000 },
    );
    await expect(row).toHaveCount(0, { timeout: 60000 });
  }
  writeFileSync(
    ".data/live-wallet-receipts.json",
    JSON.stringify(
      { address: signer.address, chainId: chain.id, hashes },
      null,
      2,
    ),
  );
});
