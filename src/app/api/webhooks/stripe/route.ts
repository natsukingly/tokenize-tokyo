import { boundedText, cardDependencies, cardReply } from "@/server/card-http";
import type Stripe from "stripe";
export const runtime = "nodejs";
export const maxDuration = 60;
export async function POST(request: Request) {
  let deps;
  try {
    deps = cardDependencies();
  } catch {
    return cardReply({ error: "Checkout is not configured." }, 503);
  }
  let event: Stripe.Event;
  try {
    const raw = await boundedText(request, 262144);
    event = deps.stripe.webhooks.constructEvent(
      raw,
      request.headers.get("stripe-signature") || "",
      deps.settings.webhookSecret,
    );
  } catch {
    return cardReply({ error: "Invalid Stripe signature or payload." }, 400);
  }
  if (event.livemode) return cardReply({ error: "Test events only." }, 400);
  if (
    ![
      "checkout.session.completed",
      "checkout.session.async_payment_succeeded",
      "checkout.session.expired",
    ].includes(event.type)
  )
    return cardReply({ received: true });
  try {
    await deps.service.fulfill(
      (event.data.object as Stripe.Checkout.Session).id,
    );
    return cardReply({ received: true });
  } catch {
    return cardReply(
      { error: "Payment processing is temporarily unavailable." },
      503,
    );
  }
}
