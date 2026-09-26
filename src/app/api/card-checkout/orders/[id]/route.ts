import {
  browserToken,
  cardDependencies,
  cardReply,
  ownerHash,
} from "@/server/card-http";
import { z } from "zod";
export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };
async function handle(request: Request, context: Context, reconcile: boolean) {
  const { id } = await context.params;
  const token = browserToken(request);
  if (!token || !z.uuid().safeParse(id).success)
    return cardReply({ error: "Order not found in this browser." }, 404);
  try {
    const { store, service, settings, stripe } = cardDependencies();
    if (reconcile && request.headers.get("origin") !== settings.origin)
      return cardReply({ error: "Use this website." }, 403);
    const owner = ownerHash(token);
    if (
      !(await store.rateLimit(
        `status:${owner}:${Math.floor(Date.now() / 60000)}`,
        40,
      ))
    )
      return cardReply(
        { error: "Please wait a minute before refreshing." },
        429,
      );
    let order = await store.get(id);
    if (!order || order.ownerHash !== owner)
      return cardReply({ error: "Order not found in this browser." }, 404);
    // Explicit recovery uses the SAME paid-session verification and atomic claim as the webhook.
    if (reconcile && order.sessionId) await service.fulfill(order.sessionId);
    order = await service.status((await store.get(id))!);
    let checkoutUrl: string | undefined;
    if (order.state === "awaiting_payment" && order.sessionId) {
      const session = await stripe.checkout.sessions.retrieve(order.sessionId);
      if (!session.livemode && session.status === "expired") {
        await store.transition(id, ["awaiting_payment"], "expired");
        order = (await store.get(id))!;
      } else if (
        !session.livemode &&
        session.status === "open" &&
        session.url &&
        new URL(session.url).origin === "https://checkout.stripe.com"
      )
        checkoutUrl = session.url;
    }
    return cardReply({
      id: order.id,
      state: order.state,
      txHash: order.txHash,
      recipient: order.quote.recipient,
      quantity: order.quote.quantity,
      amountJpy: order.quote.amountJpy,
      chainId: order.quote.chainId,
      checkoutUrl,
    });
  } catch {
    return cardReply(
      { error: "Unable to check this order. Please try again." },
      503,
    );
  }
}
export const GET = (request: Request, context: Context) =>
  handle(request, context, false);
export const POST = (request: Request, context: Context) =>
  handle(request, context, true);
