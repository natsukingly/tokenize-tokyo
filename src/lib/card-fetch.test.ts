import { afterEach, expect, it, vi } from "vitest";
import { CARD_REQUEST_TIMEOUT, cardFetch } from "./card-fetch";
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
it("times out a stalled request while preserving the exact retry body", async () => {
  vi.useFakeTimers();
  const fetcher = vi.fn(
    (_url: string, init: RequestInit) =>
      new Promise((_resolve, reject) =>
        init.signal?.addEventListener("abort", () =>
          reject(new DOMException("Aborted", "AbortError")),
        ),
      ),
  );
  vi.stubGlobal("fetch", fetcher);
  const body = JSON.stringify({ requestId: "same-order" });
  const pending = expect(
    cardFetch("/api/card-checkout", { method: "POST", body }),
  ).rejects.toThrow(/timed out/);
  await vi.advanceTimersByTimeAsync(CARD_REQUEST_TIMEOUT);
  await pending;
  expect(fetcher.mock.calls[0][1].body).toBe(body);
  expect(fetcher.mock.calls[0][1].signal?.aborted).toBe(true);
});
it("handles an HTML outage without exposing the parser error and permits a later success", async () => {
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValueOnce(
        new Response("<h1>Bad Gateway</h1>", { status: 502 }),
      )
      .mockResolvedValueOnce(Response.json({ state: "awaiting_payment" })),
  );
  await expect(cardFetch("/status")).rejects.toThrow("Please try again");
  await expect(cardFetch("/status")).resolves.toEqual({
    state: "awaiting_payment",
  });
});
