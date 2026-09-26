import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { loadEnvFile } from "node:process";
import {
  createPublicClient,
  decodeEventLog,
  http,
  type Abi,
  type Address,
} from "viem";
import { events } from "../src/lib/queries";
import type { ChainEvent } from "../src/lib/model";

// A one-time, public-chain bootstrap, not fabricated activity or a MultiBaas import.
// New events are indexed by MultiBaas starting at toBlock + 1.
async function main() {
  const flag = process.argv.indexOf("--env");
  if (flag < 0 || !process.argv[flag + 1])
    throw new Error("Use --env .env.sepolia");
  loadEnvFile(process.argv[flag + 1]);
  const d = JSON.parse(
    readFileSync(process.env.ENSV2_DEPLOYMENT_FILE!, "utf8"),
  );
  if (d.chainId !== 11155111 || d.ens?.locallyForked !== false)
    throw new Error("Public Sepolia deployment required");
  const file = "src/lib/generated/sepolia-bootstrap.json";
  if (existsSync(file))
    throw new Error(
      "Bootstrap already exists; preserve its indexing boundary.",
    );
  const rpc = createPublicClient({
    transport: http(process.env.ENSV2_RPC_URL, { timeout: 20000 }),
  });
  if ((await rpc.getChainId()) !== 11155111)
    throw new Error("Wrong RPC network");
  // Finalized blocks make the archive stable, while the linker checks the plan's lookback.
  const tip = await rpc.getBlock({ blockTag: "finalized" });
  if (tip.number < BigInt(d.startingBlock))
    throw new Error("Wait for deployment finality");
  const names = {
    registry: "UrbanAssetRegistry",
    rights: "UrbanRightToken",
    market: "UrbanMarketplace",
    revenue: "RevenueVault",
    basket: "BasketVault",
    settlement: "MockJPY",
    authority: "UrbanNamespaceAuthority",
  } as const;
  const blocks = new Map<string, { hash: string; timestamp: string }>();
  const archive: ChainEvent[] = [];
  const audit: {
    name: string;
    id: string;
    hash: string;
    block: number;
    logIndex: number;
  }[] = [];
  for (const [key, name] of Object.entries(names)) {
    const abi = JSON.parse(
      readFileSync(`contracts/out/${name}.sol/${name}.json`, "utf8"),
    ).abi as Abi;
    const logs: Awaited<ReturnType<typeof rpc.getLogs>> = [];
    for (
      let fromBlock = BigInt(d.startingBlock);
      fromBlock <= tip.number;
      fromBlock += 64n
    ) {
      const end = fromBlock + 63n;
      logs.push(
        ...(await rpc.getLogs({
          address: d[key] as Address,
          fromBlock,
          toBlock: end < tip.number ? end : tip.number,
        })),
      );
    }
    for (const log of logs) {
      if (
        log.removed ||
        !log.blockHash ||
        !log.transactionHash ||
        log.logIndex === null ||
        log.blockNumber === null
      )
        throw new Error("Incomplete chain log");
      const decoded = decodeEventLog({
        abi,
        topics: log.topics,
        data: log.data,
      });
      const args = JSON.parse(
        JSON.stringify(decoded.args, (_, value) =>
          typeof value === "bigint" ? value.toString() : value,
        ),
      );
      if (
        key === "authority" &&
        [
          "SpaceNamespaceBound",
          "IssuanceDelegated",
          "IssuanceRevoked",
          "IssuanceConsumed",
        ].includes(decoded.eventName!)
      ) {
        audit.push({
          name: decoded.eventName!,
          id: args.bindingId,
          hash: log.transactionHash,
          block: Number(log.blockNumber),
          logIndex: log.logIndex,
        });
      }
      const entry = Object.entries(events).find(
        ([, spec]) =>
          spec.contract === key &&
          spec.signature.split("(")[0] === decoded.eventName,
      );
      if (!entry) continue;
      const blockKey = log.blockNumber.toString();
      if (!blocks.has(blockKey)) {
        const block = await rpc.getBlock({ blockNumber: log.blockNumber });
        blocks.set(blockKey, {
          hash: block.hash,
          timestamp: new Date(Number(block.timestamp) * 1000).toISOString(),
        });
      }
      const block = blocks.get(blockKey)!;
      if (block.hash !== log.blockHash)
        throw new Error("Canonical block hash mismatch");
      archive.push({
        name: entry[0],
        contract: entry[1].contract,
        args,
        block: Number(log.blockNumber),
        txHash: log.transactionHash,
        timestamp: block.timestamp,
        logIndex: log.logIndex,
        source: "rpc-bootstrap",
      });
    }
  }
  archive.sort((a, b) => a.block - b.block || a.logIndex! - b.logIndex!);
  mkdirSync("src/lib/generated", { recursive: true });
  writeFileSync(
    file,
    JSON.stringify(
      {
        chainId: d.chainId,
        source: "Sepolia RPC finalized logs",
        capturedAt: new Date().toISOString(),
        fromBlock: d.startingBlock,
        toBlock: Number(tip.number),
        blockHash: tip.hash,
        addresses: Object.fromEntries(
          Object.keys(names).map((key) => [key, d[key]]),
        ),
        events: archive,
        audit,
      },
      null,
      2,
    ) + "\n",
  );
  console.log(
    `Saved ${archive.length} verified setup events and ${audit.length} ENS events through block ${tip.number}.`,
  );
  console.log(
    `Link MultiBaas with --bootstrap ${file}; history remains explicitly sourced to Sepolia RPC.`,
  );
}
main().catch((e) => {
  const message = String(
    e.shortMessage ||
      (e.constructor === Error ? e.message : "Sepolia bootstrap read failed"),
  );
  console.error(message.replace(/https?:\/\/\S+/g, "[RPC]").slice(0, 400));
  process.exitCode = 1;
});
