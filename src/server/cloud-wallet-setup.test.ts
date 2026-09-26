import { describe, expect, it } from "vitest";
import { cloudWalletSettings, publicCloudWallets } from "./cloud-wallet-setup";

const env = {
  MULTIBAAS_URL: "https://example.multibaas.com",
  MULTIBAAS_API_KEY: "server-secret",
  NEXT_PUBLIC_CHAIN_ID: "11155111",
  CLOUD_WALLET_LABEL: "tokenize-tokyo",
  AZURE_CLIENT_ID: "11111111-1111-1111-1111-111111111111",
  AZURE_CLIENT_SECRET: "azure-secret",
  AZURE_TENANT_ID: "22222222-2222-2222-2222-222222222222",
  AZURE_SUBSCRIPTION_ID: "33333333-3333-3333-3333-333333333333",
  AZURE_RESOURCE_GROUP: "tokenize-tokyo-wallet",
  AZURE_KEY_VAULT: "tokenize-tokyo-wallet",
  AZURE_KEY_NAME: "tokenize-operator",
};
describe("Cloud Wallet setup boundaries", () => {
  it("requires an explicit known test chain and HTTPS MultiBaas host", () => {
    expect(cloudWalletSettings(env).chainId).toBe(11155111);
    expect(() =>
      cloudWalletSettings({ ...env, NEXT_PUBLIC_CHAIN_ID: "1" }),
    ).toThrow("testnet");
    expect(() =>
      cloudWalletSettings({
        ...env,
        MULTIBAAS_URL: "http://example.multibaas.com",
      }),
    ).toThrow("HTTPS");
    expect(() =>
      cloudWalletSettings({ ...env, MULTIBAAS_URL: "https://example.com" }),
    ).toThrow("MultiBaas");
  });
  it("inspects without needing Azure secrets, but refuses creation without them", () => {
    const missing = { ...env, AZURE_CLIENT_SECRET: "" };
    expect(cloudWalletSettings(missing).chainId).toBe(11155111);
    expect(() => cloudWalletSettings(missing, true)).toThrow(
      "AZURE_CLIENT_SECRET",
    );
  });
  it("validates provider IDs and vault/key names before creation", () => {
    expect(() =>
      cloudWalletSettings({ ...env, AZURE_CLIENT_ID: "invalid" }, true),
    ).toThrow("AZURE_CLIENT_ID");
    expect(() =>
      cloudWalletSettings({ ...env, AZURE_KEY_VAULT: "bad/vault" }, true),
    ).toThrow("AZURE_KEY_VAULT");
    expect(cloudWalletSettings(env, true).azure?.clientSecret).toBe(
      "azure-secret",
    );
  });
  it("does not permit a signing key matching the public DApp key", () => {
    expect(() =>
      cloudWalletSettings({
        ...env,
        NEXT_PUBLIC_MULTIBAAS_DAPP_KEY: "server-secret",
      }),
    ).toThrow("public");
  });
  it("only emits public wallet metadata, never the provider credentials", () => {
    const summary = publicCloudWallets([
      {
        configuration: { ...cloudWalletSettings(env, true).azure!, id: 1 },
        wallets: [
          {
            id: 1,
            azureAccountID: 1,
            vaultName: "vault",
            keyName: "operator",
            keyVersion: "v1",
            publicAddress: "0x" + "11".repeat(20),
          },
        ],
      },
    ]);
    expect(summary[0].wallets[0].address).toBe("0x" + "11".repeat(20));
    expect(JSON.stringify(summary)).not.toContain("secret");
    expect(JSON.stringify(summary)).not.toContain(env.AZURE_CLIENT_ID);
  });
});
