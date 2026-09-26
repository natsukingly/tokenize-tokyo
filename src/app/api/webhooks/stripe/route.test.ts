import { beforeEach, expect, it, vi } from "vitest";
import Stripe from "stripe";
const deps = vi.hoisted(() => ({ fulfill: vi.fn() }));
vi.mock("@/server/card-http", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/server/card-http")>();
  return {
    ...original,
    cardDependencies: () => ({
      settings: { webhookSecret: "whsec_fixture" },
      stripe: new Stripe("sk_test_fixture"),
      service: { fulfill: deps.fulfill },
    }),
  };
});
import { POST } from "./route";
const stripe = new Stripe("sk_test_fixture");
function request(livemode = false, signature = true, timestamp?: number) {
  const body = JSON.stringify({
    id: "evt_fixture",
    object: "event",
    type: "checkout.session.completed",
    livemode,
    data: { object: { id: "cs_test_fixture" } },
  });
  const header = stripe.webhooks.generateTestHeaderString({
    payload: body,
    secret: "whsec_fixture",
    timestamp,
  });
  return new Request("https://app.test/api/webhooks/stripe", {
    method: "POST",
    body,
    headers: { "stripe-signature": signature ? header : "invalid" },
  });
}
beforeEach(() => {
  deps.fulfill.mockReset();
});
it("accepts a genuine signed test event", async () => {
  expect((await POST(request())).status).toBe(200);
  expect(deps.fulfill).toHaveBeenCalledWith("cs_test_fixture");
});
it("rejects forged, stale and live events before signing", async () => {
  expect((await POST(request(false, false))).status).toBe(400);
  expect((await POST(request(false, true, 1))).status).toBe(400);
  expect((await POST(request(true))).status).toBe(400);
  expect(deps.fulfill).not.toHaveBeenCalled();
});
it("returns a retriable response on storage failures without leaking SDK secrets", async () => {
  deps.fulfill.mockRejectedValue(new Error("sk_test_secret_in_error"));
  const response = await POST(request());
  expect(response.status).toBe(503);
  expect(await response.text()).not.toContain("sk_test");
});
