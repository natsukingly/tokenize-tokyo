import { readFileSync } from "node:fs";
import { loadEnvFile } from "node:process";
import {
  Configuration,
  ContractsApi,
  AddressesApi,
  ChainsApi,
} from "@curvegrid/multibaas-sdk";

async function main() {
  const flag = process.argv.indexOf("--env");
  if (flag < 0) throw new Error("Use --env .env.sepolia");
  loadEnvFile(process.argv[flag + 1]);
  const file = process.env.ENSV2_DEPLOYMENT_FILE;
  if (!file) throw new Error("Set ENSV2_DEPLOYMENT_FILE");
  const d = JSON.parse(readFileSync(file, "utf8"));
  if (d.chainId !== 11155111 || d.ens?.locallyForked !== false)
    throw new Error("A public Sepolia manifest is required");
  const url = process.env.MULTIBAAS_URL,
    key = process.env.MULTIBAAS_API_KEY;
  if (!url || !key)
    throw new Error("Configure a separate Sepolia MultiBaas deployment");
  const cfg = new Configuration({
    basePath: new URL("/api/v0", url).toString(),
    accessToken: key,
    baseOptions: { timeout: 20000 },
  });
  const contracts = new ContractsApi(cfg),
    addresses = new AddressesApi(cfg),
    chains = new ChainsApi(cfg);
  if ((await chains.getChainStatus()).data.result.chainID !== 11155111)
    throw new Error(
      "MultiBaas must be on Sepolia; existing Curvegrid deployment will not be modified",
    );
  const entries = [
    ["registry", "UrbanAssetRegistry", "urbanassetregistry"],
    ["rights", "UrbanRightToken", "urbanrighttoken"],
    ["market", "UrbanMarketplace", "urbanmarketplace"],
    ["revenue", "RevenueVault", "revenuevault"],
    ["basket", "BasketVault", "basketvault"],
    ["settlement", "MockJPY", "mockjpy"],
    ["authority", "UrbanNamespaceAuthority", "urbannamespaceauthority"],
    ["building", "UserRegistryImpl", "ensuserregistry"],
    ["resolver", "PermissionedResolverImpl", "enspermissionedresolver"],
  ];
  const published = new Set<string>();
  for (const [name, contractName, label] of entries) {
    const abi = JSON.parse(
      readFileSync(
        contractName.endsWith("Impl")
          ? `contracts/test/fixtures/ensv2/${contractName}.json`
          : `contracts/out/${contractName}.sol/${contractName}.json`,
        "utf8",
      ),
    ).abi;
    if (!published.has(label)) {
      // Explicit version avoids replacing the old Curvegrid contract definitions.
      let existing;
      try {
        existing = (await contracts.getContractVersion(label, "2.0")).data
          .result;
      } catch (e) {
        if ((e as { response?: { status?: number } }).response?.status !== 404)
          throw e;
      }
      if (existing) {
        if (JSON.stringify(JSON.parse(existing.rawAbi)) !== JSON.stringify(abi))
          throw new Error(`ABI mismatch for existing ${label} 2.0`);
      } else
        await contracts.createContract(label, {
          label,
          contractName,
          version: "2.0",
          rawAbi: JSON.stringify(abi),
        });
      published.add(label);
    }
    await addresses.setAddress({ address: d[name], alias: `tokyoens${name}` });
    await contracts.linkAddressContract(d[name], {
      label,
      version: "2.0",
      startingBlock: String(d.startingBlock),
    });
    console.log(`Linked ${name}: ${d[name]}`);
  }
  console.log(
    "Sepolia protocol + ENS contracts linked. Use a read/compose-only DApp key for the browser; never expose the admin key.",
  );
}
main().catch((e) => {
  console.error(
    e instanceof Error && e.constructor === Error
      ? e.message
      : "MultiBaas linking failed; check deployment, permissions and existing contract versions.",
  );
  process.exitCode = 1;
});
