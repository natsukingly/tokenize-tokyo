import "./env";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import {
  Configuration,
  ContractsApi,
  AddressesApi,
  ChainsApi,
  HsmApi,
  AdminApi,
} from "@curvegrid/multibaas-sdk";
import {
  createPublicClient,
  createWalletClient,
  defineChain,
  http,
  parseEther,
  parseAbi,
  type Address,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";

async function main() {
  const apply = process.argv.includes("--apply");
  const id = Number(process.env.NEXT_PUBLIC_CHAIN_ID);
  if (![11155111, 2017072401].includes(id))
    throw new Error("Use an explicit testnet environment.");
  const rpcUrl = process.env.NETWORK_RPC_URL!;
  const market = process.env.NEXT_PUBLIC_MARKET_ADDRESS as Address;
  const operator = process.env.MULTIBAAS_OPERATOR_ADDRESS as Address;
  const cash = process.env.NEXT_PUBLIC_SETTLEMENT_ADDRESS as Address;
  const chain = defineChain({
    id,
    name: "TOKENIZE TOKYO testnet",
    nativeCurrency: { name: "Test ETH", symbol: "ETH", decimals: 18 },
    rpcUrls: { default: { http: [rpcUrl] } },
  });
  const rpc = createPublicClient({ chain, transport: http(rpcUrl) });
  const sdk = new Configuration({
    basePath: new URL("/api/v0", process.env.MULTIBAAS_URL!).toString(),
    accessToken: process.env.MULTIBAAS_API_KEY,
    baseOptions: { timeout: 20000 },
  });
  const contracts = new ContractsApi(sdk);
  const addresses = new AddressesApi(sdk);
  const [network, mb, providers, plan] = await Promise.all([
    rpc.getChainId(),
    new ChainsApi(sdk).getChainStatus(),
    new HsmApi(sdk).listHsm(),
    new AdminApi(sdk).getPlan(),
  ]);
  if (
    network !== id ||
    mb.data.result.chainID !== id ||
    !providers.data.result.some((p) =>
      p.wallets.some(
        (w) => w.publicAddress.toLowerCase() === operator?.toLowerCase(),
      ),
    )
  )
    throw new Error("Network or registered Cloud Wallet mismatch.");
  const file = `deployments/card-checkout-${id}.json`;
  type Manifest = {
    chainId: number;
    market: Address;
    operator: Address;
    executor?: Address;
    deploymentHash?: Hex;
    startingBlock?: number;
    gasFundingHash?: Hex;
    cashFundingHash?: Hex;
    linked?: boolean;
  };
  const manifest: Manifest = existsSync(file)
    ? JSON.parse(readFileSync(file, "utf8"))
    : { chainId: id, market, operator };
  if (
    manifest.market.toLowerCase() !== market.toLowerCase() ||
    manifest.operator.toLowerCase() !== operator.toLowerCase()
  )
    throw new Error("Existing deployment configuration differs.");
  const save = () =>
    writeFileSync(file, JSON.stringify(manifest, null, 2) + "\n");
  const quota = plan.data.result.limits.find(
    (l) => l.name === "linked_contracts",
  );
  console.log(
    JSON.stringify({
      chainId: id,
      operator,
      market,
      executor: manifest.executor || null,
      linkedContracts: quota,
      apply,
    }),
  );
  if (!apply) return;
  if (
    !manifest.linked &&
    quota?.limit != null &&
    (quota.count ?? 0) >= quota.limit
  )
    throw new Error("No MultiBaas linked-contract capacity. No changes made.");
  const account = privateKeyToAccount(process.env.PRIVATE_KEY as Hex);
  const wallet = createWalletClient({
    chain,
    account,
    transport: http(rpcUrl),
  });
  if ((await rpc.getGasPrice()) > 3_000_000_000n)
    throw new Error("Test gas price exceeds cap.");
  const gasPrice = 3_000_000_000n;
  const artifact = JSON.parse(
    readFileSync(
      "contracts/out/CardPurchaseExecutor.sol/CardPurchaseExecutor.json",
      "utf8",
    ),
  );
  if (!manifest.executor) {
    if (!manifest.deploymentHash) {
      manifest.deploymentHash = await wallet.deployContract({
        abi: artifact.abi,
        bytecode: artifact.bytecode.object,
        args: [market, operator],
        gasPrice,
      });
      save();
    }
    const receipt = await rpc.waitForTransactionReceipt({
      hash: manifest.deploymentHash,
    });
    if (receipt.status !== "success" || !receipt.contractAddress)
      throw new Error(
        "Deployment did not succeed; inspect journal before retrying.",
      );
    manifest.executor = receipt.contractAddress;
    manifest.startingBlock = Number(receipt.blockNumber);
    save();
  }
  const executor = manifest.executor;
  const [deployedMarket, deployedOperator] = await Promise.all([
    rpc.readContract({
      address: executor,
      abi: artifact.abi,
      functionName: "market",
    }),
    rpc.readContract({
      address: executor,
      abi: artifact.abi,
      functionName: "operator",
    }),
  ]);
  if (
    String(deployedMarket).toLowerCase() !== market.toLowerCase() ||
    String(deployedOperator).toLowerCase() !== operator.toLowerCase()
  )
    throw new Error("Executor validation failed.");
  const label = "cardpurchaseexecutor";
  if (!manifest.linked) {
    let existing;
    try {
      existing = (await contracts.getContractVersion(label, "1.0")).data.result;
    } catch (e) {
      if ((e as { response?: { status?: number } }).response?.status !== 404)
        throw e;
    }
    if (
      existing &&
      JSON.stringify(JSON.parse(existing.rawAbi)) !==
        JSON.stringify(artifact.abi)
    )
      throw new Error("Existing ABI differs. Do not overwrite it.");
    if (!existing)
      await contracts.createContract(label, {
        label,
        contractName: "CardPurchaseExecutor",
        version: "1.0",
        rawAbi: JSON.stringify(artifact.abi),
        bin: artifact.bytecode.object,
      });
    await addresses.setAddress({
      address: executor,
      alias: "tokyocardcheckout",
    });
    await contracts.linkAddressContract(executor, {
      label,
      version: "1.0",
      startingBlock: String(manifest.startingBlock),
    });
    manifest.linked = true;
    save();
  }
  // Only test ETH and MockJPY, with fixed small bootstrap budgets. No roles are granted.
  if (
    !manifest.gasFundingHash &&
    (await rpc.getBalance({ address: operator })) < parseEther("0.001")
  ) {
    manifest.gasFundingHash = await wallet.sendTransaction({
      to: operator,
      value: parseEther("0.002"),
      gasPrice,
    });
    save();
  }
  if (
    manifest.gasFundingHash &&
    (await rpc.waitForTransactionReceipt({ hash: manifest.gasFundingHash }))
      .status !== "success"
  )
    throw new Error("Operator gas funding failed.");
  const cashAbi = parseAbi([
    "function mint(address,uint256)",
    "function balanceOf(address) view returns (uint256)",
    "function decimals() view returns (uint8)",
  ]);
  if (
    (await rpc.readContract({
      address: cash,
      abi: cashAbi,
      functionName: "decimals",
    })) !== 18
  )
    throw new Error("Unexpected MockJPY decimals.");
  if (
    !manifest.cashFundingHash &&
    (await rpc.readContract({
      address: cash,
      abi: cashAbi,
      functionName: "balanceOf",
      args: [executor],
    })) === 0n
  ) {
    manifest.cashFundingHash = await wallet.writeContract({
      address: cash,
      abi: cashAbi,
      functionName: "mint",
      args: [executor, parseEther("10000")],
      gasPrice,
    });
    save();
  }
  if (
    manifest.cashFundingHash &&
    (await rpc.waitForTransactionReceipt({ hash: manifest.cashFundingHash }))
      .status !== "success"
  )
    throw new Error("MockJPY funding failed.");
  console.log(JSON.stringify({ ready: true, ...manifest }));
}
main().catch((error) => {
  // Avoid SDK request dumps, which include authentication headers.
  console.error(
    error?.constructor === Error
      ? error.message
      : `Card checkout setup failed (${error?.name || "network"}; HTTP ${error?.response?.status || "n/a"}). Inspect the public deployment journal.`,
  );
  process.exitCode = 1;
});
