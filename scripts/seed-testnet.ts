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
import { metadataURI } from "../src/lib/model";
import { walletTransaction } from "../src/lib/transactions";

// Fixed destination and bounded scenario. Never run this on a value-bearing network.
const CHAIN_ID = 2017072401;
const MAX_TEST_ETH = parseEther("0.7");
const MAX_GAS_PRICE = 10_000_000_000n;
const MAX_TRANSACTIONS = 650;
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
    "deployments/testnet-demo-receipts.json",
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
      timeout: 60_000,
      pollingInterval: 750,
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
  const gasPrice = await rpc.getGasPrice();
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
  const [chain, mb] = await Promise.all([
    rpc.getChainId(),
    api.chains.getChainStatus(),
  ]);
  assert(
    chain === CHAIN_ID &&
      config.chainId === CHAIN_ID &&
      mb.data.result.chainID === CHAIN_ID,
    "Curvegrid Testnet only",
  );
  const manifest = JSON.parse(
    readFileSync(`deployments/${CHAIN_ID}.json`, "utf8"),
  );
  for (const key of Object.keys(names) as ContractKey[]) {
    assert(
      /^0x[0-9a-f]{40}$/i.test(config.addresses[key]) &&
        config.addresses[key].toLowerCase() ===
          String(manifest[key]).toLowerCase(),
      `Unexpected ${key} deployment`,
    );
    assert(
      (await rpc.getCode({ address: config.addresses[key] as Address }))
        ?.length! > 2,
      `Missing ${key} contract`,
    );
  }
  assert(
    (await readContract("registry", "hasRole", [
      keccak256(stringToHex("VERIFIER_ROLE")),
      owner.address,
    ])) === true,
    "Operator requires verifier role",
  );
  assert(
    String(await readContract("settlement", "decimals")) === "18",
    "Unexpected MockJPY decimals",
  );
  directory = resolve(
    `.data/testnet-seed-${CHAIN_ID}-${config.addresses.registry.toLowerCase()}`,
  );
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  chmodSync(directory, 0o700);
  const candidate = resolve(directory, "seed.lock");
  if (existsSync(candidate)) {
    const pid = Number(readFileSync(candidate, "utf8"));
    let alive = false;
    if (Number.isInteger(pid) && pid > 0) {
      try {
        process.kill(pid, 0);
        alive = true;
      } catch {}
    }
    assert(!alive, "Another seed process is running");
    unlinkSync(candidate);
  }
  closeSync(openSync(candidate, "wx", 0o600));
  lockFile = candidate;
  writeFileSync(candidate, String(process.pid));
  const keysFile = resolve(directory, "actors.env");
  if (!existsSync(keysFile))
    writeFileSync(
      keysFile,
      ["investorB", "investorC", "composer"]
        .map((name) => `${name}=${generatePrivateKey()}`)
        .join("\n") + "\n",
      { mode: 0o600 },
    );
  chmodSync(keysFile, 0o600);
  for (const line of readFileSync(keysFile, "utf8").trim().split("\n")) {
    const [name, key] = line.split("=");
    assert(
      ["investorB", "investorC", "composer"].includes(name),
      "Unexpected scenario actor",
    );
    actors[name] = privateKeyToAccount(key as Hex);
  }
  journalFile = resolve(directory, "journal.json");
  const catalog = keccak256(stringToHex(JSON.stringify(DEMO_SITES)));
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
    journal.catalog === catalog &&
      journal.chainId === CHAIN_ID &&
      journal.registry.toLowerCase() ===
        config.addresses.registry.toLowerCase(),
    "Scenario manifest changed; preserve and inspect the existing journal",
  );
  for (const [name, account] of Object.entries(actors))
    assert(journal.actors[name] === account.address, "Scenario signer changed");
  save();
  console.log(
    `Preparing ${DEMO_SITES.length} fictional spaces on Curvegrid Testnet; resumes ${Object.keys(journal.steps).length} recorded actions`,
  );
  for (const name of ["investorB", "investorC", "composer"]) {
    await transact(
      `setup/${name}/gas`,
      "owner",
      actors[name].address,
      "0x",
      21_000n,
      parseEther("0.04"),
    );
  }
  for (const name of Object.keys(actors)) {
    // Each faucet call is capped at one million valueless MockJPY.
    for (let round = 0; round < 2; round++) {
      await write(
        `setup/${name}/cash-${round}`,
        "owner",
        "settlement",
        "mint",
        [actors[name].address, parseEther("1000000")],
      );
    }
    await write(`setup/${name}/approve-market`, name, "settlement", "approve", [
      config.addresses.market,
      parseEther("10000000"),
    ]);
    await write(
      `setup/${name}/approve-rights`,
      name,
      "rights",
      "setApprovalForAll",
      [config.addresses.market, true],
    );
  }
  await write("setup/approve-revenue", "owner", "settlement", "approve", [
    config.addresses.revenue,
    parseEther("10000000"),
  ]);
  await write(
    "setup/composer/approve-basket",
    "composer",
    "rights",
    "setApprovalForAll",
    [config.addresses.basket, true],
  );
  await write(
    "setup/composer/trade-basket",
    "composer",
    "basket",
    "setApprovalForAll",
    [config.addresses.market, true],
  );
  const solar: { index: number; right: string; listing: string }[] = [];
  for (const [index, site] of DEMO_SITES.entries()) {
    const prefix = `space-${index}`;
    const asset = (await write(
      `${prefix}/register`,
      "owner",
      "registry",
      "registerAsset",
      [
        keccak256(stringToHex(`tokenize-tokyo-scenario-v3:${site.name}`)),
        metadataURI({
          ...site,
          name: `${site.name} · Demo`,
          simulated: true,
          dataset: "scripted-testnet-v3",
          verification: "Simulated, not ownership evidence",
        }),
        assetTypeCode(site.kind),
      ],
      "AssetRegistered",
      "assetId",
    ))!;
    if (index >= 7 && index % 14 === 12) continue; // Draft examples
    await write(
      `${prefix}/submit`,
      "owner",
      "registry",
      "requestVerification",
      [asset],
    );
    if (index >= 7 && index % 14 === 13) continue; // Verification queue examples
    await write(`${prefix}/verify-asset`, "owner", "registry", "verifyAsset", [
      asset,
      true,
    ]);
    const type = SPACE_TYPES[site.kind];
    const isSolar = site.kind === "Rooftop";
    const terms = metadataURI({
      purpose: type.terms,
      simulated: true,
      evidence:
        "Scripted testnet scenario; no real property rights or production income.",
    });
    const right = (await write(
      `${prefix}/issue`,
      "owner",
      "rights",
      "createScopedRight",
      [
        [
          asset,
          isSolar ? 1 : 0,
          isSolar ? "100" : "1",
          terms,
          keccak256(stringToHex(terms)),
          journal.start,
          journal.start +
            (site.kind === "Parking" || site.kind === "Advertising"
              ? 30
              : site.kind === "Storage"
                ? 90
                : 365) *
              86400,
          0,
          ["Rooftop", "Interior", "Wall", "Land", "Whole asset"].indexOf(
            type.scope,
          ),
          keccak256(stringToHex(type.purpose)),
          !isSolar,
        ],
      ],
      "RightCreated",
      "rightId",
    ))!;
    if (index >= 7 && index % 14 === 11) continue; // Right review examples
    await write(`${prefix}/verify-right`, "owner", "rights", "verifyRight", [
      right,
      true,
    ]);
    const price = parseEther(index === 1 ? "1800" : type.price);
    const listing = (await write(
      `${prefix}/list`,
      "owner",
      "market",
      "createListing",
      [config.addresses.rights, right, isSolar ? "100" : "1", price],
      "ListingCreated",
      "listingId",
    ))!;
    if (isSolar) {
      solar.push({ index, right, listing });
      await write(`${prefix}/invest-B`, "investorB", "market", "purchase", [
        listing,
        "20",
      ]);
      await write(`${prefix}/invest-C`, "investorC", "market", "purchase", [
        listing,
        "10",
      ]);
      await write(
        `${prefix}/invest-composer`,
        "composer",
        "market",
        "purchase",
        [listing, "10"],
      );
      // Leave one funded-but-not-activated project for the lifecycle demo.
      if (index === 7) {
        await write(
          `${prefix}/complete-funding`,
          "investorB",
          "market",
          "purchase",
          [listing, "60"],
        );
      } else {
        await write(`${prefix}/activate`, "owner", "rights", "activateRight", [
          right,
        ]);
        await write(
          `${prefix}/revenue-1`,
          "owner",
          "revenue",
          "depositRevenue",
          [right, parseEther("10000")],
        );
        await write(`${prefix}/claim-B`, "investorB", "revenue", "claim", [
          right,
        ]);
        const resale = (await write(
          `${prefix}/resell`,
          "investorB",
          "market",
          "createListing",
          [config.addresses.rights, right, "5", price + parseEther("100")],
          "ListingCreated",
          "listingId",
        ))!;
        await write(
          `${prefix}/secondary-purchase`,
          "investorC",
          "market",
          "purchase",
          [resale, "2"],
        );
        await write(
          `${prefix}/revenue-2`,
          "owner",
          "revenue",
          "depositRevenue",
          [right, parseEther("5000")],
        );
        await write(`${prefix}/claim-C`, "investorC", "revenue", "claim", [
          right,
        ]);
      }
    } else if (index % 3 !== 1) {
      await write(`${prefix}/acquire`, "investorB", "market", "purchase", [
        listing,
        "1",
      ]);
      if (index % 3 === 0)
        await write(`${prefix}/activate`, "owner", "rights", "activateRight", [
          right,
        ]);
      const resale = (await write(
        `${prefix}/resell`,
        "investorB",
        "market",
        "createListing",
        [config.addresses.rights, right, "1", price],
        "ListingCreated",
        "listingId",
      ))!;
      if (index % 2 === 0)
        await write(
          `${prefix}/secondary-purchase`,
          "investorC",
          "market",
          "purchase",
          [resale, "1"],
        );
    }
    console.log(
      `Space ${index + 1}/${DEMO_SITES.length}: ${site.name} · asset ${asset} / right ${right}`,
    );
  }
  const operating = solar.filter((s) => s.index !== 7);
  for (
    let group = 0;
    group < Math.min(3, Math.floor(operating.length / 2));
    group++
  ) {
    const components = operating.slice(group * 2, group * 2 + 2);
    const prefix = `basket-${group}`;
    const id = (await write(
      `${prefix}/create`,
      "composer",
      "basket",
      "createBasket",
      [
        components.map((s) => s.right),
        ["1", "1"],
        metadataURI({
          name:
            group === 0
              ? "Tokyo Solar Basket"
              : `Tokyo Solar Basket ${group + 1}`,
          simulated: true,
        }),
      ],
      "BasketCreated",
      "basketId",
    ))!;
    await write(`${prefix}/mint`, "composer", "basket", "depositUnderlying", [
      id,
      "5",
    ]);
    for (const component of components)
      await write(
        `${prefix}/revenue-${component.index}`,
        "owner",
        "revenue",
        "depositRevenue",
        [component.right, parseEther("2000")],
      );
    await write(`${prefix}/claim`, "composer", "basket", "claimRevenue", [id]);
    const listing = (await write(
      `${prefix}/list`,
      "composer",
      "market",
      "createListing",
      [config.addresses.basket, id, "2", parseEther("5000")],
      "ListingCreated",
      "listingId",
    ))!;
    await write(`${prefix}/purchase`, "investorC", "market", "purchase", [
      listing,
      "1",
    ]);
    await write(`${prefix}/redeem`, "composer", "basket", "redeem", [id, "1"]);
    assert(
      String(
        await readContract("basket", "balanceOf", [
          actors.composer.address,
          id,
        ]),
      ) === "3",
      "Unexpected basket balance",
    );
    for (const component of components)
      assert(
        String(
          await readContract("rights", "balanceOf", [
            config.addresses.basket,
            component.right,
          ]),
        ) === "4",
        "Underlying custody mismatch",
      );
  }
  console.log(
    `Complete: ${Object.keys(journal.steps).length} confirmed transactions, ${formatEther(spent())} test ETH including actor funding. Rerunning resumes without repeating completed actions.`,
  );
}
main()
  .catch((error) => {
    // Axios/viem errors can embed credentials in URLs. Only emit a sanitized short message.
    let message = String(
      error?.response?.data?.message ||
        error.shortMessage ||
        error.message ||
        "Seed failed",
    );
    for (const [key, value] of Object.entries(process.env))
      if (value && value.length > 6 && /KEY|SECRET|TOKEN|URL/.test(key))
        message = message.split(value).join("[redacted]");
    console.error("Testnet scenario stopped:", message.slice(0, 700));
    process.exitCode = 1;
  })
  .finally(() => {
    if (lockFile && existsSync(lockFile)) unlinkSync(lockFile);
  });
