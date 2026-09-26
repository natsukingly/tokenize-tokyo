import { readFileSync, writeFileSync } from "node:fs";
const file = process.argv[2] || "deployments/31337.json";
const deployment = JSON.parse(readFileSync(file, "utf8"));
const names = {
  registry: "REGISTRY",
  rights: "RIGHTS",
  market: "MARKET",
  revenue: "REVENUE",
  basket: "BASKET",
  settlement: "SETTLEMENT",
} as const;
// Export public values to a new file; never overwrite a credential-bearing .env.local.
const target = "deployments/frontend-addresses.env";
const lines = Object.entries(names).map(
  ([key, label]) => `NEXT_PUBLIC_${label}_ADDRESS=${deployment[key]}`,
);
lines.push(`NEXT_PUBLIC_CHAIN_ID=${deployment.chainId}`);
if (deployment.ens && deployment.authority) {
  if (deployment.ens.locallyForked)
    throw new Error(
      "Do not export local fork addresses as a public deployment",
    );
  lines.push(
    `NEXT_PUBLIC_ENSV2_AUTHORITY_ADDRESS=${deployment.authority}`,
    `NEXT_PUBLIC_ENSV2_PARENT=${deployment.ens.parent}`,
    `NEXT_PUBLIC_ENSV2_ASSET_ID=${deployment.ens.assetId}`,
    `NEXT_PUBLIC_ENSV2_SCOPE=${deployment.ens.scope}`,
  );
}
writeFileSync(target, lines.join("\n") + "\n");
console.log("Public addresses written to", target);
