import "./env";
import { readFileSync, writeFileSync } from "node:fs";
import { AdminApi, Configuration } from "@curvegrid/multibaas-sdk";
import { config, labels } from "../src/lib/config";
import { clients, loadMarket, readContract } from "../src/lib/multibaas";
import { loadEnsBinding } from "../src/lib/ens/authority";
import { loadEnsAudit } from "../src/lib/ens/events";
import { indexBootstrap } from "../src/lib/index-bootstrap";
import { formatEther } from "viem";

async function main() {
  if (config.chainId !== 11155111) throw new Error("Use --env .env.sepolia");
  const api = clients(),
    admin = clients(config.url, process.env.MULTIBAAS_API_KEY);
  if ((await api.chains.getChainStatus()).data.result.chainID !== 11155111)
    throw new Error("Wrong MultiBaas chain");
  const initial = indexBootstrap(config.chainId, config.addresses);
  const linked = {
    ...labels,
    authority: "urbannamespaceauthority",
    building: "ensuserregistry",
    resolver: "enspermissionedresolver",
  };
  const manifest = JSON.parse(
    (await import("node:fs")).readFileSync("deployments/11155111.json", "utf8"),
  );
  for (const [key, label] of Object.entries(linked)) {
    const sync = (
      await admin.contracts.getEventIndexingStatus(manifest[key], label)
    ).data.result;
    if (
      !sync.latestBlockHash ||
      sync.isProcessingPastLogs ||
      sync.startBlockNumber !==
        (initial?.toBlock ?? manifest.startingBlock - 1) + 1
    )
      throw new Error(
        `${key} index is incomplete or has an unexpected boundary`,
      );
  }
  const state = await loadMarket();
  const nextAsset = BigInt(
    String(await readContract("registry", "nextAssetId")),
  );
  const nextRight = BigInt(String(await readContract("rights", "nextRightId")));
  if (
    BigInt(state.assets.length) !== nextAsset - 1n ||
    BigInt(state.rights.length) !== nextRight - 1n
  )
    throw new Error("Asset/right discovery is incomplete; wait for indexing");
  const binding = await loadEnsBinding(),
    audit = await loadEnsAudit(binding);
  const unsigned = (
    await api.contracts.callContractFunction(
      config.addresses.registry,
      labels.registry,
      "registerAsset",
      {
        from: manifest.admin,
        args: [
          "0x" + "ab".repeat(32),
          "data:application/json,%7B%22simulated%22%3Atrue%7D",
          0,
        ],
        signAndSubmit: false,
      },
    )
  ).data.result;
  if (unsigned.kind !== "TransactionToSignResponse" || unsigned.submitted)
    throw new Error("Unsigned composition failed");
  let denied = false;
  try {
    await new AdminApi(
      new Configuration({
        basePath: new URL("/api/v0", config.url).toString(),
        accessToken: config.key,
      }),
    ).listApiKeys();
  } catch (e) {
    denied = [401, 403].includes(
      (e as { response?: { status: number } }).response?.status || 0,
    );
  }
  if (!denied) throw new Error("Frontend key is not restricted");
  let scenario;
  if (process.argv.includes("--scenario")) {
    const receipts = JSON.parse(
      readFileSync("deployments/sepolia-demo-receipts.json", "utf8"),
    ) as {
      chainId: number;
      registry: string;
      actors: Record<string, string>;
      confirmedTransactions: number;
      transactions: {
        name: string;
        hash: string;
        block: string;
        outputId?: string;
      }[];
    };
    if (
      receipts.chainId !== config.chainId ||
      receipts.registry.toLowerCase() !==
        config.addresses.registry.toLowerCase()
    )
      throw new Error("Scenario receipts belong to another deployment");
    const actions = receipts.transactions.filter(
      (tx) => !tx.name.startsWith("setup/"),
    );
    if (!actions.some((tx) => tx.name === "basket/redeem"))
      throw new Error("Scenario has not finished");
    for (const tx of actions) {
      if (
        !state.events.some(
          (event) =>
            event.txHash.toLowerCase() === tx.hash.toLowerCase() &&
            event.block === Number(tx.block),
        )
      )
        throw new Error(`Scenario action is not indexed: ${tx.name}`);
    }
    const basketId = actions.find(
      (tx) => tx.name === "basket/create",
    )?.outputId;
    const basket = state.baskets.find((item) => item.id === basketId);
    if (
      !basket ||
      basket.rightIds.length !== 3 ||
      basket.units.some((unit) => unit !== "1")
    )
      throw new Error("Expected the three-component mixed basket");
    for (const id of basket.rightIds) {
      if (
        String(
          await readContract("rights", "balanceOf", [
            config.addresses.basket,
            id,
          ]),
        ) !== "2"
      )
        throw new Error(`Basket custody mismatch for right ${id}`);
    }
    for (const actor of ["owner", "investorB"]) {
      if (
        String(
          await readContract("basket", "balanceOf", [
            receipts.actors[actor],
            basket.id,
          ]),
        ) !== "1"
      )
        throw new Error(`Basket balance mismatch for ${actor}`);
    }
    // This is a snapshot check for the bounded seed, not an invariant after subsequent user trades.
    if (
      formatEther(BigInt(state.metrics.volume)) !== "37700" ||
      formatEther(BigInt(state.metrics.deposited)) !== "5800"
    )
      throw new Error(
        "Seed totals differ; inspect subsequent activity before accepting the snapshot",
      );
    scenario = {
      confirmedTransactions: receipts.confirmedTransactions,
      indexedMarketActions: actions.length,
      activeRights: state.rights.filter((right) => right.status === "Active")
        .length,
      basketId: basket.id,
      basketComponents: basket.rightIds,
      custodyUnitsPerRight: "2",
      ownerBasketShares: "1",
      investorBasketShares: "1",
      snapshotTotalsMatched: true,
    };
  }
  const report = {
    checkedAt: new Date().toISOString(),
    chainId: 11155111,
    linkedContracts: Object.keys(linked).length,
    initialRecords: initial?.events.length || 0,
    initialSource: "Verified Sepolia RPC logs",
    multiBaasFromBlock: initial ? initial.toBlock + 1 : manifest.startingBlock,
    assets: state.assets.length,
    rights: state.rights.length,
    baskets: state.baskets.length,
    events: state.events.length,
    volumeMockJPY: formatEther(BigInt(state.metrics.volume)),
    depositedMockJPY: formatEther(BigInt(state.metrics.deposited)),
    ensAsset: binding.binding.assetId.toString(),
    ensAuditRecords: audit.length,
    unsignedComposition: true,
    dappAdminAccessDenied: denied,
    ...(scenario ? { scenario } : {}),
    limitations: [
      "Fictional assets and simulated ownership verification",
      "Initial records use RPC bootstrap, not MultiBaas backfill",
      "Browser wallet rehearsal is a separate check",
    ],
  };
  writeFileSync(
    "deployments/sepolia-multibaas-verification.json",
    JSON.stringify(report, null, 2) + "\n",
  );
  console.log(JSON.stringify(report, null, 2));
}
main().catch((e) => {
  console.error(
    String(e.response?.data?.message || e.shortMessage || e.message)
      .replace(/https?:\/\/\S+/g, "[URL]")
      .slice(0, 500),
  );
  process.exitCode = 1;
});
