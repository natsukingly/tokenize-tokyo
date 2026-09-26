import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ACTORS, DEMO_SITES, demoCall, demoState } from "./demo";
const key = "tokenize-tokyo-demo-v2";
const values = new Map<string, string>();
beforeEach(() => {
  values.clear();
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => values.get(k) || null,
    setItem: (k: string, v: string) => values.set(k, v),
    removeItem: (k: string) => values.delete(k),
  });
});
afterEach(() => vi.unstubAllGlobals());
it("recovers malformed JSON and nested records while preserving the unreadable source", () => {
  for (const raw of [
    "{broken",
    JSON.stringify({
      catalogVersion: 999,
      events: null,
      balances: {},
      cash: {},
      claims: {},
    }),
  ]) {
    values.set(key, raw);
    const state = demoState(ACTORS["Investor B"]);
    expect(state.assets).toHaveLength(DEMO_SITES.length);
    expect(values.get(`${key}:recovery`)).toBe(raw);
  }
});
it("does not reset valid purchases, balances or event history on reload", () => {
  demoCall(ACTORS["Investor B"], "market", "purchase", ["1", "10"]);
  const before = demoState(ACTORS["Investor B"]);
  expect(demoState(ACTORS["Investor B"])).toEqual(before);
  expect(before.balances["rights:1"]).toBe("10");
  expect(values.has(`${key}:recovery`)).toBe(false);
});
