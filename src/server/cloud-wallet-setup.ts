import type { BaseAzureAccount, HSMData } from "@curvegrid/multibaas-sdk";

/** CLI-only configuration. Keep provider secrets out of reports and SDK error dumps. */
export function cloudWalletSettings(
  env: Record<string, string | undefined>,
  apply = false,
) {
  const required = (key: string) => {
    const value = env[key]?.trim();
    if (!value) throw new Error(`Set ${key} in the private environment file.`);
    return value;
  };
  const url = new URL(required("MULTIBAAS_URL"));
  if (
    url.protocol !== "https:" ||
    !url.hostname.endsWith(".multibaas.com") ||
    url.username ||
    url.password
  )
    throw new Error("Use the HTTPS MultiBaas deployment URL.");
  const apiKey = required("MULTIBAAS_API_KEY");
  if (apiKey === env.NEXT_PUBLIC_MULTIBAAS_DAPP_KEY)
    throw new Error("The signing key must not be the public DApp key.");
  const chainId = Number(required("NEXT_PUBLIC_CHAIN_ID"));
  if (![2017072401, 11155111].includes(chainId))
    throw new Error(
      "Cloud Wallet setup is restricted to the project's testnet deployments.",
    );
  let azure: BaseAzureAccount | undefined;
  let vaultName = "",
    keyName = "";
  if (apply) {
    const guid = (key: string) => {
      const value = required(key);
      if (!/^[\da-f]{8}(-[\da-f]{4}){3}-[\da-f]{12}$/i.test(value))
        throw new Error(`Invalid ${key}.`);
      return value;
    };
    azure = {
      label: env.CLOUD_WALLET_LABEL?.trim() || "tokenize-tokyo-operator",
      clientID: guid("AZURE_CLIENT_ID"),
      clientSecret: required("AZURE_CLIENT_SECRET"),
      tenantID: guid("AZURE_TENANT_ID"),
      subscriptionID: guid("AZURE_SUBSCRIPTION_ID"),
      baseGroupName: required("AZURE_RESOURCE_GROUP"),
    };
    vaultName = required("AZURE_KEY_VAULT");
    keyName = required("AZURE_KEY_NAME");
    if (
      !/^[a-z][a-z0-9-]{1,22}[a-z0-9]$/i.test(vaultName) ||
      vaultName.includes("--")
    )
      throw new Error("Invalid AZURE_KEY_VAULT.");
    if (!/^[a-z0-9-]{1,127}$/i.test(keyName))
      throw new Error("Invalid AZURE_KEY_NAME.");
  }
  return { url: url.origin, apiKey, chainId, azure, vaultName, keyName };
}

export function publicCloudWallets(providers: HSMData[]) {
  return providers.map(({ configuration, wallets }) => ({
    label: configuration.label,
    wallets: wallets.map((w) => ({
      address: w.publicAddress,
      vaultName: w.vaultName,
      keyName: w.keyName,
    })),
  }));
}
