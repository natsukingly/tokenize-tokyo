import "./env";
import {
  chmodSync,
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { resolve } from "node:path";
import {
  createPublicClient,
  decodeEventLog,
  encodeFunctionData,
  formatEther,
  http,
  keccak256,
  parseEther,
  stringToHex,
  type Abi,
  type Address,
  type Hex,
  type TransactionReceipt,
} from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import type { TransactionToSignResponse } from "@curvegrid/multibaas-sdk";
import { config, labels, type ContractKey } from "../src/lib/config";
import { clients, readContract } from "../src/lib/multibaas";
import { CORE_DEMO_SITES as DEMO_SITES } from "../src/lib/demo-catalog";
import { assetTypeCode, SPACE_TYPES } from "../src/lib/catalog";
import { metadataURI, compactMetadataURI } from "../src/lib/model";
import { suggestedProject } from "../src/lib/project-plan";
import { walletTransaction } from "../src/lib/transactions";

// Fixed destination and bounded scenario. Never run this on a value-bearing network.
const CHAIN_ID = 11155111;
const MAX_TEST_ETH = parseEther("0.018");
const MAX_GAS_PRICE = 3_000_000_000n;
const MAX_TRANSACTIONS = 100;
const names: Record<ContractKey, string> = {
  registry: "UrbanAssetRegistry",
  rights: "UrbanRightToken",
  market: "UrbanMarketplace",
  revenue: "RevenueVault",
  basket: "BasketVault",
  settlement: "MockJPY",
};
type Step = {
  hash: Hex;
  action: string;
  actor: string;
  value: string;
  serialized?: Hex;
  block?: string;
  gasCost?: string;
  outputId?: string;
};
type Journal = {
  chainId: number;
  registry: string;
  catalog: string;
  startedAt: string;
  start: number;
  actors: Record<string, string>;
  steps: Record<string, Step>;
};
const api = clients();
const rpcUrl = process.env.NETWORK_RPC_URL;
const secret = process.env.PRIVATE_KEY;
if (!rpcUrl || !secret || !/^0x[0-9a-f]{64}$/i.test(secret))
  throw new Error(
    "Configure NETWORK_RPC_URL and PRIVATE_KEY in the local environment",
  );
const rpc = createPublicClient({
  transport: http(rpcUrl, { timeout: 20_000, retryCount: 0 }),
});
const owner = privateKeyToAccount(secret as Hex);
const abis = Object.fromEntries(
  Object.entries(names).map(([key, name]) => [
    key,
    JSON.parse(readFileSync(`contracts/out/${name}.sol/${name}.json`, "utf8"))
      .abi,
  ]),
) as Record<ContractKey, Abi>;
let journal: Journal;
let directory: string;
let journalFile: string;
let lockFile: string | undefined;
const actors = { owner } as Record<
  string,
  ReturnType<typeof privateKeyToAccount>
>;

function assert(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}
function save() {
  const temporary = journalFile + ".tmp";
  writeFileSync(temporary, JSON.stringify(journal, null, 2) + "\n", {
    mode: 0o600,
  });
  renameSync(temporary, journalFile);
  const publicSteps = Object.entries(journal.steps)
    .filter(([, step]) => step.block)
    .map(([name, { serialized: _, ...step }]) => ({ name, ...step }));
  writeFileSync(
    "deployments/sepolia-demo-receipts.json",
    JSON.stringify(
      {
        chainId: CHAIN_ID,
        registry: journal.registry,
        simulated: true,
        description:
          "Scripted testnet scenarios. Not organic activity, real vacancies or investment returns.",
        startedAt: journal.startedAt,
        updatedAt: new Date().toISOString(),
        actors: journal.actors,
        confirmedTransactions: publicSteps.length,
        transactions: publicSteps,
      },
      null,
      2,
    ) + "\n",
  );
}
function spent() {
  return Object.values(journal.steps).reduce(
    (total, step) => total + BigInt(step.gasCost || "0") + BigInt(step.value),
    0n,
  );
}
async function finish(
  step: Step,
  key?: ContractKey,
  eventName?: string,
  idField?: string,
) {
  let receipt: TransactionReceipt | undefined;
  try {
    receipt = await rpc.getTransactionReceipt({ hash: step.hash });
  } catch {}
  if (!receipt) {
    assert(step.serialized, "Missing signed transaction for recovery");
    try {
      await rpc.sendRawTransaction({ serializedTransaction: step.serialized });
    } catch (error) {
      // A previous run may already have broadcast this exact hash. Never sign another tx here.
      try {
        await rpc.getTransaction({ hash: step.hash });
      } catch {
        throw error;
      }
    }
    receipt = await rpc.waitForTransactionReceipt({
      hash: step.hash,
      timeout: 180_000,
      pollingInterval: 1500,
    });
  }
  assert(receipt.status === "success", `Transaction reverted: ${step.hash}`);
  if (key && eventName && idField) {
    for (const log of receipt.logs) {
      if (log.address.toLowerCase() !== config.addresses[key].toLowerCase())
        continue;
      try {
        const event = decodeEventLog({
          abi: abis[key],
          data: log.data,
          topics: log.topics,
        });
        if (event.eventName === eventName)
          step.outputId = String(
            (event.args as unknown as Record<string, unknown>)[idField],
          );
      } catch {}
    }
    assert(
      step.outputId && /^\d+$/.test(step.outputId),
      `Missing ${eventName} receipt`,
    );
  }
  step.block = receipt.blockNumber.toString();
  step.gasCost = (receipt.gasUsed * receipt.effectiveGasPrice).toString();
  delete step.serialized;
  save();
  const count = Object.values(journal.steps).filter(
    (step) => step.block,
  ).length;
  if (count % 10 === 0 || count < 5)
    console.log(
      `${count} confirmed · ${step.action} · ${formatEther(spent())} test ETH including actor funding`,
    );
  return step.outputId;
}
async function transact(
  name: string,
  actor: string,
  to: Address,
  data: Hex,
  gas: bigint,
  value = 0n,
  key?: ContractKey,
  eventName?: string,
  idField?: string,
) {
  const previous = journal.steps[name];
  if (previous?.block) return previous.outputId;
  if (previous) return finish(previous, key, eventName, idField);
  assert(
    Object.keys(journal.steps).length < MAX_TRANSACTIONS,
    "Scenario transaction cap reached",
  );
  // Sepolia base fees can move before inclusion. Keep a small bounded margin.
  const gasPrice = (await rpc.getGasPrice()) * 12n / 10n + 100_000_000n;
  assert(
    gasPrice <= MAX_GAS_PRICE && gas > 0n && gas <= 5_000_000n,
    "Unexpected gas estimate",
  );
  assert(
    spent() + gas * gasPrice + value <= MAX_TEST_ETH,
    "Scenario test ETH budget reached",
  );
  const account = actors[actor];
  assert(
    (await rpc.getBalance({ address: account.address })) >=
      gas * gasPrice + value,
    `Insufficient test ETH for ${actor}`,
  );
  const serialized = await account.signTransaction({
    chainId: CHAIN_ID,
    type: "legacy",
    nonce: await rpc.getTransactionCount({
      address: account.address,
      blockTag: "pending",
    }),
    to,
    data,
    gas,
    gasPrice,
    value,
  });
  const step: Step = {
    hash: keccak256(serialized),
    action: name,
    actor,
    value: value.toString(),
    serialized,
  };
  journal.steps[name] = step;
  save(); // Journal the signed hash BEFORE submission, allowing exact-hash recovery.
  return finish(step, key, eventName, idField);
}
async function write(
  name: string,
  actor: string,
  key: ContractKey,
  method: string,
  args: unknown[] = [],
  eventName?: string,
  idField?: string,
) {
  const previous = journal.steps[name];
  if (previous?.block) return previous.outputId;
  if (previous) return finish(previous, key, eventName, idField);
  const from = actors[actor].address;
  const sdkArgs = JSON.parse(
    JSON.stringify(args, (_, v) => (typeof v === "bigint" ? v.toString() : v)),
  );
  const response = await api.contracts.callContractFunction(
    config.addresses[key],
    labels[key],
    method,
    {
      args: sdkArgs,
      from,
      signAndSubmit: false,
      formatInts: "as_strings",
    },
  );
  const result = response.data.result as TransactionToSignResponse;
  assert(
    result.kind === "TransactionToSignResponse" && !result.submitted,
    "Expected unsigned MultiBaas transaction",
  );
  const checked = walletTransaction(result.tx, from, config.addresses[key]);
  const expected = encodeFunctionData({
    abi: abis[key],
    functionName: method,
    args,
  });
  assert(
    checked.data.toLowerCase() === expected.toLowerCase(),
    "MultiBaas calldata does not match the requested action",
  );
  return transact(
    name,
    actor,
    checked.to as Address,
    checked.data as Hex,
    (BigInt(result.tx.gas) * 12n) / 10n,
    0n,
    key,
    eventName,
    idField,
  );
}
async function main() {
  assert(process.argv.includes("--env"), "Use --env .env.sepolia");
  const [chain, mb] = await Promise.all([
    rpc.getChainId(),
    api.chains.getChainStatus(),
  ]);
  assert(
    chain === CHAIN_ID &&
      config.chainId === CHAIN_ID &&
      mb.data.result.chainID === CHAIN_ID,
    "Sepolia only",
  );
  const manifest = JSON.parse(
    readFileSync("deployments/11155111.json", "utf8"),
  );
  assert(
    owner.address.toLowerCase() === manifest.admin.toLowerCase(),
    "Unexpected issuer",
  );
  for (const key of Object.keys(names) as ContractKey[]) {
    assert(
      config.addresses[key].toLowerCase() ===
        String(manifest[key]).toLowerCase(),
      `Unexpected ${key} deployment`,
    );
    assert(
      (await rpc.getCode({ address: config.addresses[key] as Address }))
        ?.length! > 2,
      `Missing ${key} code`,
    );
  }
  assert(
    String(await readContract("settlement", "decimals")) === "18",
    "Unexpected MockJPY precision",
  );
  const root = (await readContract("rights", "getRight", ["1"])) as {
    assetId?: string;
    issuer?: string;
  };
  assert(
    String(root.assetId) === "1" &&
      root.issuer?.toLowerCase() === owner.address.toLowerCase(),
    "Expected ENS-issued roof right #1",
  );
  console.log(
    "Sepolia scenario: existing ENS roof + parking/advertising income + vacant-space usage; purchase, resale, deposited revenue, mixed basket and redemption.",
  );
  console.log(
    "Cap: 100 transactions / 0.018 test ETH including actor funding. Existing Curvegrid Testnet is untouched.",
  );
  if (!process.argv.includes("--broadcast")) {
    console.log(
      "Read-only preflight passed. Add --broadcast to execute or resume.",
    );
    return;
  }
  assert(
    (await readContract("registry", "hasRole", [
      keccak256(stringToHex("VERIFIER_ROLE")),
      owner.address,
    ])) === true,
    "Verifier role required",
  );
  directory = resolve(
    `.data/sepolia-market-${config.addresses.registry.toLowerCase()}`,
  );
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  chmodSync(directory, 0o700);
  const candidate = resolve(directory, "seed.lock");
  if (existsSync(candidate)) {
    const pid = Number(readFileSync(candidate, "utf8"));
    let alive = false;
    try {
      if (pid > 0) {
        process.kill(pid, 0);
        alive = true;
      }
    } catch {}
    assert(!alive, "Another seed process is running");
    unlinkSync(candidate);
  }
  closeSync(openSync(candidate, "wx", 0o600));
  lockFile = candidate;
  writeFileSync(candidate, String(process.pid));
  const keysFile = resolve(directory, "actors.env");
  if (!existsSync(keysFile))
    writeFileSync(keysFile, `investorB=${generatePrivateKey()}\n`, {
      mode: 0o600,
    });
  chmodSync(keysFile, 0o600);
  actors.investorB = privateKeyToAccount(
    readFileSync(keysFile, "utf8").trim().split("=")[1] as Hex,
  );
  const sites = [
    DEMO_SITES.find((s) => s.kind === "Parking")!,
    DEMO_SITES.find((s) => s.kind === "Advertising")!,
    DEMO_SITES.find((s) => s.kind === "Vacant Home")!,
  ];
  const catalog = keccak256(
    stringToHex(JSON.stringify({ version: "sepolia-small-v1", sites })),
  );
  journalFile = resolve(directory, "journal.json");
  journal = existsSync(journalFile)
    ? JSON.parse(readFileSync(journalFile, "utf8"))
    : {
        chainId: CHAIN_ID,
        registry: config.addresses.registry,
        catalog,
        startedAt: new Date().toISOString(),
        start: Number((await rpc.getBlock()).timestamp) - 60,
        actors: Object.fromEntries(
          Object.entries(actors).map(([name, account]) => [
            name,
            account.address,
          ]),
        ),
        steps: {},
      };
  assert(
    journal.chainId === CHAIN_ID &&
      journal.registry.toLowerCase() ===
        config.addresses.registry.toLowerCase() &&
      journal.catalog === catalog,
    "Scenario changed; inspect journal before proceeding",
  );
  for (const [name, account] of Object.entries(actors))
    assert(journal.actors[name] === account.address, "Signer changed");
  save();
  await transact(
    "setup/investor/gas",
    "owner",
    actors.investorB.address,
    "0x",
    21000n,
    parseEther("0.003"),
  );
  for (const name of Object.keys(actors)) {
    await write(`setup/${name}/cash`, "owner", "settlement", "mint", [
      actors[name].address,
      parseEther("100000"),
    ]);
    await write(`setup/${name}/approve-market`, name, "settlement", "approve", [
      config.addresses.market,
      parseEther("100000"),
    ]);
    await write(
      `setup/${name}/trade-rights`,
      name,
      "rights",
      "setApprovalForAll",
      [config.addresses.market, true],
    );
  }
  await write("setup/approve-revenue", "owner", "settlement", "approve", [
    config.addresses.revenue,
    parseEther("100000"),
  ]);
  await write("setup/approve-basket", "owner", "rights", "setApprovalForAll", [
    config.addresses.basket,
    true,
  ]);
  await write("setup/trade-basket", "owner", "basket", "setApprovalForAll", [
    config.addresses.market,
    true,
  ]);
  const revenueRights = ["1"];
  await write("roof/verify", "owner", "rights", "verifyRight", ["1", true]);
  const roofListing = (await write(
    "roof/list",
    "owner",
    "market",
    "createListing",
    [config.addresses.rights, "1", "8", parseEther("2400")],
    "ListingCreated",
    "listingId",
  ))!;
  await write("roof/purchase", "investorB", "market", "purchase", [
    roofListing,
    "3",
  ]);
  await write("roof/activate", "owner", "rights", "activateRight", ["1"]);
  await write("roof/revenue", "owner", "revenue", "depositRevenue", [
    "1",
    parseEther("1000"),
  ]);
  await write("roof/claim", "investorB", "revenue", "claim", ["1"]);
  const resale = (await write(
    "roof/resell",
    "investorB",
    "market",
    "createListing",
    [config.addresses.rights, "1", "1", parseEther("2500")],
    "ListingCreated",
    "listingId",
  ))!;
  await write("roof/resale-purchase", "owner", "market", "purchase", [
    resale,
    "1",
  ]);
  for (const [index, site] of sites.entries()) {
    const prefix = `space-${index}`,
      revenue = index < 2,
      type = SPACE_TYPES[site.kind];
    const proposal = suggestedProject(site.kind, site.name);
    const overview = revenue ? proposal.overview : site.description;
    const asset = (await write(
      `${prefix}/register`,
      "owner",
      "registry",
      "registerAsset",
      [
        keccak256(stringToHex(`tokenize-tokyo-sepolia-v1:${site.name}`)),
        compactMetadataURI({
          ...site,
          name: `${site.name} · Sepolia Test`,
          description: overview,
          projectAssumptions: proposal.assumptions,
          simulated: true,
          dataset: "sepolia-small-v1",
          verification: "Simulated ownership verification",
        }),
        assetTypeCode(site.kind),
      ],
      "AssetRegistered",
      "assetId",
    ))!;
    await write(
      `${prefix}/submit`,
      "owner",
      "registry",
      "requestVerification",
      [asset],
    );
    await write(`${prefix}/verify-asset`, "owner", "registry", "verifyAsset", [
      asset,
      true,
    ]);
    const terms = metadataURI({
      purpose: revenue ? `${site.kind} operating revenue` : type.terms,
      simulated: true,
      description: revenue
        ? "Proportional share of test revenue deposited by the operator; no usage permission or guaranteed return."
        : "Exclusive temporary access to a fictional workshop; no income entitlement.",
    });
    const right = (await write(
      `${prefix}/issue`,
      "owner",
      "rights",
      "createScopedRight",
      [
        [
          asset,
          revenue ? 1 : 0,
          revenue ? "100" : "1",
          terms,
          keccak256(stringToHex(terms)),
          journal.start,
          journal.start + 365 * 86400,
          0,
          ["Rooftop", "Interior", "Wall", "Land", "Whole asset"].indexOf(
            type.scope,
          ),
          keccak256(stringToHex(type.purpose)),
          !revenue,
        ],
      ],
      "RightCreated",
      "rightId",
    ))!;
    await write(`${prefix}/verify-right`, "owner", "rights", "verifyRight", [
      right,
      true,
    ]);
    const listing = (await write(
      `${prefix}/list`,
      "owner",
      "market",
      "createListing",
      [
        config.addresses.rights,
        right,
        revenue ? "97" : "1",
        parseEther(revenue ? "600" : "12000"),
      ],
      "ListingCreated",
      "listingId",
    ))!;
    if (revenue) {
      revenueRights.push(right);
      await write(`${prefix}/purchase`, "investorB", "market", "purchase", [
        listing,
        "20",
      ]);
      await write(`${prefix}/activate`, "owner", "rights", "activateRight", [
        right,
      ]);
      await write(`${prefix}/revenue`, "owner", "revenue", "depositRevenue", [
        right,
        parseEther("1500"),
      ]);
    }
  }
  const basket = (await write(
    "basket/create",
    "owner",
    "basket",
    "createBasket",
    [
      revenueRights,
      ["1", "1", "1"],
      metadataURI({
        name: "Tokyo Mixed Income · Solar / Parking / Advertising",
        simulated: true,
      }),
    ],
    "BasketCreated",
    "basketId",
  ))!;
  await write("basket/mint", "owner", "basket", "depositUnderlying", [
    basket,
    "3",
  ]);
  const basketListing = (await write(
    "basket/list",
    "owner",
    "market",
    "createListing",
    [config.addresses.basket, basket, "2", parseEther("4000")],
    "ListingCreated",
    "listingId",
  ))!;
  await write("basket/purchase", "investorB", "market", "purchase", [
    basketListing,
    "1",
  ]);
  for (const id of revenueRights)
    await write(`basket/revenue-${id}`, "owner", "revenue", "depositRevenue", [
      id,
      parseEther("600"),
    ]);
  await write("basket/claim", "investorB", "basket", "claimRevenue", [basket]);
  await write("basket/redeem", "owner", "basket", "redeem", [basket, "1"]);
  for (const id of revenueRights)
    assert(
      String(
        await readContract("rights", "balanceOf", [
          config.addresses.basket,
          id,
        ]),
      ) === "2",
      "Underlying custody mismatch",
    );
  assert(
    String(
      await readContract("basket", "balanceOf", [
        actors.investorB.address,
        basket,
      ]),
    ) === "1",
    "Investor basket balance mismatch",
  );
  console.log(
    `Complete: ${Object.keys(journal.steps).length} recorded actions; ${formatEther(spent())} test ETH including actor funding. Reruns resume without duplication.`,
  );
}
main()
  .catch((error) => {
    let message = String(
      error?.response?.data?.message ||
        error.shortMessage ||
        error.message ||
        "Scenario failed",
    );
    for (const [key, value] of Object.entries(process.env))
      if (value && value.length > 6 && /KEY|SECRET|TOKEN|URL/.test(key))
        message = message.split(value).join("[redacted]");
    console.error("Sepolia scenario stopped:", message.slice(0, 500));
    process.exitCode = 1;
  })
  .finally(() => {
    if (lockFile && existsSync(lockFile)) unlinkSync(lockFile);
  });
