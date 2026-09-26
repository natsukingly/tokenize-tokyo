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
import { assertWallet, isTxHash, type TransactionProgress } from "./wallet";
import type { ChainEvent, MarketState } from "./model";
import {
  indexBootstrap,
  combineIndexedEvents,
  combineIndexedTotal,
} from "./index-bootstrap";
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
  const bootstrap = indexBootstrap(config.chainId, config.addresses);
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
          source: "multibaas" as const,
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
  const combined = combineIndexedEvents(bootstrap, all);
  const state = project(combined, config.addresses.rights);
  // Event Query exposes block order but no log index. Resolve tied lifecycle
  // transitions through the SDK so multiple transactions in one block cannot
  // make a revised/rejected asset appear verified (or vice versa).
  for (const asset of state.assets) {
    const lifecycle = combined.filter(
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
      // When the initial archive contains monetary events, add only those absent
      // from the live index. Keep MultiBaas' aggregate, even after a full backfill.
      return combineIndexedTotal(
        bootstrap,
        all,
        name,
        field,
        String(rows[0]?.value || "0"),
      );
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
      if (!items.length) continue;
      const balances = (await readContract(token, "balanceOfBatch", [
        items.map(() => account),
        items.map((item) => item.id),
      ])) as string[];
      items.forEach((item, i) => {
        state.balances[token + ":" + item.id] = String(balances[i]);
      });
      // Past holders can still claim accrued revenue, even with a zero balance.
      for (let i = 0; i < items.length; i += 4) {
        await Promise.all(
          items.slice(i, i + 4).map(async (item) => {
            state.claimable[token + ":" + item.id] = String(
              await readContract(
                token === "rights" ? "revenue" : "basket",
                "claimable",
                [item.id, account],
              ),
            );
          }),
        );
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
  onProgress?: (progress: TransactionProgress) => void,
) {
  return sendAtMultiBaas(
    provider,
    from,
    config.addresses[contract],
    labels[contract],
    method,
    args,
    onProgress,
  );
}

/** ENS targets come from a verified on-chain binding. Exact calldata must match the reviewed intent. */
export async function sendVerifiedCallViaMultiBaas(
  provider: WalletProvider,
  from: string,
  target: {
    address: string;
    label: string;
    method: string;
    args: unknown[];
    data: string;
  },
  onProgress?: (progress: TransactionProgress) => void,
) {
  if (config.chainId !== 11155111 || !/^0x[0-9a-f]+$/i.test(target.data))
    throw new Error("ENS delegation requires the Sepolia protocol deployment.");
  return sendAtMultiBaas(
    provider,
    from,
    target.address,
    target.label,
    target.method,
    target.args,
    onProgress,
    target.data,
  );
}

export async function sendAtMultiBaas(
  provider: WalletProvider,
  from: string,
  address: string,
  label: string,
  method: string,
  args: unknown[],
  onProgress?: (progress: TransactionProgress) => void,
  expectedData?: string,
) {
  onProgress?.({ phase: "preparing" });
  await assertWallet(provider, from);
  const { data } = await clients().contracts.callContractFunction(
    address,
    label,
    method,
    { args, from, signAndSubmit: false, formatInts: "as_strings" },
  );
  if (data.result.kind !== "TransactionToSignResponse")
    throw new Error("MultiBaas did not return an unsigned transaction");
  const result = data.result as unknown as TransactionToSignResponse;
  if (result.submitted) throw new Error("Unexpected server-signed transaction");
  const tx = walletTransaction(result.tx, from, address);
  if (expectedData && tx.data.toLowerCase() !== expectedData.toLowerCase())
    throw new Error(
      "MultiBaas calldata does not match the reviewed ENS action.",
    );
  // Check again after the remote composition call, including between approval
  // and purchase. Never sign for a stale account or on a different chain.
  await assertWallet(provider, from);
  onProgress?.({ phase: "signature" });
  const hash = String(
    await provider.request({ method: "eth_sendTransaction", params: [tx] }),
  );
  if (!isTxHash(hash))
    throw new Error("Wallet returned an invalid transaction hash.");
  onProgress?.({ phase: "submitted", hash });
  // Read receipts from the configured chain via MultiBaas even if the user
  // changes their wallet network while this transaction is confirming.
  for (let i = 0; i < 60; i++) {
    let receipt;
    try {
      receipt = (await clients().chains.getTransactionReceipt(hash)).data.result
        .data;
    } catch (error) {
      const status = (error as { response?: { status?: number } }).response
        ?.status;
      if (status !== 404 && status !== 400) break;
    }
    if (receipt) {
      if (BigInt(receipt.status) !== 1n) {
        onProgress?.({ phase: "reverted", hash });
        throw new Error(
          "Transaction reverted. Open the transaction to inspect the receipt.",
        );
      }
      onProgress?.({ phase: "confirmed", hash });
      return hash;
    }
    await new Promise((resolve) => setTimeout(resolve, 1500));
  }
  onProgress?.({ phase: "pending", hash });
  throw new Error(
    "Transaction was submitted; confirmation is still pending. Check the explorer before retrying.",
  );
}
