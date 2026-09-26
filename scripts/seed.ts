import { readFileSync, writeFileSync } from "node:fs";
import {
  createPublicClient,
  createWalletClient,
  http,
  parseEther,
  keccak256,
  stringToHex,
  type Abi,
  type Address,
} from "viem";
import { foundry } from "viem/chains";
import { DEMO_SITES } from "../src/lib/demo";
import { metadataURI } from "../src/lib/model";
const rpc = "http://127.0.0.1:8545";
const deployment = JSON.parse(readFileSync("deployments/31337.json", "utf8"));
const names = {
  registry: "UrbanAssetRegistry",
  rights: "UrbanRightToken",
  market: "UrbanMarketplace",
  revenue: "RevenueVault",
  basket: "BasketVault",
  settlement: "MockJPY",
};
type Key = keyof typeof names;
const abi = Object.fromEntries(
  Object.entries(names).map(([k, n]) => [
    k,
    JSON.parse(readFileSync(`contracts/out/${n}.sol/${n}.json`, "utf8")).abi,
  ]),
) as Record<Key, Abi>;
const client = createPublicClient({ chain: foundry, transport: http(rpc) });
const transport = http(rpc);
const receiptLog: { action: string; hash: string; block: string }[] = [];
async function read(key: Key, fn: string, args: unknown[] = []) {
  return client.readContract({
    address: deployment[key],
    abi: abi[key],
    functionName: fn,
    args,
  });
}
async function write(who: Address, key: Key, fn: string, args: unknown[] = []) {
  const wallet = createWalletClient({
    chain: foundry,
    account: who,
    transport,
  });
  const hash = await wallet.writeContract({
    address: deployment[key],
    abi: abi[key],
    functionName: fn,
    args,
  });
  const receipt = await client.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error(fn + " reverted");
  receiptLog.push({
    action: key + "." + fn,
    hash,
    block: receipt.blockNumber.toString(),
  });
  return receipt;
}
function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}
async function main() {
  assert(
    (await client.getChainId()) === 31337,
    "This script only runs against local Anvil, never a public network",
  );
  assert(
    (await read("registry", "nextAssetId")) === 1n,
    "Local deployment already seeded. Deploy fresh contracts to rerun.",
  );
  const accounts = await createWalletClient({
    chain: foundry,
    transport,
  }).getAddresses();
  const [owner, buyer, carol, verifier] = accounts;
  await write(owner, "registry", "grantRole", [
    keccak256(stringToHex("VERIFIER_ROLE")),
    verifier,
  ]);
  for (const who of [owner, buyer, carol, verifier]) {
    await write(who, "settlement", "mint", [who, parseEther("1000000")]);
    await write(who, "settlement", "approve", [
      deployment.market,
      parseEther("1000000"),
    ]);
    await write(who, "settlement", "approve", [
      deployment.revenue,
      parseEther("1000000"),
    ]);
    await write(who, "rights", "setApprovalForAll", [deployment.market, true]);
    await write(who, "rights", "setApprovalForAll", [deployment.basket, true]);
  }
  const rightIds: bigint[] = [];
  const listingIds: bigint[] = [];
  const now = Number((await client.getBlock()).timestamp);
  for (let i = 0; i < DEMO_SITES.length; i++) {
    const site = DEMO_SITES[i],
      assetId = BigInt(i + 1);
    await write(owner, "registry", "registerAsset", [
      keccak256(stringToHex("simulated-site-" + i)),
      metadataURI({ ...site, simulated: true }),
      i === 2 ? 1 : 0,
    ]);
    await write(owner, "registry", "requestVerification", [assetId]);
    await write(verifier, "registry", "verifyAsset", [assetId, true]);
    const id = (await read("rights", "nextRightId")) as bigint;
    rightIds.push(id);
    const terms = metadataURI({
      purpose:
        i === 2
          ? "Workshop usage. Repairs require approval."
          : "Share of actual solar revenue deposits. No guaranteed yield.",
      simulated: true,
    });
    await write(owner, "rights", "createScopedRight", [
      {
        assetId,
        kind: i === 2 ? 0 : 1,
        supply: i === 2 ? 1n : 100n,
        terms,
        termsHash: keccak256(stringToHex(terms)),
        start: now - 1,
        end: now + 365 * 86400,
        policy: 0,
        scope: i === 2 ? 1 : 0,
        purpose: keccak256(stringToHex(i === 2 ? "WORKSHOP" : "SOLAR")),
        exclusive: i === 2,
      },
    ]);
    await write(verifier, "rights", "verifyRight", [id, true]);
    listingIds.push((await read("market", "nextListingId")) as bigint);
    await write(owner, "market", "createListing", [
      deployment.rights,
      id,
      i === 2 ? 1n : 100n,
      parseEther(i === 2 ? "80000" : i === 0 ? "2400" : "1800"),
    ]);
  }
  await write(buyer, "market", "purchase", [listingIds[0], 20n]);
  await write(buyer, "market", "purchase", [listingIds[1], 10n]);
  await write(verifier, "rights", "activateRight", [rightIds[0]]);
  await write(owner, "revenue", "depositRevenue", [
    rightIds[0],
    parseEther("10000"),
  ]);
  assert(
    (await read("revenue", "claimable", [rightIds[0], buyer])) ===
      parseEther("2000"),
    "Proportional revenue failed",
  );
  await write(buyer, "revenue", "claim", [rightIds[0]]);
  assert(
    (await read("revenue", "claimable", [rightIds[0], buyer])) === 0n,
    "Double claim available",
  );
  const secondary = (await read("market", "nextListingId")) as bigint;
  await write(buyer, "market", "createListing", [
    deployment.rights,
    rightIds[0],
    10n,
    parseEther("2500"),
  ]);
  await write(carol, "market", "purchase", [secondary, 10n]);
  assert(
    (await read("revenue", "claimable", [rightIds[0], carol])) === 0n,
    "Buyer inherited old revenue",
  );
  await write(carol, "market", "purchase", [listingIds[1], 5n]);
  await write(carol, "basket", "createBasket", [
    [rightIds[0], rightIds[1]],
    [1n, 1n],
    metadataURI({ name: "Tokyo Solar Basket", simulated: true }),
  ]);
  await write(carol, "basket", "depositUnderlying", [1n, 5n]);
  assert(
    (await read("rights", "balanceOf", [deployment.basket, rightIds[0]])) ===
      5n,
    "Basket custody missing",
  );
  await write(carol, "basket", "redeem", [1n, 1n]);
  assert(
    (await read("basket", "balanceOf", [carol, 1n])) === 4n,
    "Basket burn failed",
  );
  // Demonstrate the exclusive spatial conflict using the vacant home's interior.
  const conflict = await read("rights", "findConflict", [
    3n,
    1,
    now,
    now + 86400,
    true,
  ]);
  assert(conflict === rightIds[2], "Spatial conflict not detected");
  let rejected = false;
  try {
    await client.simulateContract({
      account: owner,
      address: deployment.rights,
      abi: abi.rights,
      functionName: "createScopedRight",
      args: [
        {
          assetId: 3n,
          kind: 0,
          supply: 1n,
          terms: "ipfs://conflicting",
          termsHash: keccak256(stringToHex("conflict")),
          start: now,
          end: now + 86400,
          policy: 0,
          scope: 1,
          purpose: keccak256(stringToHex("RESTAURANT")),
          exclusive: true,
        },
      ],
    });
  } catch {
    rejected = true;
  }
  assert(rejected, "Overlapping right was accepted");
  writeFileSync(
    "deployments/local-demo-receipts.json",
    JSON.stringify(
      {
        chainId: 31337,
        testnetOnly: true,
        verifiedAt: new Date().toISOString(),
        checks: [
          "register",
          "verify",
          "tokenize",
          "buy",
          "activate",
          "fund vault",
          "claim",
          "secondary sale",
          "basket custody",
          "mint",
          "redeem",
          "spatial conflict rejected",
        ],
        transactions: receiptLog,
      },
      null,
      2,
    ) + "\n",
  );
  console.log(
    "Local EVM demo passed:",
    receiptLog.length,
    "confirmed transactions; receipts in deployments/local-demo-receipts.json",
  );
}
main().catch((e) => {
  console.error(e.shortMessage || e.message);
  process.exitCode = 1;
});
