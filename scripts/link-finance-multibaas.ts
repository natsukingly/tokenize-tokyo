import { loadEnvFile } from "node:process";
import { readFileSync } from "node:fs";
import {
  Configuration,
  ContractsApi,
  AddressesApi,
  ChainsApi,
  AdminApi,
} from "@curvegrid/multibaas-sdk";
import { isAddress } from "viem";

async function main() {
  const envFlag = process.argv.indexOf("--env"),
    manifestFlag = process.argv.indexOf("--manifest");
  if (envFlag < 0 || manifestFlag < 0)
    throw new Error(
      "Use --env .env.local --manifest deployments/finance-CHAIN_ID.json",
    );
  loadEnvFile(process.argv[envFlag + 1]);
  const d = JSON.parse(readFileSync(process.argv[manifestFlag + 1], "utf8"));
  if (![31337, 11155111, 2017072401].includes(d.chainId))
    throw new Error("Test-network manifest required");
  for (const key of ["fraction", "rental", "rights", "revenue", "settlement"])
    if (!isAddress(d[key])) throw new Error(`Invalid ${key} address`);
  if (!Number.isSafeInteger(d.startingBlock) || d.startingBlock < 0)
    throw new Error("Invalid indexing start block");
  const url = process.env.MULTIBAAS_URL,
    key = process.env.MULTIBAAS_API_KEY;
  if (!url || !key)
    throw new Error("Set server-only MULTIBAAS_URL and MULTIBAAS_API_KEY");
  const cfg = new Configuration({
    basePath: new URL("/api/v0", url).toString(),
    accessToken: key,
    baseOptions: { timeout: 20000 },
  });
  const contracts = new ContractsApi(cfg),
    addresses = new AddressesApi(cfg);
  const chain = (await new ChainsApi(cfg).getChainStatus()).data.result;
  if (chain.chainID !== d.chainId)
    throw new Error("MultiBaas and finance manifest chains differ");
  const plan = (await new AdminApi(cfg).getPlan()).data.result;
  const aliases = (await addresses.listAddresses()).data.result;
  const existing = await Promise.all(
    aliases.map(
      async (a) => (await addresses.getAddress(a.address)).data.result,
    ),
  );
  const entries = [
    ["fraction", "FractionVault", "fractionvault"],
    ["rental", "RentalEscrow", "rentalescrow"],
  ];
  const limit = plan.limits.find((l) => l.name === "linked_contracts")?.limit;
  const used = existing.reduce((n, a) => n + a.contracts.length, 0);
  const additional = entries.filter(
    ([name, , label]) =>
      !existing.some(
        (a) =>
          a.address.toLowerCase() === d[name].toLowerCase() &&
          a.contracts.some((c) => c.label === label),
      ),
  ).length;
  if (limit != null && used + additional > limit)
    throw new Error(
      `MultiBaas has ${used}/${limit} linked contracts; this extension needs ${additional} more slots. No changes were made.`,
    );
  const history = plan.limits.find(
    (l) => l.name === "past_logs_max_depth",
  )?.limit;
  if (history != null && chain.blockNumber - d.startingBlock > history)
    throw new Error(
      "Deployment history exceeds this plan's indexing window. No changes were made.",
    );
  for (const [name, contractName, label] of entries) {
    const artifact = JSON.parse(
      readFileSync(
        `contracts/out/${contractName}.sol/${contractName}.json`,
        "utf8",
      ),
    );
    let published;
    try {
      published = (await contracts.getContractVersion(label, "1.0")).data
        .result;
    } catch (e) {
      if ((e as { response?: { status?: number } }).response?.status !== 404)
        throw e;
    }
    if (published) {
      if (
        JSON.stringify(JSON.parse(published.rawAbi)) !==
        JSON.stringify(artifact.abi)
      )
        throw new Error(
          `Existing ${label} ABI differs. Use a new version instead of replacing it.`,
        );
    } else
      await contracts.createContract(label, {
        label,
        contractName,
        version: "1.0",
        rawAbi: JSON.stringify(artifact.abi),
        bin: artifact.bytecode.object,
      });
    await addresses.setAddress({
      address: d[name],
      alias: `tokyofinance${name}`,
    });
    await contracts.linkAddressContract(d[name], {
      label,
      version: "1.0",
      startingBlock: String(d.startingBlock),
    });
    console.log(`Linked ${contractName}: ${d[name]}`);
  }
  console.log(
    `Set NEXT_PUBLIC_FRACTION_ADDRESS=${d.fraction} and NEXT_PUBLIC_RENTAL_ADDRESS=${d.rental}, then rebuild the frontend for chain ${d.chainId}.`,
  );
}
main().catch((e) => {
  console.error(
    e instanceof Error && e.constructor === Error
      ? e.message
      : `Finance linking failed (${e.response?.status || "network"}); check API permissions, chain and plan capacity.`,
  );
  process.exitCode = 1;
});
