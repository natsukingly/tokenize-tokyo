import "./env";
import { createPublicClient, getAddress, http } from "viem";
import { inspectNamespace, viemRegistryReader } from "../src/lib/ens/registry";

async function main() {
  const url = process.env.ENSV2_RPC_URL;
  const anchor = process.env.ENSV2_PARENT_REGISTRY;
  const labels = process.env.ENSV2_NAMESPACE_PATH?.split("/");
  if (!url || !anchor || !labels?.length)
    throw new Error(
      "Set ENSV2_RPC_URL, ENSV2_PARENT_REGISTRY and ENSV2_NAMESPACE_PATH; no demo addresses are substituted",
    );
  const client = createPublicClient({
    transport: http(url, { timeout: 15000, retryCount: 0 }),
  });
  const result = await inspectNamespace(viemRegistryReader(client), {
    anchor: getAddress(anchor),
    labels,
    operator: process.env.ENSV2_OPERATOR_ADDRESS
      ? getAddress(process.env.ENSV2_OPERATOR_ADDRESS)
      : undefined,
  });
  console.log(
    JSON.stringify(
      result,
      (_, value) => (typeof value === "bigint" ? value.toString() : value),
      2,
    ),
  );
}
main().catch(() => {
  // Provider error objects may contain private RPC credentials. Do not print them.
  console.error(
    "ENS namespace inspection failed: check Sepolia RPC, configured registry anchor, canonical path and name expiry. No transactions were sent.",
  );
  process.exitCode = 1;
});
