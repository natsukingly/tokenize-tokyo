// Isolated real-contract browser test. The HTTP fixture implements the MultiBaas wire format;
// all contract reads, wallet writes and receipts are executed against a fresh local Anvil.
import { spawn, type ChildProcess } from "node:child_process";
import { createServer as httpServer } from "node:http";
import { createServer as netServer } from "node:net";
import { mkdirSync, openSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  createPublicClient,
  createWalletClient,
  http,
  encodeFunctionData,
  decodeEventLog,
  keccak256,
  stringToHex,
  parseEther,
  type Abi,
  type Address,
} from "viem";
import { foundry } from "viem/chains";
import { FieldType } from "@curvegrid/multibaas-sdk";

const directory = resolve(".data/finance-e2e");
mkdirSync(directory, { recursive: true });
const children: ChildProcess[] = [];
const originalTypes = readFileSync("next-env.d.ts", "utf8");
const originalTS = readFileSync("tsconfig.json", "utf8");
const sleep = (n: number) => new Promise((r) => setTimeout(r, n));
const json = (v: unknown) =>
  JSON.stringify(v, (_, x) => (typeof x === "bigint" ? x.toString() : x));
async function freePort() {
  const s = netServer();
  await new Promise<void>((r) => s.listen(0, "127.0.0.1", r));
  const port = (s.address() as { port: number }).port;
  await new Promise<void>((r) => s.close(() => r()));
  return port;
}
function start(
  command: string,
  args: string[],
  env = process.env,
  log?: string,
) {
  const p = spawn(command, args, {
    env,
    stdio: log
      ? ["ignore", openSync(log, "a", 0o600), openSync(log, "a", 0o600)]
      : "inherit",
    detached: true,
  });
  children.push(p);
  return p;
}
async function complete(p: ChildProcess) {
  const code = await new Promise<number | null>((r, j) => {
    p.on("error", j);
    p.on("exit", r);
  });
  if (code !== 0) throw new Error(`Command failed (${code})`);
}
let api: ReturnType<typeof httpServer> | undefined;
async function main() {
  await complete(start("forge", ["build", "--root", "contracts", "--quiet"]));
  const rpcPort = await freePort(),
    appPort = await freePort();
  const rpc = `http://127.0.0.1:${rpcPort}`;
  start(
    "anvil",
    ["--host", "127.0.0.1", "--port", String(rpcPort), "--silent"],
    process.env,
    `${directory}/anvil.log`,
  );
  const c = createPublicClient({
    chain: foundry,
    transport: http(rpc),
    cacheTime: 0,
  });
  for (let i = 0; ; i++) {
    try {
      await c.getChainId();
      break;
    } catch {
      if (i === 30) throw new Error("Anvil did not start");
      await sleep(200);
    }
  }
  const accounts = await createWalletClient({
    chain: foundry,
    transport: http(rpc),
  }).getAddresses();
  const owner = accounts[0],
    buyer = accounts[1];
  const w = createWalletClient({
    account: owner,
    chain: foundry,
    transport: http(rpc),
  });
  const artifacts: Record<string, any> = {};
  const addresses: Record<string, Address> = {};
  const names = {
    registry: "UrbanAssetRegistry",
    settlement: "MockJPY",
    rights: "UrbanRightToken",
    revenue: "RevenueVault",
    basket: "BasketVault",
    market: "UrbanMarketplace",
    fraction: "FractionVault",
    rental: "RentalEscrow",
  };
  async function deploy(key: keyof typeof names, args: unknown[]) {
    const name = names[key];
    const a = JSON.parse(
      readFileSync(`contracts/out/${name}.sol/${name}.json`, "utf8"),
    );
    artifacts[key] = a;
    const hash = await w.deployContract({
      abi: a.abi,
      bytecode: a.bytecode.object,
      args,
    });
    const receipt = await c.waitForTransactionReceipt({ hash });
    if (receipt.status !== "success" || !receipt.contractAddress)
      throw new Error(`Deployment failed: ${name}`);
    addresses[key] = receipt.contractAddress;
  }
  async function write(key: string, functionName: string, args: unknown[]) {
    const tx = {
      account: owner,
      address: addresses[key],
      abi: artifacts[key].abi,
      functionName,
      args,
    };
    await c.simulateContract(tx);
    const gas = await c.estimateContractGas(tx);
    const hash = await w.writeContract({ ...tx, gas: (gas * 12n) / 10n });
    const receipt = await c.waitForTransactionReceipt({ hash });
    if (receipt.status !== "success")
      throw new Error(
        `Seed failed: ${functionName}, gas used ${receipt.gasUsed}`,
      );
  }
  await deploy("registry", [owner]);
  await deploy("settlement", []);
  await deploy("rights", [addresses.registry, addresses.settlement]);
  await deploy("revenue", [addresses.rights]);
  await write("rights", "setRevenueVault", [addresses.revenue]);
  await deploy("basket", [addresses.rights, addresses.revenue]);
  await deploy("market", [
    addresses.rights,
    addresses.basket,
    addresses.settlement,
  ]);
  await deploy("fraction", [addresses.rights, addresses.revenue]);
  await deploy("rental", [addresses.rights]);
  for (const account of [owner, buyer])
    await write("settlement", "mint", [account, parseEther("100000")]);
  const now = Number((await c.getBlock()).timestamp);
  for (let i = 1; i <= 2; i++) {
    const metadata = {
      name: i === 1 ? "Finance Test Roof" : "Finance Test Storage",
      kind: i === 1 ? "Rooftop" : "Storage",
      district: "CHIYODA",
      coordinates: [139.77 + i / 10000, 35.69],
      area: 100,
      capacity: 20,
      description: "A fictional finance integration test.",
      simulated: true,
    };
    await write("registry", "registerAsset", [
      keccak256(stringToHex(`finance-${i}`)),
      "data:application/json," + encodeURIComponent(JSON.stringify(metadata)),
      i === 1 ? 0 : 3,
    ]);
    await write("registry", "requestVerification", [BigInt(i)]);
    await write("registry", "verifyAsset", [BigInt(i), true]);
    await write("rights", "createRight", [
      BigInt(i),
      i === 1 ? 1 : 0,
      i === 1 ? 100n : 1n,
      "Test terms",
      keccak256(stringToHex("terms")),
      BigInt(now),
      BigInt(now + 365 * 86400),
      0,
    ]);
    await write("rights", "verifyRight", [BigInt(i), true]);
    await write("rights", "activateRight", [BigInt(i)]);
  }
  const byAddress = Object.fromEntries(
    Object.entries(addresses).map(([k, a]) => [
      a.toLowerCase(),
      artifacts[k].abi as Abi,
    ]),
  );
  let cachedBlock = -1n,
    cachedLogs: any[] = [];
  async function events() {
    const block = await c.getBlockNumber();
    if (block !== cachedBlock) {
      const logs = await c.getLogs({ fromBlock: 0n, toBlock: block });
      cachedLogs = logs.flatMap((l) => {
        const abi = byAddress[l.address.toLowerCase()];
        if (!abi) return [];
        try {
          const d = decodeEventLog({ abi, data: l.data, topics: l.topics });
          const def = abi.find(
            (a: any) => a.type === "event" && a.name === d.eventName,
          ) as any;
          return [
            {
              ...l,
              eventName: d.eventName,
              values: def.inputs.map((a: any) => (d.args as any)[a.name]),
            },
          ];
        } catch {
          return [];
        }
      });
      cachedBlock = block;
    }
    return cachedLogs;
  }
  function addressFilter(f: any): string | undefined {
    return f?.fieldType === FieldType.ContractAddress
      ? f.value
      : f?.children?.map(addressFilter).find(Boolean);
  }
  api = httpServer(async (req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Headers", "authorization,content-type");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
    if (req.method === "OPTIONS") {
      res.end();
      return;
    }
    try {
      const url = new URL(req.url!, "http://localhost");
      const chunks: Buffer[] = [];
      for await (const chunk of req) chunks.push(chunk as Buffer);
      const body = chunks.length
        ? JSON.parse(Buffer.concat(chunks).toString())
        : {};
      let result: unknown;
      const match = url.pathname.match(
        /\/addresses\/([^/]+)\/contracts\/[^/]+\/methods\/([^/]+)$/,
      );
      if (match) {
        const address = decodeURIComponent(match[1]) as Address,
          method = decodeURIComponent(match[2]),
          abi = byAddress[address.toLowerCase()];
        if (!abi) throw new Error("Unknown test contract");
        const data = encodeFunctionData({
          abi,
          functionName: method,
          args: body.args || [],
        });
        if (body.signAndSubmit === false) {
          await c.simulateContract({
            account: body.from,
            address,
            abi,
            functionName: method,
            args: body.args || [],
          });
          result = {
            kind: "TransactionToSignResponse",
            submitted: false,
            tx: { from: body.from, to: address, value: "0", data },
          };
        } else
          result = {
            kind: "MethodCallResponse",
            output: await c.readContract({
              address,
              abi,
              functionName: method,
              args: body.args || [],
            }),
          };
      } else if (url.pathname.endsWith("/queries")) {
        const event = body.events[0],
          address = addressFilter(event.filter)?.toLowerCase();
        const matches = (await events()).filter(
          (l) =>
            l.eventName === event.eventName &&
            l.address.toLowerCase() === address,
        );
        let rows: Record<string, unknown>[];
        if (event.select[0]?.aggregator === "add")
          rows = [
            {
              [event.select[0].alias]: matches.reduce(
                (sum, l) => sum + BigInt(l.values[event.select[0].inputIndex]),
                0n,
              ),
            },
          ];
        else
          rows = matches.map((l) =>
            Object.fromEntries(
              event.select.map((s: any) => [
                s.alias,
                s.type === FieldType.Input
                  ? l.values[s.inputIndex]
                  : s.type === FieldType.BlockNumber
                    ? l.blockNumber
                    : s.type === FieldType.TxHash
                      ? l.transactionHash
                      : new Date(now * 1000).toISOString(),
              ]),
            ),
          );
        if (body.order === "DESC") rows.reverse();
        const offset = Number(url.searchParams.get("offset") || 0),
          limit = Number(url.searchParams.get("limit") || 50);
        result = { rows: rows.slice(offset, offset + limit) };
      } else if (url.pathname.includes("/transactions/receipt/")) {
        const receipt = await c.getTransactionReceipt({
          hash: url.pathname.split("/").pop() as `0x${string}`,
        });
        result = {
          data: {
            ...receipt,
            status: receipt.status === "success" ? "0x1" : "0x0",
          },
        };
      } else if (url.pathname.endsWith("/status"))
        result = {
          chainID: 31337,
          blockNumber: Number(await c.getBlockNumber()),
        };
      else throw new Error(`Unsupported fixture route ${url.pathname}`);
      res.setHeader("Content-Type", "application/json");
      res.end(json({ status: 200, message: "success", result }));
    } catch (e) {
      res.statusCode = 400;
      res.setHeader("Content-Type", "application/json");
      res.end(
        json({ status: 400, message: (e as Error).message.slice(0, 250) }),
      );
    }
  });
  await new Promise<void>((r) => api!.listen(0, "127.0.0.1", r));
  const apiPort = (api.address() as { port: number }).port;
  const appURL = `http://127.0.0.1:${appPort}`;
  const manifest = { rpc, owner, buyer, addresses, chainId: 31337 };
  const manifestFile = `${directory}/deployment.json`;
  writeFileSync(manifestFile, json(manifest), { mode: 0o600 });
  const env = {
    ...process.env,
    TOKENIZE_NEXT_DIST_DIR: ".data/next-finance-e2e",
    NEXT_PUBLIC_APP_MODE: "multibaas",
    NEXT_PUBLIC_CHAIN_ID: "31337",
    NEXT_PUBLIC_MULTIBAAS_URL: `http://127.0.0.1:${apiPort}`,
    NEXT_PUBLIC_MULTIBAAS_DAPP_KEY: "local-test-only",
    NEXT_PUBLIC_RPC_URL: rpc,
    NEXT_PUBLIC_ENSV2_AUTHORITY_ADDRESS: "",
    NEXT_PUBLIC_ENSV2_PARENT: "",
    FINANCE_APP_URL: appURL,
    FINANCE_TEST_MANIFEST: manifestFile,
  };
  for (const [key, address] of Object.entries(addresses))
    Object.assign(env, {
      [`NEXT_PUBLIC_${key.toUpperCase()}_ADDRESS`]: address,
    });
  start(
    process.execPath,
    [
      "node_modules/next/dist/bin/next",
      "dev",
      "--hostname",
      "127.0.0.1",
      "--port",
      String(appPort),
    ],
    env,
    `${directory}/next.log`,
  );
  for (let i = 0; ; i++) {
    try {
      const r = await fetch(appURL, { signal: AbortSignal.timeout(3000) });
      if (r.ok) break;
    } catch {}
    if (i === 60)
      throw new Error(
        "Finance test app did not start; inspect .data/finance-e2e/next.log",
      );
    await sleep(500);
  }
  await complete(
    start(
      process.execPath,
      [
        "node_modules/@playwright/test/cli.js",
        "test",
        "--config",
        "playwright.finance.config.ts",
      ],
      env,
    ),
  );
  console.log("Finance browser flows passed against isolated Anvil contracts.");
}
main()
  .catch((e) => {
    console.error((e as Error).message);
    process.exitCode = 1;
  })
  .finally(() => {
    api?.closeAllConnections();
    api?.close();
    for (const p of children)
      if (p.pid && p.exitCode === null)
        try {
          process.kill(-p.pid, "SIGTERM");
        } catch {}
    // Next generates these paths during startup. Preserve unrelated concurrent edits.
    const types = readFileSync("next-env.d.ts", "utf8");
    if (types.includes(".data/next-finance-e2e/"))
      writeFileSync("next-env.d.ts", originalTypes);
    const current = JSON.parse(readFileSync("tsconfig.json", "utf8"));
    current.include = current.include.filter(
      (p: string) => !p.startsWith(".data/next-finance-e2e/"),
    );
    writeFileSync(
      "tsconfig.json",
      JSON.stringify(current) === JSON.stringify(JSON.parse(originalTS))
        ? originalTS
        : JSON.stringify(current, null, 2) + "\n",
    );
  });
