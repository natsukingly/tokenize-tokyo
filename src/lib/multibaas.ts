import {
  Configuration,
  ContractsApi,
  EventQueriesApi,
  ChainsApi,
  type EventQuery,
  type TransactionToSignResponse,
} from "@curvegrid/multibaas-sdk";
import { config, labels, type ContractKey } from "./config";
import { events, eventQuery } from "./queries";
import { project } from "./projection";
import { walletTransaction, type WalletProvider } from "./transactions";
import type { ChainEvent, MarketState } from "./model";
export function clients(url = config.url, key = config.key) {
  if (!url || !key)
    throw new Error("Set the MultiBaas URL and DApp User key in .env.local.");
  const configuration = new Configuration({
    basePath: new URL("/api/v0", url).toString(),
    accessToken: key,
    baseOptions: { timeout: 20000 },
  });
  return {
    contracts: new ContractsApi(configuration),
    queries: new EventQueriesApi(configuration),
    chains: new ChainsApi(configuration),
  };
}
export async function readContract(
  contract: ContractKey,
  method: string,
  args: unknown[] = [],
) {
  const { data } = await clients().contracts.callContractFunction(
    config.addresses[contract],
    labels[contract],
    method,
    { args, formatInts: "as_strings" },
  );
  if (data.result.kind !== "MethodCallResponse" || !("output" in data.result))
    throw new Error("Unexpected MultiBaas read response");
  return data.result.output as unknown;
}
export async function queryRows(
  query: EventQuery,
): Promise<Record<string, unknown>[]> {
  const api = clients().queries;
  const rows: Record<string, unknown>[] = [];
  // MultiBaas rejects limit values above 50 with a bare "invalid request".
  const PAGE = 50;
  for (let offset = 0; offset < 100000; offset += PAGE) {
    const { data } = await api.executeArbitraryEventQuery(query, offset, PAGE);
    const page = data.result.rows as Record<string, unknown>[];
    rows.push(...page);
    if (page.length < PAGE) return rows;
  }
  throw new Error(
    "Event result limit reached; narrow query range before rendering incomplete market data.",
  );
}
export async function loadMarket(account?: string): Promise<MarketState> {
  const all: ChainEvent[] = [];
  // Small bounded batches: avoid flooding the deployment while retaining SDK-indexed discovery.
  const names = Object.keys(events);
  for (let i = 0; i < names.length; i += 4) {
    const streams = await Promise.all(
      names.slice(i, i + 4).map(async (name) => {
        const spec = events[name];
        const rows = await queryRows(
          eventQuery(name, config.addresses[spec.contract]),
        );
        return rows.map((row) => ({
          name,
          contract: spec.contract,
          args: row,
          block: Number(row.block),
          txHash: String(row.txHash),
          timestamp: String(row.timestamp),
        }));
      }),
    );
    all.push(...streams.flat());
  }
  const state = project(
    all.sort((a, b) => a.block - b.block),
    config.addresses.rights,
  );
  // Event Query exposes block order but no log index. Resolve tied lifecycle
  // transitions through the SDK so multiple transactions in one block cannot
  // make a revised/rejected asset appear verified (or vice versa).
  for (const asset of state.assets) {
    const lifecycle = all.filter(
      (e) =>
        [
          "AssetRegistered",
          "AssetUpdated",
          "AssetVerificationRequested",
          "AssetRejected",
          "AssetVerified",
        ].includes(e.name) && String(e.args.assetId) === asset.id,
    );
    const latestBlock = Math.max(...lifecycle.map((e) => e.block));
    if (lifecycle.filter((e) => e.block === latestBlock).length > 1) {
      const current = (await readContract("registry", "getAsset", [
        asset.id,
      ])) as { status?: unknown } | unknown[];
      const status = Number(
        Array.isArray(current) ? current[4] : current.status,
      );
      if (!Number.isInteger(status) || status < 0 || status > 3)
        throw new Error("Invalid registry state response");
      asset.status = (
        ["Draft", "Pending verification", "Verified", "Rejected"] as const
      )[status];
    }
  }
  const totals = await Promise.all(
    [
      ["ListingPurchased", "totalPrice"],
      ["RevenueDeposited", "amount"],
      ["RevenueClaimed", "amount"],
    ].map(async ([name, field]) => {
      const rows = await queryRows(
        eventQuery(name, config.addresses[events[name].contract], {
          field,
          op: "add",
        }),
      );
      return String(rows[0]?.value || "0");
    }),
  );
  [state.metrics.volume, state.metrics.deposited, state.metrics.claimed] =
    totals;
  if (account) {
    state.cash = String(
      await readContract("settlement", "balanceOf", [account]),
    );
    for (const [token, items] of [
      ["rights", state.rights],
      ["basket", state.baskets],
    ] as const) {
      for (const item of items) {
        const key = token + ":" + item.id;
        const [balance, claimable] = await Promise.all([
          readContract(token, "balanceOf", [account, item.id]),
          readContract(token === "rights" ? "revenue" : "basket", "claimable", [
            item.id,
            account,
          ]),
        ]);
        state.balances[key] = String(balance);
        state.claimable[key] = String(claimable);
      }
    }
  }
  return state;
}
export async function sendViaMultiBaas(
  provider: WalletProvider,
  from: string,
  contract: ContractKey,
  method: string,
  args: unknown[] = [],
) {
  const chain = Number(
    BigInt(String(await provider.request({ method: "eth_chainId" }))),
  );
  if (chain !== config.chainId)
    throw new Error(`Switch your wallet to chain ${config.chainId}.`);
  const { data } = await clients().contracts.callContractFunction(
    config.addresses[contract],
    labels[contract],
    method,
    { args, from, signAndSubmit: false, formatInts: "as_strings" },
  );
  if (data.result.kind !== "TransactionToSignResponse")
    throw new Error("MultiBaas did not return an unsigned transaction");
  const result = data.result as unknown as TransactionToSignResponse;
  if (result.submitted) throw new Error("Unexpected server-signed transaction");
  const tx = walletTransaction(result.tx, from, config.addresses[contract]);
  const hash = String(
    await provider.request({ method: "eth_sendTransaction", params: [tx] }),
  );
  // Wallet RPC is used only for signing/submission/receipt, never as an independent contract data backend.
  for (let i = 0; i < 90; i++) {
    const receipt = (await provider.request({
      method: "eth_getTransactionReceipt",
      params: [hash],
    })) as { status: string } | null;
    if (receipt) {
      if (BigInt(receipt.status) !== 1n)
        throw new Error("Transaction reverted: " + hash);
      return hash;
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error("Transaction submitted; confirmation pending: " + hash);
}
