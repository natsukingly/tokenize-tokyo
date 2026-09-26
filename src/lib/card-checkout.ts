import { encodeAbiParameters, keccak256, parseAbi, stringToHex } from "viem";
import { z } from "zod";

export const cardRequest = z
  .object({
    requestId: z.uuid(),
    listingId: z.string().regex(/^[1-9]\d{0,17}$/),
    quantity: z.string().regex(/^[1-9]\d{0,5}$/),
    recipient: z.string().regex(/^0x[\da-f]{40}$/i),
    expectedJpy: z.number().int().min(50).max(100_000),
    acceptedTerms: z.literal(true),
  })
  .strict();
export type CardRequest = z.infer<typeof cardRequest>;
export type CardOrderState =
  | "creating"
  | "awaiting_payment"
  | "fulfilling"
  | "submitted"
  | "fulfilled"
  | "expired"
  | "review";
export type CardQuote = {
  listingId: string;
  quantity: string;
  recipient: string;
  total: string;
  amountJpy: number;
  chainId: number;
  executor: string;
  market: string;
  token: string;
  rightId: string;
  seller: string;
};
export type CardOrder = {
  id: string;
  ownerHash: string;
  quote: CardQuote;
  state: CardOrderState;
  sessionId: string | null;
  txHash: string | null;
  createdAt: number;
};
export type CardOrderView = Pick<CardOrder, "id" | "state" | "txHash"> & {
  recipient: string;
  quantity: string;
  amountJpy: number;
  chainId: number;
  checkoutUrl?: string;
};
export const cardOrderView = z
  .object({
    id: z.uuid(),
    state: z.enum([
      "creating",
      "awaiting_payment",
      "fulfilling",
      "submitted",
      "fulfilled",
      "expired",
      "review",
    ]),
    txHash: z
      .string()
      .regex(/^0x[\da-f]{64}$/i)
      .nullable(),
    recipient: z.string().regex(/^0x[\da-f]{40}$/i),
    quantity: z.string().regex(/^[1-9]\d{0,5}$/),
    amountJpy: z.number().int().min(50).max(100_000),
    chainId: z.number().int().positive(),
    checkoutUrl: z
      .url()
      .refine((url) => new URL(url).origin === "https://checkout.stripe.com")
      .optional(),
  })
  .refine((order) => order.state !== "fulfilled" || order.txHash !== null);

/** Test pricing only: exactly 1 MockJPY = 1 simulated JPY. Never round a charge. */
export function cardAmount(total: bigint, decimals: number) {
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 36)
    throw new Error("Invalid decimals");
  const scale = 10n ** BigInt(decimals);
  if (total % scale !== 0n || total / scale < 50n || total / scale > 100_000n)
    throw new Error(
      "Card tests support whole-yen totals from ¥50 to ¥100,000.",
    );
  return Number(total / scale);
}
export const orderKey = (id: string) =>
  keccak256(stringToHex(`tokenize-tokyo:card:${id}`));
export function orderCommitment(q: CardQuote) {
  return keccak256(
    encodeAbiParameters(
      [
        { type: "uint256" },
        { type: "uint256" },
        { type: "address" },
        { type: "uint256" },
      ],
      [
        BigInt(q.listingId),
        BigInt(q.quantity),
        q.recipient as `0x${string}`,
        BigInt(q.total),
      ],
    ),
  );
}
export const cardExecutorAbi = parseAbi([
  "function market() view returns (address)",
  "function operator() view returns (address)",
  "function fulfilled(bytes32) view returns (bytes32)",
  "function fulfill(bytes32 orderId, uint256 listingId, uint256 quantity, address recipient, uint256 expectedTotal)",
]);
