import type Stripe from "stripe";
import type { CardOrder, CardRequest } from "@/lib/card-checkout";
import { orderCommitment } from "@/lib/card-checkout";
import type { CardStore } from "./card-store";
import type { CardChain } from "./card-chain";

export type CardStripe = Pick<Stripe, "checkout">;
export function validPaidSession(
  session: Stripe.Checkout.Session,
  order: CardOrder,
) {
  return (
    !session.livemode &&
    session.id === order.sessionId &&
    session.mode === "payment" &&
    session.status === "complete" &&
    session.payment_status === "paid" &&
    session.currency === "jpy" &&
    session.amount_total === order.quote.amountJpy &&
    session.client_reference_id === order.id &&
    session.metadata?.orderId === order.id &&
    session.metadata?.commitment === orderCommitment(order.quote) &&
    session.metadata?.app === "tokenize-tokyo"
  );
}
export function cardService(
  store: CardStore,
  stripe: CardStripe,
  chain: CardChain,
  origin: string,
) {
  return {
    async create(input: CardRequest, ownerHash: string) {
      let order = await store.get(input.requestId);
      if (!order) {
        const quote = await chain.quote(input);
        order = await store.insert({
          id: input.requestId,
          ownerHash,
          quote,
          state: "creating",
          sessionId: null,
          txHash: null,
          createdAt: Math.floor(Date.now() / 1000),
        });
      }
      if (
        order.ownerHash !== ownerHash ||
        order.quote.listingId !== input.listingId ||
        order.quote.quantity !== input.quantity ||
        order.quote.recipient.toLowerCase() !== input.recipient.toLowerCase() ||
        order.quote.amountJpy !== input.expectedJpy
      )
        throw new Error("Order conflict.");
      if (!["creating", "awaiting_payment"].includes(order.state))
        throw new Error("This order has already been processed.");
      // Stripe idempotency + the durable row recover a timeout between session creation and persistence.
      const session = order.sessionId
        ? await stripe.checkout.sessions.retrieve(order.sessionId)
        : await stripe.checkout.sessions.create(
            {
              mode: "payment",
              payment_method_types: ["card"],
              client_reference_id: order.id,
              metadata: {
                app: "tokenize-tokyo",
                orderId: order.id,
                commitment: orderCommitment(order.quote),
              },
              line_items: [
                {
                  price_data: {
                    currency: "jpy",
                    unit_amount: order.quote.amountJpy,
                    product_data: {
                      name: `TOKENIZE TOKYO · listing #${order.quote.listingId} · ${order.quote.quantity} units`,
                      description:
                        "TEST ONLY · simulated payment for testnet rights. No real charge.",
                    },
                  },
                  quantity: 1,
                },
              ],
              expires_at: order.createdAt + 3600,
              success_url: `${origin}/checkout/${order.id}`,
              cancel_url: `${origin}/checkout/${order.id}?cancelled=1`,
            },
            { idempotencyKey: `tokenize-card-${order.id}` },
          );
      if (
        session.livemode ||
        !session.url ||
        session.status !== "open" ||
        new URL(session.url).hostname !== "checkout.stripe.com"
      )
        throw new Error("Checkout is no longer open.");
      await store.attachSession(order.id, session.id);
      return { orderId: order.id, url: session.url };
    },
    async fulfill(sessionId: string) {
      // Never use browser success URLs or unverified event fields as proof of payment.
      const session = await stripe.checkout.sessions.retrieve(sessionId);
      if (session.metadata?.app !== "tokenize-tokyo") return;
      const id = session.metadata?.orderId;
      if (!id || !/^[\da-f]{8}(-[\da-f]{4}){3}-[\da-f]{12}$/i.test(id))
        throw new Error("Invalid order reference.");
      const order = await store.get(id);
      if (!order) throw new Error("Order not yet persisted.");
      // Recover a creation response lost after Stripe created the session.
      if (
        !order.sessionId &&
        order.state === "creating" &&
        session.client_reference_id === id &&
        session.metadata.commitment === orderCommitment(order.quote) &&
        !session.livemode
      ) {
        await store.attachSession(id, session.id);
        order.sessionId = session.id;
      }
      if (!validPaidSession(session, order)) {
        if (
          !session.livemode &&
          session.id === order.sessionId &&
          session.status === "expired"
        )
          await store.transition(id, ["awaiting_payment"], "expired");
        return;
      }
      // A durable atomic claim prevents simultaneous webhooks from signing twice.
      // Claims are NEVER automatically released on timeout; reconcile the chain first.
      if (!(await store.transition(id, ["awaiting_payment"], "fulfilling")))
        return;
      try {
        if ((await chain.status(order)) === "fulfilled") {
          await store.transition(id, ["fulfilling"], "fulfilled");
          return;
        }
        const hash = await chain.submit(order);
        await store.transition(id, ["fulfilling"], "submitted", hash);
      } catch {
        // The remote signer may have submitted before a timeout. Do not retry or refund blindly.
        await store.transition(id, ["fulfilling"], "review");
      }
    },
    async status(order: CardOrder) {
      if (["fulfilling", "submitted", "review"].includes(order.state)) {
        const result = await chain.status(order);
        if (result === "fulfilled")
          await store.transition(
            order.id,
            ["fulfilling", "submitted", "review"],
            "fulfilled",
          );
        else if (result === "reverted")
          await store.transition(
            order.id,
            ["fulfilling", "submitted"],
            "review",
          );
        // A crashed invocation keeps its claim; make that visible instead of showing an endless spinner.
        else if (
          order.state === "fulfilling" &&
          Date.now() / 1000 - order.createdAt > 7200
        )
          await store.transition(order.id, ["fulfilling"], "review");
      }
      return (await store.get(order.id))!;
    },
  };
}
