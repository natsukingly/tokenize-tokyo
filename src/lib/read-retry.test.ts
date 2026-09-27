import { afterEach, expect, it, vi } from "vitest";
import { marketReadError, retryRead } from "./read-retry";
afterEach(() => vi.useRealTimers());

it("backs off transient read errors and returns the successful result", async () => {
  vi.useFakeTimers();
  const read = vi
    .fn()
    .mockRejectedValueOnce({ response: { status: 429 } })
    .mockRejectedValueOnce({ response: { status: 503 } })
    .mockResolvedValue("ok");
  const result = retryRead(read);
  await vi.advanceTimersByTimeAsync(499);
  expect(read).toHaveBeenCalledTimes(1);
  await vi.advanceTimersByTimeAsync(1);
  expect(read).toHaveBeenCalledTimes(2);
  await vi.advanceTimersByTimeAsync(1000);
  expect(await result).toBe("ok");
  expect(read).toHaveBeenCalledTimes(3);
});

it("bounds retries when the provider remains unavailable", async () => {
  vi.useFakeTimers();
  const error = { code: "ETIMEDOUT" };
  const read = vi.fn().mockRejectedValue(error);
  const assertion = expect(retryRead(read)).rejects.toBe(error);
  await vi.runAllTimersAsync();
  await assertion;
  expect(read).toHaveBeenCalledTimes(3);
});

it.each([400, 401, 403])(
  "does not retry permanent HTTP %s errors",
  async (status) => {
    const error = { response: { status } };
    const read = vi.fn().mockRejectedValue(error);
    await expect(retryRead(read)).rejects.toBe(error);
    expect(read).toHaveBeenCalledOnce();
  },
);

it("does not retry an exhausted plan or tell users that a short wait will fix it", async () => {
  const error = {
    response: {
      status: 429,
      data: { message: "request exceeds the plan’s rate limit" },
    },
  };
  const read = vi.fn().mockRejectedValue(error);
  await expect(retryRead(read)).rejects.toBe(error);
  expect(read).toHaveBeenCalledOnce();
  expect(marketReadError(error)).toContain("usage limit");
  expect(marketReadError(error)).not.toContain("wait a moment");
  expect(marketReadError({ response: { status: 429 } })).toContain(
    "rate limiting",
  );
  expect(marketReadError({ response: { status: 403 } })).toContain(
    "denied access",
  );
  expect(marketReadError(new Error("offline"))).toContain(
    "Previously loaded data",
  );
});
