import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { parseEnv } from "node:util";
import { randomUUID } from "node:crypto";
import { Configuration, HsmApi, ChainsApi } from "@curvegrid/multibaas-sdk";
import { stringToHex, verifyMessage } from "viem";
import {
  cloudWalletSettings,
  publicCloudWallets,
} from "../src/server/cloud-wallet-setup";

async function main() {
  const args = process.argv.slice(2);
  const index = args.indexOf("--env");
  const file = index >= 0 ? args[index + 1] : "";
  if (!file || file.startsWith("--"))
    throw new Error(
      "Pass --env .env.local or --env .env.sepolia explicitly. Default mode only inspects configuration.",
    );
  const env = parseEnv(readFileSync(file, "utf8"));
  const apply = args.includes("--apply");
  const settings = cloudWalletSettings(env, apply);
  const sdk = new Configuration({
    basePath: new URL("/api/v0", settings.url).toString(),
    accessToken: settings.apiKey,
    baseOptions: { timeout: 20000 },
  });
  const hsm = new HsmApi(sdk);
  const chains = new ChainsApi(sdk);
  if ((await chains.getChainStatus()).data.result.chainID !== settings.chainId)
    throw new Error(
      "MultiBaas chain does not match the environment. No changes made.",
    );
  let providers = (await hsm.listHsm()).data.result;
  let address = env.MULTIBAAS_OPERATOR_ADDRESS || "";
  if (apply) {
    const azure = settings.azure!;
    const existing = providers.find(
      (p) => p.configuration.clientID === azure.clientID,
    );
    if (
      providers.some(
        (p) =>
          p.configuration.label === azure.label &&
          p.configuration.clientID !== azure.clientID,
      )
    )
      throw new Error(
        "Provider label already belongs to a different Azure application.",
      );
    if (
      existing &&
      (existing.configuration.tenantID !== azure.tenantID ||
        existing.configuration.subscriptionID !== azure.subscriptionID ||
        existing.configuration.baseGroupName !== azure.baseGroupName)
    )
      throw new Error(
        "Existing Azure provider settings differ. Review them before proceeding.",
      );
    const wallet = existing?.wallets.find(
      (w) =>
        w.vaultName === settings.vaultName && w.keyName === settings.keyName,
    );
    if (
      address &&
      wallet?.publicAddress.toLowerCase() !== address.toLowerCase()
    )
      throw new Error(
        "Configured operator differs from the target Cloud Wallet. Existing operator was preserved.",
      );
    if (!existing) await hsm.addHsmConfig(azure);
    if (wallet) address = wallet.publicAddress;
    else
      address = (
        await hsm.createHsmKey({
          clientID: azure.clientID,
          vaultName: settings.vaultName,
          keyName: settings.keyName,
          useHardwareModule: false,
        })
      ).data.result.publicAddress;
    providers = (await hsm.listHsm()).data.result;
    if (
      !/^0x[\da-f]{40}$/i.test(address) ||
      !providers.some((p) =>
        p.wallets.some(
          (w) => w.publicAddress.toLowerCase() === address.toLowerCase(),
        ),
      )
    )
      throw new Error(
        "Created wallet could not be verified. Inspect configuration before retrying.",
      );
    // Preserve any concurrent environment changes and never write an API key to a report.
    const current = readFileSync(file, "utf8");
    const configured = parseEnv(current).MULTIBAAS_OPERATOR_ADDRESS;
    if (configured && configured.toLowerCase() !== address.toLowerCase())
      throw new Error(
        "Operator setting changed during setup; environment was not overwritten.",
      );
    const line = `MULTIBAAS_OPERATOR_ADDRESS=${address}`;
    writeFileSync(
      file,
      /^MULTIBAAS_OPERATOR_ADDRESS=.*$/m.test(current)
        ? current.replace(/^MULTIBAAS_OPERATOR_ADDRESS=.*$/m, line)
        : `${current.trimEnd()}\n${line}\n`,
      { mode: 0o600 },
    );
  }
  let signingVerified = false;
  if (args.includes("--verify-signature")) {
    if (
      !address ||
      !providers.some((p) =>
        p.wallets.some(
          (w) => w.publicAddress.toLowerCase() === address.toLowerCase(),
        ),
      )
    )
      throw new Error("Configured operator is not a linked Cloud Wallet.");
    const message = `TOKENIZE TOKYO Cloud Wallet setup check\nChain: ${settings.chainId}\nNonce: ${randomUUID()}\nNo transaction or asset authorization.`;
    const result = (
      await hsm.signData({
        method: "personal_sign",
        address,
        data: stringToHex(message),
      })
    ).data.result;
    signingVerified = await verifyMessage({
      address: address as `0x${string}`,
      message,
      signature: result.signature as `0x${string}`,
    });
    if (!signingVerified)
      throw new Error("Cloud Wallet signature verification failed.");
  }
  const report = {
    checkedAt: new Date().toISOString(),
    chainId: settings.chainId,
    providers: publicCloudWallets(providers),
    operatorAddress: address || null,
    signingVerified,
    transactionSubmitted: false,
    tokenizationSponsored: false,
    next: providers.length
      ? "Fund the operator, configure required contract roles, and verify a bounded operator transaction."
      : "Azure Key Vault provider is required before a Cloud Wallet can be created.",
  };
  mkdirSync(".data/cloud-wallet", { recursive: true });
  writeFileSync(
    `.data/cloud-wallet/${settings.chainId}.json`,
    JSON.stringify(report, null, 2) + "\n",
  );
  console.log(JSON.stringify(report, null, 2));
}
main().catch((error: unknown) => {
  // Axios errors contain authorization headers and may echo Azure client secrets.
  const remote = error as {
    response?: { status?: number };
    isAxiosError?: boolean;
  };
  console.error(
    remote.isAxiosError
      ? `Cloud Wallet API request failed (HTTP ${remote.response?.status ?? "network error"}). Check permissions and private configuration.`
      : error instanceof Error
        ? error.message
        : "Cloud Wallet setup failed.",
  );
  process.exitCode = 1;
});
