import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import {
  createPublicClient,
  formatEther,
  http,
  keccak256,
  type Hex,
  type Address,
} from "viem";
import { ENSV2_DEPLOYMENT } from "../src/lib/ens/deployment";
import { ENSV2_CHAIN_ID } from "../src/lib/ens/spaces";

export async function ensPreflight(rpcUrl: string, account?: Address) {
  const client = createPublicClient({
    transport: http(rpcUrl, { timeout: 20000, retryCount: 2 }),
  });
  if ((await client.getChainId()) !== ENSV2_CHAIN_ID)
    throw new Error("Sepolia RPC required");
  const block = await client.getBlockNumber();
  const checks = await Promise.all(
    Object.entries(ENSV2_DEPLOYMENT)
      .filter(([k]) => k !== "sourceCommit")
      .map(async ([name, address]) => {
        const artifact = JSON.parse(
          readFileSync(`contracts/test/fixtures/ensv2/${name}.json`, "utf8"),
        );
        const code = await client.getCode({
          address: address as Address,
          blockNumber: block,
        });
        if (!code || code === "0x") throw new Error(`Missing official ${name}`);
        const mask = (hex: string) => {
          const bytes = Buffer.from(hex.slice(2), "hex");
          for (const refs of Object.values(artifact.immutableReferences) as {
            start: number;
            length: number;
          }[][])
            for (const { start, length } of refs)
              bytes.fill(0, start, start + length);
          return bytes.toString("hex");
        };
        if (
          artifact.sourceCommit !== ENSV2_DEPLOYMENT.sourceCommit ||
          mask(code) !== mask(artifact.deployedBytecode)
        )
          throw new Error(`Official bytecode mismatch: ${name}`);
        return {
          name,
          address,
          runtimeHash: keccak256(code as Hex),
          matchesPinnedArtifact: true,
        };
      }),
  );
  return {
    chainId: ENSV2_CHAIN_ID,
    block: block.toString(),
    sourceCommit: ENSV2_DEPLOYMENT.sourceCommit,
    checkedAt: new Date().toISOString(),
    checks,
    ...(account
      ? {
          account,
          balanceETH: formatEther(
            await client.getBalance({ address: account, blockNumber: block }),
          ),
        }
      : {}),
  };
}
if (process.argv[1]?.endsWith("ens-preflight.ts")) {
  ensPreflight(
    process.env.ENSV2_RPC_URL || "https://ethereum-sepolia-rpc.publicnode.com",
    process.env.DEPLOYER_ADDRESS as Address | undefined,
  )
    .then((report) => {
      mkdirSync("deployments", { recursive: true });
      writeFileSync(
        "deployments/ens-v2-sepolia-preflight.json",
        JSON.stringify(report, null, 2) + "\n",
      );
      console.log(JSON.stringify(report, null, 2));
    })
    .catch(() => {
      console.error(
        "ENS preflight failed. Check Sepolia RPC and pinned official deployments; no transactions sent.",
      );
      process.exitCode = 1;
    });
}
