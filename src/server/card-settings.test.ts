import { describe, expect, it, vi } from "vitest";
vi.mock("@/lib/config", () => ({
  config: {
    mode: "multibaas",
    chainId: 11155111,
    key: "public-key",
    addresses: {
      market: `0x${"a".repeat(40)}`,
      settlement: `0x${"b".repeat(40)}`,
      rights: `0x${"c".repeat(40)}`,
      basket: `0x${"d".repeat(40)}`,
    },
  },
}));
import { cardSettings } from "./card-settings";
const env = {
  STRIPE_CARD_CHECKOUT_ENABLED: "true",
  STRIPE_SECRET_KEY: "sk_test_fixture",
  STRIPE_WEBHOOK_SECRET: "whsec_fixture",
  CARD_CHECKOUT_EXECUTOR_ADDRESS: `0x${"e".repeat(40)}`,
  MULTIBAAS_OPERATOR_ADDRESS: `0x${"f".repeat(40)}`,
  MULTIBAAS_URL: "https://test.multibaas.com",
  MULTIBAAS_API_KEY: "private-key",
  NETWORK_RPC_URL: "https://rpc.test",
  APP_ORIGIN: "https://app.test",
  CARD_CHECKOUT_DATABASE_URL: "postgres://test:fixture@localhost/test",
};
describe("card test configuration", () => {
  it("requires test keys, the fixed origin and a private signing configuration", () => {
    expect(cardSettings(env)).toMatchObject({
      chainId: 11155111,
      origin: "https://app.test",
    });
  });
  it.each([
    { STRIPE_SECRET_KEY: "sk_live_fixture" },
    { STRIPE_CARD_CHECKOUT_ENABLED: "false" },
    { MULTIBAAS_API_KEY: "public-key" },
    { STRIPE_WEBHOOK_SECRET: "" },
    { CARD_CHECKOUT_DATABASE_URL: "" },
    {
      CARD_CHECKOUT_EXECUTOR_ADDRESS:
        "0x0000000000000000000000000000000000000000",
    },
    { APP_ORIGIN: "https://app.test/path" },
    { MULTIBAAS_URL: "https://multibaas.com.attacker.test" },
  ])("fails closed with invalid settings %j", (patch) =>
    expect(() => cardSettings({ ...env, ...patch })).toThrow(),
  );
});
