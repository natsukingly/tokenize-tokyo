import {
  existsSync,
  readFileSync,
  writeFileSync,
  mkdirSync,
  renameSync,
  openSync,
  closeSync,
  unlinkSync,
} from "node:fs";
import { loadEnvFile } from "node:process";
import { resolve } from "node:path";
import { randomBytes } from "node:crypto";
import {
  createPublicClient,
  createWalletClient,
  http,
  encodeDeployData,
  encodeFunctionData,
  decodeFunctionResult,
  keccak256,
  stringToHex,
  zeroAddress,
  zeroHash,
  namehash,
  parseEther,
  type Abi,
  type Address,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { sepolia } from "viem/chains";
import { ENSV2_DEPLOYMENT as official } from "../src/lib/ens/deployment";
import { checkedLabel } from "../src/lib/ens/spaces";
import { ensPreflight } from "./ens-preflight";
import { metadataURI } from "../src/lib/model";

// Explicit, separate configuration. Never import .env.local or replace the Curvegrid deployment.
const envFlag = process.argv.indexOf("--env");
if (envFlag >= 0) loadEnvFile(process.argv[envFlag + 1]);
const broadcast = process.argv.includes("--broadcast");
const local = process.argv.includes("--local-fork");
const rpcURL =
  process.env.ENSV2_RPC_URL || "https://ethereum-sepolia-rpc.publicnode.com";
const client = createPublicClient({
  chain: sepolia,
  transport: http(rpcURL, { timeout: 20000, retryCount: 2 }),
});
const root = process.env.ENSV2_PARENT_LABEL;
const directory = resolve(process.env.ENSV2_JOURNAL_DIR || ".data/ens-sepolia");
const names = {
  registry: "UrbanAssetRegistry",
  settlement: "MockJPY",
  rights: "UrbanRightToken",
  revenue: "RevenueVault",
  basket: "BasketVault",
  market: "UrbanMarketplace",
  authority: "UrbanNamespaceAuthority",
};
let lockFile: string | undefined;
const load = (name: string, ens = false) =>
  JSON.parse(
    readFileSync(
      ens
        ? `contracts/test/fixtures/ensv2/${name}.json`
        : `contracts/out/${name}.sol/${name}.json`,
      "utf8",
    ),
  ) as { abi: Abi; bytecode: Hex | { object: Hex } };
type Journal = {
  chainId: number;
  account: Address;
  parent: string;
  secret: Hex;
  startingBlock: string;
  expiry: number;
  addresses: Record<string, Address>;
  steps: Record<string, { hash: Hex; serialized: Hex; maxCost: string }>;
  outputs: Record<string, string>;
};

async function main() {
  if (local && !["localhost", "127.0.0.1"].includes(new URL(rpcURL).hostname))
    throw new Error("Local-fork mode requires loopback RPC");
  console.log("Checking official ENSv2 contracts on Sepolia…");
  const report = await ensPreflight(rpcURL);
  if (!broadcast) {
    console.log(
      JSON.stringify(
        {
          ready: true,
          chainId: report.chainId,
          contractsChecked: report.checks.length,
          mode: "read-only",
          next: "Use --env .env.sepolia --broadcast to deploy a NEW protocol and register the configured test name.",
        },
        null,
        2,
      ),
    );
    return;
  }
  if (!root)
    throw new Error("Set ENSV2_PARENT_LABEL to a new test-only .eth label");
  checkedLabel(root);
  const secret = process.env.ENSV2_DEPLOYER_PRIVATE_KEY;
  if (!secret || !/^0x[0-9a-f]{64}$/i.test(secret))
    throw new Error("Set ENSV2_DEPLOYER_PRIVATE_KEY in the separate env file");
  const account = privateKeyToAccount(secret as Hex);
  const wallet = createWalletClient({
    account,
    chain: sepolia,
    transport: http(rpcURL, { timeout: 20000, retryCount: 2 }),
  });
  if ((await client.getBalance({ address: account.address })) === 0n)
    throw new Error("Deployer needs Sepolia test ETH");
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  const lock = resolve(directory, "setup.lock");
  closeSync(openSync(lock, "wx", 0o600));
  lockFile = lock;
  const file = resolve(directory, "journal.json");
  const j: Journal = existsSync(file)
    ? JSON.parse(readFileSync(file, "utf8"))
    : {
        chainId: sepolia.id,
        account: account.address,
        parent: root,
        secret: `0x${randomBytes(32).toString("hex")}`,
        startingBlock: (await client.getBlockNumber()).toString(),
        expiry: Number((await client.getBlock()).timestamp) + 365 * 86400,
        addresses: {},
        steps: {},
        outputs: {},
      };
  if (
    j.account !== account.address ||
    j.parent !== root ||
    j.chainId !== sepolia.id
  )
    throw new Error(
      "Journal/account/parent mismatch; use a separate directory",
    );
  const save = () => {
    writeFileSync(file + ".tmp", JSON.stringify(j, null, 2), { mode: 0o600 });
    renameSync(file + ".tmp", file);
  };
  save();
  const tx = async (key: string, to: Address | undefined, data: Hex) => {
    if (!j.steps[key]) {
      const request = await client.prepareTransactionRequest({
        account,
        chain: sepolia,
        to,
        data,
        value: 0n,
      });
      const fee = request.maxFeePerGas ?? request.gasPrice ?? 0n;
      const maxCost = (request.gas || 0n) * fee;
      if (
        fee > 20_000_000_000n ||
        maxCost > parseEther("0.03") ||
        Object.values(j.steps).reduce(
          (sum, s) => sum + BigInt(s.maxCost),
          maxCost,
        ) > parseEther("0.15")
      )
        throw new Error("Test gas budget exceeded");
      const serialized = await wallet.signTransaction(request);
      j.steps[key] = {
        hash: keccak256(serialized),
        serialized,
        maxCost: maxCost.toString(),
      };
      save();
    }
    const step = j.steps[key];
    let receipt = await client
      .getTransactionReceipt({ hash: step.hash })
      .catch(() => null);
    if (!receipt) {
      const pending = await client
        .getTransaction({ hash: step.hash })
        .catch(() => null);
      if (!pending)
        await client.sendRawTransaction({
          serializedTransaction: step.serialized,
        });
      receipt = await client.waitForTransactionReceipt({
        hash: step.hash,
        timeout: 180000,
      });
    }
    if (receipt.status !== "success")
      throw new Error(`Transaction reverted: ${key}; inspect ${step.hash}`);
    console.log(`${key}: ${step.hash}`);
    return receipt;
  };
  const write = async (
    key: string,
    address: Address,
    abi: Abi,
    method: string,
    args: readonly unknown[] = [],
  ) =>
    tx(key, address, encodeFunctionData({ abi, functionName: method, args }));
  const read = async (
    address: Address,
    abi: Abi,
    method: string,
    args: readonly unknown[] = [],
  ) => client.readContract({ address, abi, functionName: method, args });
  const deploy = async (key: string, args: unknown[]) => {
    if (j.addresses[key]) {
      if (!(await client.getCode({ address: j.addresses[key] })))
        throw new Error("Missing journal contract");
      return j.addresses[key];
    }
    const a = load(names[key as keyof typeof names]);
    const r = await tx(
      `deploy-${key}`,
      undefined,
      encodeDeployData({
        abi: a.abi,
        bytecode:
          typeof a.bytecode === "string" ? a.bytecode : a.bytecode.object,
        args,
      }),
    );
    if (!r.contractAddress) throw new Error("Missing deployment address");
    j.addresses[key] = r.contractAddress;
    save();
    return r.contractAddress;
  };
  const registry = await deploy("registry", [account.address]);
  const settlement = await deploy("settlement", []);
  const rights = await deploy("rights", [registry, settlement]);
  const revenue = await deploy("revenue", [rights]);
  await write(
    "set-revenue",
    rights,
    load(names.rights).abi,
    "setRevenueVault",
    [revenue],
  );
  const basket = await deploy("basket", [rights, revenue]);
  await deploy("market", [rights, basket, settlement]);
  const authority = await deploy("authority", [
    registry,
    rights,
    official.ETHRegistry,
    official.VerifiableFactory,
    official.UserRegistryImpl,
  ]);
  await write(
    "set-authority",
    rights,
    load(names.rights).abi,
    "setNamespaceAuthority",
    [authority],
  );

  const registrarABI = load("ETHRegistrar", true).abi;
  const registryABI = load("ETHRegistry", true).abi;
  const factoryABI = load("VerifiableFactory", true).abi;
  const userABI = load("UserRegistryImpl", true).abi;
  const resolverABI = load("PermissionedResolverImpl", true).abi;
  const PARENT = 1n << 8n,
    RESOLVER = 1n << 24n,
    CHILD = 1n << 20n,
    TRANSFER = (1n << 28n) << 128n;
  const proxy = async (
    key: string,
    impl: Address,
    abi: Abi,
    grants: unknown[],
    extra: unknown[] = [],
  ) => {
    const data = encodeFunctionData({
      abi,
      functionName: "initialize",
      args: [grants, ...extra],
    });
    const salt = BigInt(
      keccak256(stringToHex(`${root}:${account.address}:${key}`)),
    );
    if (!j.addresses[key]) {
      const simulated = await client.simulateContract({
        account,
        address: official.VerifiableFactory,
        abi: factoryABI,
        functionName: "deployProxy",
        args: [impl, salt, data],
      });
      j.addresses[key] = simulated.result as Address;
      save();
    }
    await write(
      `proxy-${key}`,
      official.VerifiableFactory,
      factoryABI,
      "deployProxy",
      [impl, salt, data],
    );
    return j.addresses[key];
  };
  const grants = [
    { account: account.address, roleBitmap: 1n | PARENT | (PARENT << 128n) },
  ];
  const city = await proxy("city", official.UserRegistryImpl, userABI, grants);
  const district = await proxy(
    "district",
    official.UserRegistryImpl,
    userABI,
    grants,
  );
  const building = await proxy(
    "building",
    official.UserRegistryImpl,
    userABI,
    grants,
  );
  // A single isolated resolver owned by the issuer. Operators may replace the leaf resolver,
  // but records are descriptive: authority validates the registry + binding, never addr/text.
  const resolver = await proxy(
    "resolver",
    official.PermissionedResolverImpl,
    resolverABI,
    [{ account: account.address, roleBitmap: BigInt("0x" + "1".repeat(64)) }],
    [[]],
  );
  const duration = 365 * 86400;
  const commitmentArgs = [
    root,
    account.address,
    j.secret,
    city,
    zeroAddress,
    duration,
    zeroHash,
  ];
  const commitment = (await read(
    official.ETHRegistrar,
    registrarABI,
    "makeCommitment",
    commitmentArgs,
  )) as Hex;
  if (!j.steps["register-parent"]) {
    if (
      !(await read(official.ETHRegistrar, registrarABI, "isAvailable", [root]))
    )
      throw new Error(
        "Parent already registered; choose a new test-only label",
      );
    await write(
      "commit-parent",
      official.ETHRegistrar,
      registrarABI,
      "commit",
      [commitment],
    );
    const age = Number(
      await read(official.ETHRegistrar, registrarABI, "MIN_COMMITMENT_AGE"),
    );
    const committed = Number(
      await read(official.ETHRegistrar, registrarABI, "commitmentAt", [
        commitment,
      ]),
    );
    if (local) {
      await client.request({
        method: "evm_increaseTime" as never,
        params: [age + 1] as never,
      });
      await client.request({ method: "evm_mine" as never });
    }
    while (Number((await client.getBlock()).timestamp) < committed + age) {
      console.log("Waiting for ENS commit/reveal window…");
      await new Promise((r) => setTimeout(r, 10000));
    }
    const price = (await read(
      official.ETHRegistrar,
      registrarABI,
      "getRegisterPrice",
      [root, duration, official.MockUSDC],
    )) as [bigint, bigint];
    const cost = price[0] + price[1];
    if (cost > 1_000_000_000n)
      throw new Error("Unexpected test registration price");
    await write(
      "mint-test-usdc",
      official.MockUSDC,
      load("MockUSDC", true).abi,
      "mint",
      [account.address, cost],
    );
    await write(
      "approve-test-usdc",
      official.MockUSDC,
      load("MockUSDC", true).abi,
      "approve",
      [official.ETHRegistrar, cost],
    );
    await write(
      "register-parent",
      official.ETHRegistrar,
      registrarABI,
      "register",
      [
        root,
        account.address,
        j.secret,
        city,
        zeroAddress,
        duration,
        official.MockUSDC,
        zeroHash,
      ],
    );
  }
  const parentId = BigInt(keccak256(stringToHex(root)));
  await write("lock-parent", official.ETHRegistry, registryABI, "revokeRoles", [
    parentId,
    CHILD | (CHILD << 128n) | TRANSFER,
    account.address,
  ]);
  for (const [key, child, parent, label] of [
    ["city", city, official.ETHRegistry, root],
    ["district", district, city, "chiyoda"],
    ["building", building, district, "building-1"],
  ] as const) {
    if (key !== "city")
      await write(`register-${key}`, parent, userABI, "register", [
        label,
        account.address,
        child,
        zeroAddress,
        0n,
        j.expiry,
      ]);
    await write(`parent-${key}`, child, userABI, "setParent", [parent, label]);
    await write(`lock-${key}`, child, userABI, "revokeRootRoles", [
      PARENT | (PARENT << 128n),
      account.address,
    ]);
  }
  await write("register-rooftop", building, userABI, "register", [
    "rooftop",
    account.address,
    zeroAddress,
    resolver,
    RESOLVER | (RESOLVER << 128n),
    j.expiry,
  ]);
  await write("register-interior", building, userABI, "register", [
    "interior",
    account.address,
    zeroAddress,
    resolver,
    RESOLVER | (RESOLVER << 128n),
    j.expiry,
  ]);
  const fullName = `rooftop.building-1.chiyoda.${root}.eth`;
  const dns = ("0x" +
    fullName
      .split(".")
      .map(
        (p) =>
          p.length.toString(16).padStart(2, "0") +
          Buffer.from(p).toString("hex"),
      )
      .join("") +
    "00") as Hex;
  for (const [key, value] of Object.entries({
    "urban.chainId": String(sepolia.id),
    "urban.rightsContract": rights,
    "urban.assetId": "1",
    "urban.scope": "rooftop",
    "urban.authority": authority,
  }))
    await write(`record-${key}`, resolver, resolverABI, "setText", [
      dns,
      key,
      value,
    ]);
  await write(
    "sample-asset",
    registry,
    load(names.registry).abi,
    "registerAsset",
    [
      keccak256(stringToHex(`ENSv2-demo:${root}`)),
      metadataURI({
        name: "Chiyoda ENS Solar Roof · Test",
        district: "CHIYODA",
        kind: "Rooftop",
        coordinates: [139.77, 35.69],
        area: 240,
        capacity: 35,
        simulated: true,
        description:
          "Sepolia ENSv2 delegation test space. Verification is simulated.",
      }),
      0,
    ],
  );
  await write(
    "request-asset",
    registry,
    load(names.registry).abi,
    "requestVerification",
    [1n],
  );
  await write(
    "verify-test-asset",
    registry,
    load(names.registry).abi,
    "verifyAsset",
    [1n, true],
  );
  await write("bind-space", authority, load(names.authority).abi, "bindSpace", [
    1n,
    0,
    [root, "chiyoda", "building-1", "rooftop"],
  ]);
  const request = encodeFunctionData({
    abi: [
      {
        type: "function",
        name: "text",
        stateMutability: "view",
        inputs: [
          { name: "node", type: "bytes32" },
          { name: "key", type: "string" },
        ],
        outputs: [{ type: "string" }],
      },
    ],
    functionName: "text",
    args: [namehash(fullName), "urban.assetId"],
  });
  const result = (await read(
    official.UniversalResolverV2,
    load("UniversalResolverV2", true).abi,
    "resolve",
    [dns, request],
  )) as [Hex, Address];
  const value = decodeFunctionResult({
    abi: [
      {
        type: "function",
        name: "text",
        stateMutability: "view",
        inputs: [],
        outputs: [{ type: "string" }],
      },
    ],
    functionName: "text",
    data: result[0],
  });
  if (value !== "1" || result[1].toLowerCase() !== resolver.toLowerCase())
    throw new Error("Universal resolution failed");
  const manifest = {
    chainId: sepolia.id,
    startingBlock: Number(j.startingBlock),
    admin: account.address,
    ...j.addresses,
    ens: {
      sourceCommit: official.sourceCommit,
      parent: `${root}.eth`,
      name: fullName,
      assetId: "1",
      scope: 0,
      anchor: official.ETHRegistry,
      resolver,
      registrationTx: j.steps["register-parent"].hash,
      bindingTx: j.steps["bind-space"].hash,
      locallyForked: local,
    },
  };
  const output = resolve(directory, "deployment.json");
  writeFileSync(output, JSON.stringify(manifest, null, 2) + "\n");
  console.log(
    `Verified registration + resolution + space binding. Manifest: ${output}`,
  );
}
main()
  .catch((error) => {
    // Do not serialize provider errors: they can include RPC credentials or signed requests.
    const safe =
      error instanceof Error && error.constructor === Error
        ? error.message
        : "RPC/transaction operation failed; inspect the saved journal hashes before retrying.";
    console.error(safe);
    process.exitCode = 1;
  })
  .finally(() => {
    if (lockFile) unlinkSync(lockFile);
  });
