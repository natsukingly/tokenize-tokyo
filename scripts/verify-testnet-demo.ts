import "./env";
import { readFileSync, writeFileSync } from "node:fs";
import { formatEther } from "viem";
import { config } from "../src/lib/config";
import { clients, loadMarket, readContract } from "../src/lib/multibaas";
import { marketAnalytics } from "../src/lib/analytics";
import type { MarketState } from "../src/lib/model";

type Receipt = {
  action: string;
  hash: string;
  outputId?: string;
  block: string;
};
function check(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}
function expectedEvent(action: string) {
  const step = action.split("/").at(-1)!;
  if (action.startsWith("setup/")) return null;
  if (action.startsWith("basket-")) {
    if (step.startsWith("revenue-")) return "RevenueDeposited";
    return (
      {
        create: "BasketCreated",
        mint: "BasketMinted",
        claim: "BasketRevenueClaimed",
        list: "ListingCreated",
        purchase: "ListingPurchased",
        redeem: "BasketRedeemed",
      } as Record<string, string>
    )[step];
  }
  if (
    [
      "invest-B",
      "invest-C",
      "invest-composer",
      "complete-funding",
      "acquire",
      "secondary-purchase",
    ].includes(step)
  )
    return "ListingPurchased";
  if (step.startsWith("revenue-")) return "RevenueDeposited";
  if (step.startsWith("claim-")) return "RevenueClaimed";
  return (
    {
      register: "AssetRegistered",
      submit: "AssetVerificationRequested",
      "verify-asset": "AssetVerified",
      issue: "RightCreated",
      "verify-right": "RightVerified",
      list: "ListingCreated",
      resell: "ListingCreated",
      activate: "RightActivated",
    } as Record<string, string>
  )[step];
}
async function main() {
  check(config.chainId === 2017072401, "Curvegrid Testnet scenario only");
  check(
    (await clients().chains.getChainStatus()).data.result.chainID ===
      config.chainId,
    "Wrong chain",
  );
  const manifest = JSON.parse(
    readFileSync("deployments/testnet-demo-receipts.json", "utf8"),
  );
  check(
    manifest.registry.toLowerCase() === config.addresses.registry.toLowerCase(),
    "Receipt manifest belongs to another registry",
  );
  const receipts: Receipt[] = manifest.transactions;
  const state: MarketState = await loadMarket();
  let checked = 0;
  for (const receipt of receipts) {
    const event = expectedEvent(receipt.action);
    if (!event) {
      check(
        receipt.action.startsWith("setup/"),
        `Unknown scenario action ${receipt.action}`,
      );
      continue;
    }
    check(
      state.events.some(
        (e) =>
          e.name === event &&
          e.txHash.toLowerCase() === receipt.hash.toLowerCase(),
      ),
      `Indexer incomplete: ${receipt.action} (${event}) is not available yet; retry after indexing catches up`,
    );
    checked++;
  }
  for (const basket of state.baskets) {
    console.log("Verifying custody for Basket", basket.id);
    check(
      // MultiBaas exposes the uint256 overload as the go-ethereum name totalSupply0.
      String(await readContract("basket", "totalSupply0", [basket.id])) === "4",
      "Unexpected basket supply",
    );
    check(
      String(
        await readContract("basket", "balanceOf", [
          manifest.actors.composer,
          basket.id,
        ]),
      ) === "3",
      "Composer shares mismatch",
    );
    check(
      String(
        await readContract("basket", "balanceOf", [
          manifest.actors.investorC,
          basket.id,
        ]),
      ) === "1",
      "Buyer shares mismatch",
    );
    for (const right of basket.rightIds)
      check(
        String(
          await readContract("rights", "balanceOf", [
            config.addresses.basket,
            right,
          ]),
        ) === "4",
        "Underlying custody mismatch",
      );
  }
  for (const [name, field, metric] of [
    ["ListingPurchased", "totalPrice", "volume"],
    ["RevenueDeposited", "amount", "deposited"],
    ["RevenueClaimed", "amount", "claimed"],
  ] as const) {
    const sum = state.events
      .filter((e) => e.name === name)
      .reduce((n, e) => n + BigInt(String(e.args[field])), 0n);
    check(
      sum.toString() === state.metrics[metric],
      "Event Query aggregate mismatch: " + name,
    );
  }
  const analytics = marketAnalytics(state, config.addresses.rights);
  const report = {
    checkedAt: new Date().toISOString(),
    chainId: config.chainId,
    scriptedTestAssets: true,
    browserMode: config.mode,
    confirmedScenarioTransactions: receipts.length,
    indexedScenarioActionsChecked: checked,
    assets: state.assets.length,
    rights: state.rights.length,
    baskets: state.baskets.length,
    listings: state.listings.length,
    listingsWithRemainingUnits: state.listings.filter(
      (l) => !l.cancelled && BigInt(l.remaining) > 0n,
    ).length,
    indexedEvents: state.events.length,
    sales: state.metrics.sales,
    volumeMockJPY: formatEther(BigInt(state.metrics.volume)),
    depositedMockJPY: formatEther(BigInt(state.metrics.deposited)),
    withdrawnFromRevenueVaultMockJPY: formatEther(
      BigInt(state.metrics.claimed),
    ),
    primaryRightsVolumeMockJPY: formatEther(analytics.primaryVolume),
    secondaryRightsVolumeMockJPY: formatEther(analytics.secondaryVolume),
    basketVolumeMockJPY: formatEther(analytics.basketVolume),
    verifiedAssets: analytics.verified,
    activeAssets: analytics.active,
    reviewsPending: analytics.reviewQueue,
    categories: analytics.categories,
    basketCustodyVerified: true,
    limitations: [
      "Fictional properties and simulated verification",
      "Valueless test tokens; not organic adoption or returns",
      "External webhook and browser-wallet rehearsal not verified by this script",
      "ENSv2 not deployed",
    ],
  };
  writeFileSync(
    "deployments/testnet-demo-verification.json",
    JSON.stringify(report, null, 2) + "\n",
  );
  console.log(JSON.stringify(report, null, 2));
}
main().catch((error) => {
  // SDK request objects can contain private credentials; print only our own errors.
    console.error(error?.response || error?.request
      ? `MultiBaas request failed (${error.response?.status || "network"}): ${String(error.response?.data?.message || "No server message").replace(/https?:\/\/\S+/g, "[URL redacted]")}`
      : error.message);
  process.exitCode = 1;
});
