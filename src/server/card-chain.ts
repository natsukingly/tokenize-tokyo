import {
  Configuration,
  ContractsApi,
  ChainsApi,
  HsmApi,
} from "@curvegrid/multibaas-sdk";
import {
  createPublicClient,
  http,
  parseAbi,
  zeroHash,
  zeroAddress,
  type Address,
  type Hash,
} from "viem";
import { config } from "@/lib/config";
import {
  cardAmount,
  cardExecutorAbi,
  orderCommitment,
  orderKey,
  type CardOrder,
  type CardQuote,
  type CardRequest,
} from "@/lib/card-checkout";
import type { CardSettings } from "./card-settings";

const marketAbi = parseAbi([
  "function listings(uint256) view returns (address seller, address token, uint256 rightId, uint256 remaining, uint256 unitPrice, bool cancelled)",
  "function paymentToken() view returns (address)",
  "function rights() view returns (address)",
  "function baskets() view returns (address)",
]);
const cashAbi = parseAbi(["function decimals() view returns (uint8)"]);
const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();
export interface CardChain {
  quote(input: CardRequest): Promise<CardQuote>;
  submit(order: CardOrder): Promise<string>;
  status(order: CardOrder): Promise<"pending" | "fulfilled" | "reverted">;
}

/** The only server signing surface is the fixed executor.fulfill call. */
export function cardChain(settings: CardSettings): CardChain {
  const rpc = createPublicClient({
    transport: http(settings.rpc, { timeout: 10000, retryCount: 0 }),
  });
  const sdk = new Configuration({
    basePath: new URL("/api/v0", settings.url).toString(),
    accessToken: settings.key,
    baseOptions: { timeout: 10000 },
  });
  const market = config.addresses.market as Address;
  const executor = settings.executor;
  const deployment = async () => {
    const [chainId, mb, m, operator, cash, rights, baskets, wallets, gas] =
      await Promise.all([
        rpc.getChainId(),
        new ChainsApi(sdk).getChainStatus(),
        rpc.readContract({
          address: executor,
          abi: cardExecutorAbi,
          functionName: "market",
        }),
        rpc.readContract({
          address: executor,
          abi: cardExecutorAbi,
          functionName: "operator",
        }),
        rpc.readContract({
          address: market,
          abi: marketAbi,
          functionName: "paymentToken",
        }),
        rpc.readContract({
          address: market,
          abi: marketAbi,
          functionName: "rights",
        }),
        rpc.readContract({
          address: market,
          abi: marketAbi,
          functionName: "baskets",
        }),
        new HsmApi(sdk).listHsm(),
        rpc.getBalance({ address: settings.operator }),
      ]);
    if (
      chainId !== settings.chainId ||
      mb.data.result.chainID !== chainId ||
      !same(m, market) ||
      !same(operator, settings.operator) ||
      !same(cash, config.addresses.settlement) ||
      !same(rights, config.addresses.rights) ||
      !same(baskets, config.addresses.basket) ||
      gas === 0n ||
      !wallets.data.result.some((p) =>
        p.wallets.some((w) => same(w.publicAddress, operator)),
      )
    )
      throw new Error("Checkout deployment is unavailable.");
  };
  const args = (order: Pick<CardOrder, "id" | "quote">) =>
    [
      orderKey(order.id),
      BigInt(order.quote.listingId),
      BigInt(order.quote.quantity),
      order.quote.recipient as Address,
      BigInt(order.quote.total),
    ] as const;
  const simulate = async (order: Pick<CardOrder, "id" | "quote">) => {
    await rpc.simulateContract({
      address: executor,
      abi: cardExecutorAbi,
      functionName: "fulfill",
      args: args(order),
      account: settings.operator,
    });
  };
  return {
    async quote(input) {
      await deployment();
      const [seller, token, rightId, remaining, price, cancelled] =
        await rpc.readContract({
          address: market,
          abi: marketAbi,
          functionName: "listings",
          args: [BigInt(input.listingId)],
        });
      if (
        seller === zeroAddress ||
        cancelled ||
        BigInt(input.quantity) > remaining ||
        same(input.recipient, seller) ||
        same(input.recipient, settings.operator) ||
        same(input.recipient, executor) ||
        input.recipient.toLowerCase() === zeroAddress ||
        ![config.addresses.rights, config.addresses.basket].some((t) =>
          same(t, token),
        )
      )
        throw new Error("This listing is not available for this recipient.");
      const decimals = await rpc.readContract({
        address: config.addresses.settlement as Address,
        abi: cashAbi,
        functionName: "decimals",
      });
      const total = price * BigInt(input.quantity);
      const amountJpy = cardAmount(total, decimals);
      if (amountJpy !== input.expectedJpy)
        throw new Error("The price changed. Refresh and review it again.");
      const quote = {
        listingId: input.listingId,
        quantity: input.quantity,
        recipient: input.recipient.toLowerCase(),
        total: total.toString(),
        amountJpy,
        chainId: settings.chainId,
        executor,
        market,
        token,
        rightId: String(rightId),
        seller,
      };
      await simulate({ id: input.requestId, quote });
      return quote;
    },
    async submit(order) {
      if (
        order.quote.chainId !== settings.chainId ||
        !same(order.quote.executor, executor) ||
        !same(order.quote.market, market)
      )
        throw new Error("Order deployment changed.");
      await deployment();
      await simulate(order);
      const { data } = await new ContractsApi(sdk).callContractFunction(
        executor,
        "cardpurchaseexecutor",
        "fulfill",
        {
          from: settings.operator,
          args: args(order).map((v) =>
            typeof v === "bigint" ? v.toString() : v,
          ),
          signAndSubmit: true,
          nonceManagement: true,
        },
      );
      const result = data.result as unknown as {
        submitted?: boolean;
        tx?: { hash?: string };
      };
      if (!result.submitted || !/^0x[\da-f]{64}$/i.test(result.tx?.hash || ""))
        throw new Error("Submission outcome unknown.");
      return result.tx!.hash!;
    },
    async status(order) {
      if (
        order.quote.chainId !== settings.chainId ||
        !same(order.quote.executor, executor)
      )
        throw new Error("Order deployment changed.");
      if ((await rpc.getChainId()) !== settings.chainId)
        throw new Error("Network mismatch.");
      // A mined transaction is not enough: verify the delivery commitment with two confirmations.
      const head = await rpc.getBlockNumber({ cacheTime: 0 });
      const confirmed = head > 1n ? head - 1n : 0n;
      const value = await rpc.readContract({
        address: executor,
        abi: cardExecutorAbi,
        functionName: "fulfilled",
        args: [orderKey(order.id)],
        blockNumber: confirmed,
      });
      if (value === orderCommitment(order.quote)) return "fulfilled";
      if (value !== zeroHash) return "reverted";
      if (order.txHash) {
        try {
          const receipt = await rpc.getTransactionReceipt({
            hash: order.txHash as Hash,
          });
          if (receipt.blockNumber <= confirmed && receipt.status === "reverted")
            return "reverted";
        } catch (error) {
          if (
            (error as { name?: string }).name !==
            "TransactionReceiptNotFoundError"
          )
            throw error;
        }
      }
      return "pending";
    },
  };
}
