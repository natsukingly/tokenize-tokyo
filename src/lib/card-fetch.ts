export const CARD_REQUEST_TIMEOUT = 20_000;

/** Bound each attempt. A timed-out create request must keep its idempotency key. */
export async function cardFetch(
  url: string,
  init: RequestInit = {},
): Promise<Record<string, unknown>> {
  const controller = new AbortController();
  const cancel = () => controller.abort();
  if (init.signal?.aborted) cancel();
  else init.signal?.addEventListener("abort", cancel, { once: true });
  const timer = setTimeout(cancel, CARD_REQUEST_TIMEOUT);
  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    const body: unknown = await response.json().catch(() => null);
    if (!body || typeof body !== "object" || Array.isArray(body))
      throw new Error("Unable to check checkout right now. Please try again.");
    const record = body as Record<string, unknown>;
    if (!response.ok)
      throw new Error(
        typeof record.error === "string"
          ? record.error
          : "Checkout is unavailable. Please try again.",
      );
    return record;
  } catch (error) {
    if (controller.signal.aborted && !init.signal?.aborted)
      throw new Error(
        "The checkout request timed out. Please try again to check the same order.",
      );
    throw error;
  } finally {
    clearTimeout(timer);
    init.signal?.removeEventListener("abort", cancel);
  }
}
