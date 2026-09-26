import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import postgres from "postgres";
import { createCardStore } from "./card-store";
import type { CardOrder } from "@/lib/card-checkout";

// Explicit opt-in: this must point to a disposable isolated PostgreSQL test database.
describe.skipIf(!process.env.CARD_TEST_DATABASE_URL)(
  "durable card order store",
  () => {
    const sql = postgres(
      process.env.CARD_TEST_DATABASE_URL || "postgres://localhost/unused",
      { max: 5 },
    );
    const store = createCardStore(sql);
    const id = randomUUID();
    const order: CardOrder = {
      id,
      ownerHash: "test-owner",
      state: "creating",
      sessionId: null,
      txHash: null,
      createdAt: 100,
      quote: {
        listingId: "1",
        quantity: "2",
        recipient: `0x${"b".repeat(40)}`,
        total: "200000000000000000000",
        amountJpy: 200,
        chainId: 11155111,
        executor: `0x${"e".repeat(40)}`,
        market: `0x${"a".repeat(40)}`,
        token: `0x${"c".repeat(40)}`,
        rightId: "1",
        seller: `0x${"d".repeat(40)}`,
      },
    };
    beforeAll(async () => {
      await sql.unsafe(await readFile("db/card-checkout.sql", "utf8"));
    });
    afterAll(async () => {
      await sql`DELETE FROM card_orders WHERE id = ${id}`;
      await sql.end();
    });
    it("persists immutable quotes, claims once across connections and keeps the transaction hash", async () => {
      await Promise.all(Array.from({ length: 5 }, () => store.insert(order)));
      await store.insert({
        ...order,
        ownerHash: "attacker",
        quote: { ...order.quote, amountJpy: 1 },
      });
      expect(await store.get(id)).toEqual(order);
      await store.attachSession(id, `cs_test_${id}`);
      const claims = await Promise.all(
        Array.from({ length: 20 }, () =>
          store.transition(id, ["awaiting_payment"], "fulfilling"),
        ),
      );
      expect(claims.filter(Boolean)).toHaveLength(1);
      const hash = `0x${"f".repeat(64)}`;
      await store.transition(id, ["fulfilling"], "submitted", hash);
      // A second independent client sees the durable claim and cannot repeat it.
      const second = postgres(process.env.CARD_TEST_DATABASE_URL!, { max: 1 });
      try {
        const other = createCardStore(second);
        expect(
          await other.transition(id, ["awaiting_payment"], "fulfilling"),
        ).toBe(false);
        await other.transition(id, ["submitted"], "fulfilled");
        expect(await other.get(id)).toMatchObject({
          state: "fulfilled",
          txHash: hash,
          ownerHash: "test-owner",
        });
      } finally {
        await second.end();
      }
    });
    it("shares rate limits across connections", async () => {
      const bucket = `qa:${id}`;
      const results = await Promise.all(
        Array.from({ length: 10 }, () => store.rateLimit(bucket, 3)),
      );
      expect(results.filter(Boolean)).toHaveLength(3);
      await sql`DELETE FROM card_checkout_limits WHERE bucket = ${bucket}`;
    });
  },
);
