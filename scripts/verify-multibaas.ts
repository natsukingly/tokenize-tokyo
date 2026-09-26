import "./env";
import {
  AdminApi,
  Configuration,
  AddressesApi,
} from "@curvegrid/multibaas-sdk";
import { config, labels, type ContractKey } from "../src/lib/config";
import { clients, readContract, queryRows } from "../src/lib/multibaas";
import { eventQuery } from "../src/lib/queries";
async function main() {
  // Frontend checks use the DApp User key (config.key). Address lookups and
  // indexing status are Administrators-only, so they use MULTIBAAS_API_KEY.
  const adminKey = process.env.MULTIBAAS_API_KEY;
  if (!adminKey) throw new Error("Set MULTIBAAS_API_KEY for admin checks");
  const api = clients();
  const admin = clients(config.url, adminKey);
  const status = (await api.chains.getChainStatus()).data.result;
  if (status.chainID !== config.chainId)
    throw new Error("Wrong MultiBaas chain ID");
  const cfg = new Configuration({
    basePath: new URL("/api/v0", config.url).toString(),
    accessToken: config.key,
  });
  const addresses = new AddressesApi(
    new Configuration({
      basePath: new URL("/api/v0", config.url).toString(),
      accessToken: adminKey,
    }),
  );
  for (const name of Object.keys(labels) as ContractKey[]) {
    const addr = config.addresses[name];
    if (!/^0x[\da-f]{40}$/i.test(addr))
      throw new Error("Missing " + name + " address");
    const data = (await addresses.getAddress(addr)).data.result;
    if (!data.contracts?.some((c) => c.label === labels[name]))
      throw new Error(name + " is not linked");
    const sync = (
      await admin.contracts.getEventIndexingStatus(addr, labels[name])
    ).data.result;
    if (
      !sync.latestBlockHash ||
      sync.isProcessingPastLogs ||
      sync.latestBlockNumber < sync.startBlockNumber
    )
      throw new Error(
        name + " indexing is disabled, incomplete or still catching up",
      );
    console.log(name, addr, "indexing", JSON.stringify(sync));
  }
  console.log(
    "SDK read nextAssetId:",
    String(await readContract("registry", "nextAssetId")),
  );
  const from =
    process.env.PROBE_ADDRESS || "0x0000000000000000000000000000000000000001";
  const tx = await api.contracts.callContractFunction(
    config.addresses.registry,
    labels.registry,
    "registerAsset",
    {
      from,
      args: [
        "0x" + "ab".repeat(32),
        "data:application/json,%7B%22simulated%22%3Atrue%7D",
        0,
      ],
      signAndSubmit: false,
    },
  );
  if (tx.data.result.kind !== "TransactionToSignResponse")
    throw new Error("Unsigned composition failed");
  console.log("Unsigned composition OK (not submitted)");
  const rows = await queryRows(
    eventQuery("AssetRegistered", config.addresses.registry),
  );
  if (!rows.length)
    throw new Error(
      "No AssetRegistered events: seed contracts or wait for indexing",
    );
  console.log("Event query OK:", rows.length, "registered assets");
  const sales = await queryRows(
    eventQuery("ListingPurchased", config.addresses.market, {
      field: "totalPrice",
      op: "add",
    }),
  );
  console.log("Volume aggregation:", JSON.stringify(sales));
  let denied = false;
  try {
    await new AdminApi(cfg).listApiKeys();
  } catch (e) {
    const code = (e as { response?: { status: number } }).response?.status;
    if (code === 403 || code === 401) denied = true;
    else throw new Error("Unable to verify frontend key permissions");
  }
  if (!denied)
    throw new Error(
      "Frontend key can enumerate API keys. Replace it with a DApp User-only key.",
    );
  console.log(
    "Admin endpoint denied to frontend key. Also confirm its sole group is DApp User in the console.",
  );
  console.log(
    "Webhook delivery, Cloud Wallet and TXM require their separate live checks; this script does not claim they passed.",
  );
}
main().catch((e) => {
  console.error("MultiBaas verification failed:", e.message);
  process.exitCode = 1;
});
