import postgres from "postgres";
import type { CardOrder, CardOrderState } from "@/lib/card-checkout";

export interface CardStore {
  get(id: string): Promise<CardOrder | undefined>;
  insert(order: CardOrder): Promise<CardOrder>;
  attachSession(id: string, sessionId: string): Promise<void>;
  transition(
    id: string,
    from: CardOrderState[],
    to: CardOrderState,
    txHash?: string,
  ): Promise<boolean>;
  rateLimit(bucket: string, limit: number): Promise<boolean>;
}
type Row = {
  id: string;
  owner_hash: string;
  quote: CardOrder["quote"];
  state: CardOrderState;
  session_id: string | null;
  tx_hash: string | null;
  created_at: string;
};
const orderFrom = (r: Row): CardOrder => ({
  id: r.id,
  ownerHash: r.owner_hash,
  quote: r.quote,
  state: r.state,
  sessionId: r.session_id,
  txHash: r.tx_hash,
  createdAt: Number(r.created_at),
});
let connection: ReturnType<typeof postgres> | undefined;
export function cardStore(databaseUrl: string): CardStore {
  const sql = (connection ||= postgres(databaseUrl, {
    // Hosted connections must authenticate the server, even when the provider URL uses sslmode=require.
    ssl: ["localhost", "127.0.0.1", "[::1]"].includes(
      new URL(databaseUrl).hostname,
    )
      ? undefined
      : { rejectUnauthorized: true },
    max: 3,
    prepare: false,
    idle_timeout: 10,
    connect_timeout: 5,
  }));
  return createCardStore(sql);
}
export function createCardStore(sql: ReturnType<typeof postgres>): CardStore {
  return {
    async get(id) {
      const [row] = await sql<
        Row[]
      >`SELECT * FROM card_orders WHERE id = ${id}`;
      return row && orderFrom(row);
    },
    async insert(order) {
      await sql`INSERT INTO card_orders (id, owner_hash, quote, state, created_at)
        VALUES (${order.id}, ${order.ownerHash}, ${sql.json(order.quote)}, 'creating', ${order.createdAt})
        ON CONFLICT (id) DO NOTHING`;
      const [row] = await sql<
        Row[]
      >`SELECT * FROM card_orders WHERE id = ${order.id}`;
      return orderFrom(row);
    },
    async attachSession(id, sessionId) {
      await sql`UPDATE card_orders SET session_id = ${sessionId}, state = 'awaiting_payment', updated_at = now()
        WHERE id = ${id} AND state = 'creating' AND (session_id IS NULL OR session_id = ${sessionId})`;
    },
    async transition(id, from, to, txHash) {
      const rows =
        await sql`UPDATE card_orders SET state = ${to}, tx_hash = coalesce(${txHash || null}, tx_hash), updated_at = now()
        WHERE id = ${id} AND state IN ${sql(from)} RETURNING id`;
      return rows.length === 1;
    },
    async rateLimit(bucket, limit) {
      const [r] =
        await sql`INSERT INTO card_checkout_limits (bucket, attempts) VALUES (${bucket}, 1)
        ON CONFLICT (bucket) DO UPDATE SET attempts = card_checkout_limits.attempts + 1 RETURNING attempts`;
      return r.attempts <= limit;
    },
  };
}
