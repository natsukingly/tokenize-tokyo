import { readFileSync } from "node:fs";
import { loadEnvFile } from "node:process";
import { createPublicClient, http } from "viem";
import {
  Configuration,
  ContractsApi,
  AddressesApi,
  ChainsApi,
  AdminApi,
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
  const status = (await chains.getChainStatus()).data.result;
  if (status.chainID !== 11155111)
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
  let startingBlock = d.startingBlock;
  const bootstrapFlag = process.argv.indexOf("--bootstrap");
  if (bootstrapFlag >= 0) {
    const bootstrap = JSON.parse(
      readFileSync(process.argv[bootstrapFlag + 1], "utf8"),
    );
    if (
      bootstrap.chainId !== d.chainId ||
      bootstrap.fromBlock !== d.startingBlock ||
      !Number.isSafeInteger(bootstrap.toBlock) ||
      bootstrap.toBlock < bootstrap.fromBlock
    )
      throw new Error("Bootstrap range does not match this deployment");
    for (const name of [
      "registry",
      "rights",
      "market",
      "revenue",
      "basket",
      "settlement",
      "authority",
    ])
      if (
        String(bootstrap.addresses[name]).toLowerCase() !==
        String(d[name]).toLowerCase()
      )
        throw new Error(`Bootstrap ${name} mismatch`);
    const rpc = createPublicClient({
      transport: http(process.env.ENSV2_RPC_URL),
    });
    if (
      (await rpc.getChainId()) !== d.chainId ||
      (await rpc.getBlock({ blockNumber: BigInt(bootstrap.toBlock) })).hash !==
        bootstrap.blockHash
    )
      throw new Error("Bootstrap is not on canonical Sepolia");
    startingBlock = bootstrap.toBlock + 1;
    console.log(
      `Initial records: verified RPC bootstrap through ${bootstrap.toBlock}. MultiBaas indexes from ${startingBlock}.`,
    );
  }
  const linked = new Set<string>();
  for (const [name, , label] of entries) {
    try {
      const address = (await addresses.getAddress(d[name])).data.result;
      const existing = address.contracts?.find((c) => c.label === label);
      if (existing) {
        if (existing.version !== "2.0")
          throw new Error(`Unexpected ${name} contract version`);
        const sync = (await contracts.getEventIndexingStatus(d[name], label))
          .data.result;
        if (sync.startBlockNumber !== startingBlock)
          throw new Error(
            `Existing ${name} index has another starting block; preserve and inspect it`,
          );
        linked.add(name);
      }
    } catch (e) {
      if ((e as { response?: { status: number } }).response?.status !== 404)
        throw e;
    }
  }
  if (linked.size === entries.length) {
    console.log(
      "All nine contracts already linked at the expected boundary; no indexing state changed.",
    );
    return;
  }
  // Do not silently omit historical events or create a partial nine-contract setup.
  // A newly created Free deployment can have a restricted indexing lookback.
  const plan = (await new AdminApi(cfg).getPlan()).data.result;
  const linkedLimit = plan.limits.find(
    (limit) => limit.name === "linked_contracts",
  )?.limit;
  const historyLimit = plan.limits.find(
    (limit) => limit.name === "past_logs_max_depth",
  )?.limit;
  if (
    linkedLimit !== undefined &&
    linkedLimit !== null &&
    linkedLimit <
      (plan.limits.find((limit) => limit.name === "linked_contracts")?.count ||
        0) +
        entries.length -
        linked.size
  )
    throw new Error(
      `Plan ${plan.name} supports ${linkedLimit} linked contracts; this deployment requires ${entries.length}. No contracts were linked.`,
    );
  const requiredHistory = status.blockNumber - startingBlock;
  if (
    historyLimit !== undefined &&
    historyLimit !== null &&
    requiredHistory > historyLimit
  )
    throw new Error(
      `Plan ${plan.name} permits ${historyLimit} historical blocks, but complete deployment history requires ${requiredHistory}. Request a suitable plan or hackathon allowance before linking; no contracts were linked.`,
    );
  const published = new Set<string>();
  for (const [name, contractName, label] of entries) {
    if (linked.has(name)) continue;
    const artifact = JSON.parse(
      readFileSync(
        contractName.endsWith("Impl")
          ? `contracts/test/fixtures/ensv2/${contractName}.json`
          : `contracts/out/${contractName}.sol/${contractName}.json`,
        "utf8",
      ),
    );
    const abi = artifact.abi;
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
          bin:
            typeof artifact.bytecode === "string"
              ? artifact.bytecode
              : artifact.bytecode.object,
        });
      published.add(label);
    }
    await addresses.setAddress({ address: d[name], alias: `tokyoens${name}` });
    await contracts.linkAddressContract(d[name], {
      label,
      version: "2.0",
      startingBlock: String(startingBlock),
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
      : `MultiBaas linking failed (${e.response?.status || "network"}): ${String(
          e.response?.data?.message ||
            "Check deployment, permissions and existing contract versions",
        )
          .replace(/https?:\/\/\S+/g, "[URL]")
          .slice(0, 400)}`,
  );
  process.exitCode = 1;
});
