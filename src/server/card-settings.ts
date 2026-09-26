import { isAddress, zeroAddress } from "viem";
import Stripe from "stripe";
import { config } from "@/lib/config";

export function cardSettings(
  env: Record<string, string | undefined> = process.env,
) {
  if (typeof window !== "undefined") throw new Error("Server only");
  const need = (key: string) => {
    if (!env[key]?.trim()) throw new Error("Card checkout is not configured.");
    return env[key]!.trim();
  };
  if (
    need("STRIPE_CARD_CHECKOUT_ENABLED") !== "true" ||
    config.mode !== "multibaas"
  )
    throw new Error("Card checkout is disabled.");
  const stripeKey = need("STRIPE_SECRET_KEY");
  if (
    !stripeKey.startsWith("sk_test_") ||
    ![11155111, 2017072401, 31337].includes(config.chainId)
  )
    throw new Error("Only Stripe test keys and test chains are supported.");
  const webhookSecret = need("STRIPE_WEBHOOK_SECRET");
  if (!webhookSecret.startsWith("whsec_"))
    throw new Error("Invalid webhook configuration.");
  const executor = need("CARD_CHECKOUT_EXECUTOR_ADDRESS");
  const operator = need("MULTIBAAS_OPERATOR_ADDRESS");
  for (const value of [executor, operator, ...Object.values(config.addresses)])
    if (!isAddress(value) || value.toLowerCase() === zeroAddress)
      throw new Error("Invalid deployment.");
  const url = new URL(need("MULTIBAAS_URL"));
  const key = need("MULTIBAAS_API_KEY");
  if (
    url.protocol !== "https:" ||
    !url.hostname.endsWith(".multibaas.com") ||
    url.username ||
    url.password ||
    key === config.key
  )
    throw new Error("Invalid Cloud Wallet configuration.");
  const rpc = need("NETWORK_RPC_URL");
  const origin = new URL(need("APP_ORIGIN"));
  if (
    origin.origin !== env.APP_ORIGIN ||
    (origin.protocol !== "https:" &&
      !["localhost", "127.0.0.1"].includes(origin.hostname))
  )
    throw new Error("Invalid website origin.");
  const databaseUrl = need("CARD_CHECKOUT_DATABASE_URL");
  return {
    stripeKey,
    webhookSecret,
    executor: executor as `0x${string}`,
    operator: operator as `0x${string}`,
    url: url.origin,
    key,
    rpc,
    origin: origin.origin,
    databaseUrl,
    chainId: config.chainId,
  };
}
export type CardSettings = ReturnType<typeof cardSettings>;
export function stripeClient(settings: CardSettings) {
  return new Stripe(settings.stripeKey, {
    maxNetworkRetries: 1,
    timeout: 10000,
  });
}
