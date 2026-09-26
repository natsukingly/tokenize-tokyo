import { z } from "zod";
import { ASSET_KINDS } from "./catalog";
import type { FinanceState } from "./finance-lab";

const count = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const positive = count.min(1);
const id = z.string().min(1);
const schema = z.object({
  version: z.literal(1),
  cash: count,
  sequence: count,
  offers: z.array(
    z
      .object({
        id,
        name: id,
        kind: z.enum(ASSET_KINDS),
        mode: z.enum(["fraction", "rental"]),
        underlying: id,
        price: positive,
        available: count,
        total: positive,
        maxDays: count,
        provider: id,
      })
      .refine((offer) => offer.available <= offer.total),
  ),
  positions: z.array(z.object({ id, offerId: id, shares: count })),
  resales: z.array(
    z.object({
      id,
      offerId: id,
      shares: positive,
      price: positive,
      filled: z.boolean(),
    }),
  ),
  rentals: z.array(
    z.object({
      id,
      offerId: id,
      days: positive,
      endsAt: count,
      active: z.boolean(),
      ownerRetainsToken: z.literal(true),
    }),
  ),
});

/** Browser persistence is untrusted; validate nested values before rendering. */
export function parseFinanceStorage(value: unknown): FinanceState | null {
  const result = schema.safeParse(value);
  if (!result.success) return null;
  const saved = result.data;
  for (const entries of [
    saved.offers,
    saved.positions,
    saved.resales,
    saved.rentals,
  ])
    if (new Set(entries.map((entry) => entry.id)).size !== entries.length)
      return null;
  const modes = new Map(saved.offers.map((offer) => [offer.id, offer.mode]));
  if (
    saved.positions.some((entry) => modes.get(entry.offerId) !== "fraction") ||
    saved.resales.some((entry) => modes.get(entry.offerId) !== "fraction") ||
    saved.rentals.some((entry) => modes.get(entry.offerId) !== "rental")
  )
    return null;
  return saved;
}
