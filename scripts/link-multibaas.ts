import "./env";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { clients } from "../src/lib/multibaas";
async function main() {
  const file = resolve(process.env.DEPLOYMENT_FILE || "deployments/31337.json");
  const manifest = JSON.parse(readFileSync(file, "utf8"));
  const url = process.env.MULTIBAAS_URL,
    key = process.env.MULTIBAAS_API_KEY,
    rpc = process.env.NETWORK_RPC_URL;
  if (!url || !key || !rpc)
    throw new Error(
      "Set MULTIBAAS_URL, MULTIBAAS_API_KEY and NETWORK_RPC_URL in .env.local",
    );
  const chain = (await clients(url, key).chains.getChainStatus()).data.result;
  if (chain.chainID !== manifest.chainId)
    throw new Error("MultiBaas and deployment manifest chain IDs differ");
  const result = spawnSync(
    "forge",
    ["script", "script/Link.s.sol:Link", "--rpc-url", rpc, "--ffi"],
    {
      cwd: "contracts",
      stdio: "inherit",
      env: { ...process.env, DEPLOYMENT_FILE: file },
    },
  );
  if (result.status !== 0) throw new Error("Forge MultiBaas linking failed");
  console.log(
    "All six contracts linked; sync starts at deployment block. Run npm run multibaas:verify.",
  );
}
main().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
