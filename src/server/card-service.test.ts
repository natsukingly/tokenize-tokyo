import { beforeEach, describe, expect, it, vi } from "vitest";
import type Stripe from "stripe";
import {
  cardAmount,
  cardRequest,
  orderCommitment,
  type CardOrder,
  type CardQuote,
} from "@/lib/card-checkout";
import { cardService, validPaidSession, type CardStripe } from "./card-service";
import type { CardStore } from "./card-store";
import { boundedText, browserToken } from "./card-http";

const id = "fde9ed92-8d7f-480f-8ef6-77d104fe6600";
const recipient = `0x${"b".repeat(40)}`;
const hash = `0x${"d".repeat(64)}`;
const quote: CardQuote = {
  listingId: "1",
  quantity: "2",
  recipient,
  total: String(200n * 10n ** 18n),
  amountJpy: 200,
  chainId: 11155111,
  executor: `0x${"e".repeat(40)}`,
  market: `0x${"f".repeat(40)}`,
  token: `0x${"a".repeat(40)}`,
  rightId: "1",
  seller: `0x${"c".repeat(40)}`,
};
const request = {
  requestId: id,
  listingId: "1",
  quantity: "2",
  recipient,
  expectedJpy: 200,
  acceptedTerms: true as const,
};
function fixture() {
  const rows = new Map<string, CardOrder>();
  const store: CardStore = {
    get: async (id) => {
      const value = rows.get(id);
      return value && structuredClone(value);
    },
    insert: async (order) => {
      if (!rows.has(order.id)) rows.set(order.id, structuredClone(order));
      return structuredClone(rows.get(order.id)!);
    },
    attachSession: async (id, sessionId) => {
      const o = rows.get(id)!;
      if (o.state === "creating")
        Object.assign(o, { sessionId, state: "awaiting_payment" });
    },
    transition: async (id, from, to, txHash) => {
      const o = rows.get(id)!;
      if (!from.includes(o.state)) return false;
      o.state = to;
      if (txHash) o.txHash = txHash;
      return true;
    },
    rateLimit: async () => true,
  };
  const session = {
    id: "cs_test_123",
    livemode: false,
    mode: "payment",
    status: "open",
    payment_status: "unpaid",
    currency: "jpy",
    amount_total: 200,
    client_reference_id: id,
    metadata: {
      app: "tokenize-tokyo",
      orderId: id,
      commitment: orderCommitment(quote),
    },
    url: "https://checkout.stripe.com/c/pay/cs_test_123",
  } as unknown as Stripe.Checkout.Session;
  const create = vi.fn(async () => session);
  const retrieve = vi.fn(async () => session);
  const stripe = {
    checkout: { sessions: { create, retrieve } },
  } as unknown as CardStripe;
  const chain = {
    quote: vi.fn(async () => quote),
    submit: vi.fn(async () => hash),
    status: vi.fn(
      async (): Promise<"pending" | "fulfilled" | "reverted"> => "pending",
    ),
  };
  const service = cardService(store, stripe, chain, "https://app.test");
  const pay = () => {
    session.status = "complete";
    session.payment_status = "paid";
  };
  return { rows, store, session, create, retrieve, chain, service, pay };
}
describe("card fulfillment", () => {
  let f: ReturnType<typeof fixture>;
  beforeEach(async () => {
    f = fixture();
    await f.service.create(request, "owner");
  });
  it("uses server pricing, test Checkout and a stable idempotency key", () => {
    expect(f.create).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: "payment",
        payment_method_types: ["card"],
        success_url: `https://app.test/checkout/${id}`,
        line_items: [
          expect.objectContaining({
            price_data: expect.objectContaining({
              unit_amount: 200,
              currency: "jpy",
            }),
          }),
        ],
      }),
      { idempotencyKey: `tokenize-card-${id}` },
    );
  });
  it("does not sign for an unpaid checkout or a visit to status", async () => {
    await f.service.fulfill(f.session.id);
    await f.service.status(f.rows.get(id)!);
    expect(f.chain.submit).not.toHaveBeenCalled();
  });
  it("claims simultaneous and repeated webhook deliveries once", async () => {
    f.pay();
    await Promise.all(
      Array.from({ length: 10 }, () => f.service.fulfill(f.session.id)),
    );
    expect(f.chain.submit).toHaveBeenCalledTimes(1);
    expect(f.rows.get(id)).toMatchObject({ state: "submitted", txHash: hash });
    f.chain.status.mockResolvedValue("fulfilled");
    expect(await f.service.status(f.rows.get(id)!)).toMatchObject({
      state: "fulfilled",
    });
    await f.service.fulfill(f.session.id);
    expect(f.chain.submit).toHaveBeenCalledTimes(1);
  });
  it.each([
    { livemode: true },
    { amount_total: 199 },
    { currency: "usd" },
    { status: "open" },
    { mode: "subscription" },
    { payment_status: "unpaid" },
    { client_reference_id: "wrong" },
    { metadata: { app: "tokenize-tokyo", orderId: id, commitment: "wrong" } },
  ])("rejects untrusted payment fields %j", async (change) => {
    f.pay();
    Object.assign(f.session, change);
    expect(validPaidSession(f.session, f.rows.get(id)!)).toBe(false);
    await f.service.fulfill(f.session.id);
    expect(f.chain.submit).not.toHaveBeenCalled();
  });
  it("keeps an uncertain submission claimed and later recovers from chain proof", async () => {
    f.pay();
    f.chain.submit.mockRejectedValue(
      new Error("Network timeout after broadcast"),
    );
    await f.service.fulfill(f.session.id);
    expect(f.rows.get(id)?.state).toBe("review");
    await f.service.fulfill(f.session.id);
    expect(f.chain.submit).toHaveBeenCalledTimes(1);
    f.chain.status.mockResolvedValue("fulfilled");
    expect(await f.service.status(f.rows.get(id)!)).toMatchObject({
      state: "fulfilled",
    });
  });
  it("requires review after a mined revert without retrying payment", async () => {
    f.pay();
    await f.service.fulfill(f.session.id);
    f.chain.status.mockResolvedValue("reverted");
    expect(await f.service.status(f.rows.get(id)!)).toMatchObject({
      state: "review",
    });
  });
  it("recovers a session created before a lost database response", async () => {
    Object.assign(f.rows.get(id)!, { state: "creating", sessionId: null });
    f.pay();
    await f.service.fulfill(f.session.id);
    expect(f.rows.get(id)).toMatchObject({
      state: "submitted",
      sessionId: f.session.id,
    });
  });
  it("does not release a claim after a simulated process crash", async () => {
    f.pay();
    f.rows.get(id)!.state = "fulfilling";
    await f.service.fulfill(f.session.id);
    expect(f.chain.submit).not.toHaveBeenCalled();
  });
  it("prevents another browser or changed payload from reusing an order", async () => {
    await expect(f.service.create(request, "attacker")).rejects.toThrow(
      "Order conflict",
    );
    await expect(
      f.service.create({ ...request, quantity: "3" }, "owner"),
    ).rejects.toThrow("Order conflict");
    expect(f.create).toHaveBeenCalledTimes(1);
  });
  it("reuses an existing checkout instead of creating another charge", async () => {
    await f.service.create(request, "owner");
    expect(f.create).toHaveBeenCalledTimes(1);
  });
  it("expires only the corresponding unpaid order", async () => {
    f.session.status = "expired";
    await f.service.fulfill(f.session.id);
    expect(f.rows.get(id)?.state).toBe("expired");
    expect(f.chain.submit).not.toHaveBeenCalled();
  });
});

it("validates exact yen amounts without rounding and rejects injected parameters", () => {
  expect(cardAmount(200n * 10n ** 18n, 18)).toBe(200);
  expect(() => cardAmount(200n * 10n ** 18n + 1n, 18)).toThrow();
  expect(() => cardAmount(49n, 0)).toThrow();
  expect(() => cardAmount(100_001n, 0)).toThrow();
  expect(cardRequest.safeParse({ ...request, quantity: "1.2" }).success).toBe(
    false,
  );
  expect(
    cardRequest.safeParse({
      ...request,
      method: "transfer",
      contract: "attacker",
    }).success,
  ).toBe(false);
  expect(
    cardRequest.safeParse({ ...request, acceptedTerms: false }).success,
  ).toBe(false);
});
it("bounds streamed request bodies and parses only the browser capability cookie", async () => {
  await expect(
    boundedText(
      new Request("https://app.test", { method: "POST", body: "12345" }),
      4,
    ),
  ).rejects.toThrow();
  const token = "a".repeat(64);
  expect(
    browserToken(
      new Request("https://app.test", {
        headers: { cookie: `other=foo; tt-card-browser=${token}` },
      }),
    ),
  ).toBe(token);
  expect(
    browserToken(
      new Request("https://app.test", {
        headers: { cookie: "tt-card-browser=bad" },
      }),
    ),
  ).toBeUndefined();
});
