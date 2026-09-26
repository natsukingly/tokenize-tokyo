import "./env";
import { readFileSync, writeFileSync } from "node:fs";
import { formatEther } from "viem";
import { config } from "../src/lib/config";
import { loadMarket } from "../src/lib/multibaas";
import { parseMetadata } from "../src/lib/model";
import {
  cityPlan,
  cityPlanSummary,
  CITY_DATASET,
} from "../src/lib/sepolia-city-plan";

async function main() {
  if (!process.argv.includes("--env") || config.chainId !== 11155111)
    throw new Error("Use --env .env.sepolia");
  const receipts = JSON.parse(
    readFileSync("deployments/sepolia-city-receipts.json", "utf8"),
  ) as {
    chainId: number;
    locallyForked: boolean;
    registry: string;
    dataset: string;
    transactions: {
      id: string;
      hash: string;
      block: string;
      outputId?: string;
    }[];
  };
  if (
    receipts.chainId !== 11155111 ||
    receipts.locallyForked ||
    receipts.registry.toLowerCase() !==
      config.addresses.registry.toLowerCase() ||
    receipts.dataset !== CITY_DATASET
  )
    throw new Error("Receipt deployment mismatch");
  const plan = cityPlan(),
    summary = cityPlanSummary();
  const state = await loadMarket();
  const actions = receipts.transactions.filter(
    (tx) => !tx.id.startsWith("setup/"),
  );
  const outputs = new Map(
    receipts.transactions.map((tx) => [tx.id, tx.outputId]),
  );
  for (const p of plan) {
    if (
      !outputs.has(
        `${p.key}/${p.stage === 5 ? "claim" : p.stage >= 3 ? "list" : p.stage === 2 ? "verify-asset" : p.stage === 1 ? "submit" : "register"}`,
      )
    )
      throw new Error(`Incomplete scenario: ${p.key}`);
    const asset = state.assets.find(
      (asset) => asset.id === outputs.get(`${p.key}/register`),
    );
    if (
      !asset ||
      asset.metadataURI !== p.metadata ||
      parseMetadata(asset.metadataURI).dataset !== CITY_DATASET
    )
      throw new Error(`Asset not indexed: ${p.key}`);
    if (
      asset.status !==
      (p.stage === 0
        ? "Draft"
        : p.stage === 1
          ? "Pending verification"
          : "Verified")
    )
      throw new Error(`Indexed asset state mismatch: ${p.key}`);
    if (p.stage < 3) continue;
    const right = state.rights.find(
      (right) => right.id === outputs.get(`${p.key}/issue`),
    );
    const listing = state.listings.find(
      (listing) => listing.id === outputs.get(`${p.key}/list`),
    );
    if (
      !right ||
      right.assetId !== asset.id ||
      right.status !== (p.stage === 5 ? "Active" : "Verified") ||
      !listing ||
      Number(listing.remaining) !== p.supply - p.subscription
    )
      throw new Error(`Indexed rights/listing mismatch: ${p.key}`);
  }
  for (const tx of actions)
    if (
      !state.events.some(
        (e) =>
          e.txHash.toLowerCase() === tx.hash.toLowerCase() &&
          e.block === Number(tx.block),
      )
    )
      throw new Error(`Transaction not indexed: ${tx.id}`);
  const volume = formatEther(BigInt(state.metrics.volume)),
    income = formatEther(BigInt(state.metrics.deposited));
  if (
    state.assets.length !== 200 ||
    state.rights.length !== 116 ||
    volume !== String(37700 + summary.expectedNewVolume) ||
    income !== String(5800 + summary.expectedNewDeposits)
  )
    throw new Error(
      "Snapshot totals differ; wait for indexing or inspect subsequent user activity",
    );
  const report = {
    checkedAt: new Date().toISOString(),
    chainId: config.chainId,
    dataset: CITY_DATASET,
    assets: state.assets.length,
    rights: state.rights.length,
    activeRights: state.rights.filter((r) => r.status === "Active").length,
    baskets: state.baskets.length,
    indexedEvents: state.events.length,
    confirmedTransactions: receipts.transactions.length,
    indexedMarketActions: actions.length,
    totalVolumeMockJPY: volume,
    totalIncomeMockJPY: income,
    preservedExistingAssets: 4,
    indexedAssetStatesAndListingsMatched: true,
    initialSource:
      "Six verified initial Sepolia logs; later activity indexed by MultiBaas",
    limitations: [
      "Fictional spaces and simulated ownership checks",
      "MockJPY has no monetary value",
      "No historical transactions are fabricated or backdated",
    ],
  };
  writeFileSync(
    "deployments/sepolia-city-index-verification.json",
    JSON.stringify(report, null, 2) + "\n",
  );
  console.log(JSON.stringify(report, null, 2));
}
main().catch((e) => {
  console.error(
    "City index verification failed:",
    String(e.response?.data?.message || e.shortMessage || e.message)
      .replace(/https?:\/\/\S+/g, "[URL]")
      .slice(0, 400),
  );
  process.exitCode = 1;
});
