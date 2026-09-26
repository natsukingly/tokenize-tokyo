// Server/CLI only. Never import this module into a client component.
import { Configuration, ContractsApi, TxmApi } from "@curvegrid/multibaas-sdk";
import { config, labels, type ContractKey } from "../lib/config";
import { sendViaMultiBaas } from "../lib/multibaas";
import type { OperatorSigner, WalletProvider } from "../lib/transactions";
const operations: Record<string, string[]> = {
  registry: ["verifyAsset"],
  rights: ["verifyRight", "activateRight", "closeRight"],
  revenue: ["depositRevenue"],
  settlement: ["approve"],
};
export class BrowserOperator implements OperatorSigner {
  constructor(
    private provider: WalletProvider,
    private account: string,
  ) {}
  execute(contract: ContractKey, method: string, args: unknown[]) {
    return sendViaMultiBaas(
      this.provider,
      this.account,
      contract,
      method,
      args,
    );
  }
}
export class CloudWalletOperator implements OperatorSigner {
  private contracts: ContractsApi;
  private txm: TxmApi;
  private from: string;
  constructor() {
    if (typeof window !== "undefined")
      throw new Error("Cloud Wallet is server-only");
    const url = process.env.MULTIBAAS_URL,
      key = process.env.MULTIBAAS_API_KEY,
      from = process.env.MULTIBAAS_OPERATOR_ADDRESS;
    if (!url || !key || !from) throw new Error("Cloud Wallet not configured");
    const c = new Configuration({
      basePath: new URL("/api/v0", url).toString(),
      accessToken: key,
    });
    this.contracts = new ContractsApi(c);
    this.txm = new TxmApi(c);
    this.from = from;
  }
  async execute(contract: ContractKey, method: string, args: unknown[]) {
    if (!operations[contract]?.includes(method))
      throw new Error("Operator method not allowed");
    if (
      contract === "settlement" &&
      (String(args[0]).toLowerCase() !==
        config.addresses.revenue.toLowerCase() ||
        BigInt(String(args[1])) > 10n ** 24n)
    )
      throw new Error("Only bounded RevenueVault approval is allowed");
    if (contract === "revenue" && BigInt(String(args[1])) > 10n ** 24n)
      throw new Error("Revenue amount exceeds operator cap");
    const { data } = await this.contracts.callContractFunction(
      config.addresses[contract],
      labels[contract],
      method,
      { from: this.from, args, signAndSubmit: true, nonceManagement: true },
    );
    const result = data.result as unknown as {
      submitted?: boolean;
      tx?: { hash?: string };
    };
    if (!result.submitted || !result.tx?.hash)
      throw new Error("Cloud Wallet did not submit a transaction");
    return result.tx.hash;
  }
  async status(hash: string) {
    return (
      await this.txm.listWalletTransactions(
        this.from,
        hash,
        undefined,
        undefined,
        1,
      )
    ).data.result;
  }
}
