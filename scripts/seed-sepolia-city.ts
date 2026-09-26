import "./env";
import {
  chmodSync,
  existsSync,
  mkdirSync,
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
} from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { config, type ContractKey } from "../src/lib/config";
import { assetTypeCode } from "../src/lib/catalog";
import {
  cityPlan,
  cityPlanSummary,
  CITY_DATASET,
} from "../src/lib/sepolia-city-plan";
import { clients } from "../src/lib/multibaas";

// Additive testnet-only scenario. No contract migration, role changes or historical backdating.
const MAX_SPEND = parseEther("0.28");
const OWNER_RESERVE = parseEther("0.003");
let runBudget = MAX_SPEND;
const MAX_GAS_PRICE = 3_000_000_000n;
const MAX_ACTIONS = 1200;
const flag = (name: string) => {
  const i = process.argv.indexOf(name);
  if (i < 0) return undefined;
  if (!process.argv[i + 1] || process.argv[i + 1].startsWith("--"))
    throw new Error(`${name} needs a value`);
  return process.argv[i + 1];
};
const forkUrl = flag("--fork-rpc");
const fork = !!forkUrl;
const chainId = fork ? 31338 : 11155111;
const manifest = JSON.parse(readFileSync("deployments/11155111.json", "utf8"));
const rpc = createPublicClient({
  transport: http(forkUrl || process.env.NETWORK_RPC_URL, {
    timeout: 20_000,
    retryCount: 2,
  }),
});
const contractNames: Record<ContractKey, string> = {
  registry: "UrbanAssetRegistry",
  rights: "UrbanRightToken",
  market: "UrbanMarketplace",
  revenue: "RevenueVault",
  basket: "BasketVault",
  settlement: "MockJPY",
};
const abis = Object.fromEntries(
  Object.entries(contractNames).map(([key, name]) => [
    key,
    JSON.parse(readFileSync(`contracts/out/${name}.sol/${name}.json`, "utf8"))
      .abi,
  ]),
) as Record<ContractKey, Abi>;
type Action = {
  id: string;
  actor: string;
  contract?: ContractKey;
  method?: string;
  args?: unknown[];
  to?: Address;
  value?: bigint;
  output?: [string, string];
};
type Step = {
  id: string;
  actor: string;
  contract?: ContractKey;
  method?: string;
  to: Address;
  hash: Hex;
  intent: Hex;
  value: string;
  gas: string;
  gasPrice: string;
  serialized?: Hex;
  block?: string;
  blockHash?: Hex;
  gasCost?: string;
  outputId?: string;
};
type Journal = {
  chainId: number;
  registry: string;
  planHash: Hex;
  startedAt: string;
  start: number;
  actors: Record<string, Address>;
  steps: Record<string, Step>;
};
const directory = resolve(
  `.data/${fork ? "fork-" : ""}${CITY_DATASET}-${manifest.registry.toLowerCase()}`,
);
const journalFile = resolve(directory, "journal.json");
const receiptFile = fork
  ? resolve(directory, "public-receipts.json")
  : "deployments/sepolia-city-receipts.json";
const publicReport = fork
  ? resolve(directory, "verification.json")
  : "deployments/sepolia-city-verification.json";
let journal: Journal;
let locked = false;
const lock = resolve(directory, "seed.lock");
const actors: Record<string, ReturnType<typeof privateKeyToAccount>> = {};
const limit = Number(flag("--limit") || 196);
if (
  !Number.isInteger(limit) ||
  limit < 7 ||
  limit > 196 ||
  (!fork && limit !== 196)
)
  throw new Error(
    "Public scenario always adds 196 spaces; --limit is for a local fork only",
  );
const plan = cityPlan().slice(0, limit);
const hashPlan = keccak256(stringToHex(JSON.stringify(plan)));
function assert(ok: unknown, message: string): asserts ok {
  if (!ok) throw new Error(message);
}
const read = (key: ContractKey, method: string, args: unknown[] = []) =>
  rpc.readContract({
    address: manifest[key],
    abi: abis[key],
    functionName: method,
    args,
  });
const output = (id: string) => {
  const value = journal.steps[id]?.outputId;
  assert(value, `Missing confirmed output: ${id}`);
  return value;
};
const spent = () =>
  Object.values(journal.steps).reduce(
    (sum, s) =>
      sum +
      BigInt(s.value) +
      (s.gasCost ? BigInt(s.gasCost) : BigInt(s.gas) * BigInt(s.gasPrice)),
    0n,
  );
function save() {
  writeFileSync(journalFile + ".tmp", JSON.stringify(journal, null, 2) + "\n", {
    mode: 0o600,
  });
  renameSync(journalFile + ".tmp", journalFile);
  writeFileSync(
    receiptFile,
    JSON.stringify(
      {
        chainId,
        registry: manifest.registry,
        dataset: CITY_DATASET,
        locallyForked: fork,
        description:
          "Fictional assets, simulated verification, real test-chain transactions. Not organic trading or investment returns.",
        startedAt: journal.startedAt,
        updatedAt: new Date().toISOString(),
        actors: journal.actors,
        confirmedTransactions: Object.values(journal.steps).filter(
          (s) => s.block,
        ).length,
        transactions: Object.values(journal.steps)
          .filter((s) => s.block)
          .map(({ serialized: _, intent: __, ...s }) => s),
      },
      null,
      2,
    ) + "\n",
  );
}
async function confirm(step: Step, action?: Action) {
  if (step.block) return;
  let receipt;
  try {
    receipt = await rpc.getTransactionReceipt({ hash: step.hash });
  } catch {}
  if (!receipt) {
    assert(step.serialized, "Missing recovery transaction");
    try {
      await rpc.sendRawTransaction({ serializedTransaction: step.serialized });
    } catch (e) {
      try {
        await rpc.getTransaction({ hash: step.hash });
      } catch {
        throw e;
      }
    }
    receipt = await rpc.waitForTransactionReceipt({
      hash: step.hash,
      timeout: 180_000,
      pollingInterval: fork ? 100 : 1500,
    });
  }
  assert(
    receipt.status === "success",
    `Transaction reverted: ${step.id} ${step.hash}`,
  );
  if (action?.output && action.contract) {
    for (const log of receipt.logs) {
      if (log.address.toLowerCase() !== manifest[action.contract].toLowerCase())
        continue;
      try {
        const decoded = decodeEventLog({
          abi: abis[action.contract],
          data: log.data,
          topics: log.topics,
        });
        if (decoded.eventName === action.output[0])
          step.outputId = String(
            (decoded.args as unknown as Record<string, unknown>)[
              action.output[1]
            ],
          );
      } catch {}
    }
    assert(
      step.outputId && /^\d+$/.test(step.outputId),
      `Missing ${action.output[0]} result`,
    );
  }
  step.block = receipt.blockNumber.toString();
  step.blockHash = receipt.blockHash;
  step.gasCost = (receipt.gasUsed * receipt.effectiveGasPrice).toString();
  delete step.serialized;
  save();
}
async function send(action: Action) {
  const to = (
    action.contract ? manifest[action.contract] : action.to
  ) as Address;
  const data = action.contract
    ? encodeFunctionData({
        abi: abis[action.contract],
        functionName: action.method!,
        args: action.args || [],
      })
    : "0x";
  const value = action.value || 0n;
  const intent = keccak256(
    stringToHex(
      JSON.stringify({
        chainId,
        from: actors[action.actor].address,
        to,
        data,
        value: value.toString(),
      }),
    ),
  );
  const previous = journal.steps[action.id];
  if (previous) {
    assert(
      previous.intent === intent,
      `Action changed since journaling: ${action.id}`,
    );
    if (!previous.block) await confirm(previous, action);
    return;
  }
  assert(
    Object.keys(journal.steps).length < MAX_ACTIONS,
    "Transaction cap reached",
  );
  // Resolve pending nonce immediately before signing. Submission is serial even inside a batch.
  const account = actors[action.actor];
  const gas =
    ((await rpc.estimateGas({ account: account.address, to, data, value })) *
      12n) /
    10n;
  const fee = fork
    ? (await rpc.getBlock()).baseFeePerGas!
    : await rpc.getGasPrice();
  const gasPrice = (fee * 12n) / 10n + 100_000_000n;
  assert(
    gas <= 5_000_000n && gasPrice <= MAX_GAS_PRICE,
    "Gas cap reached; resume when fees are lower",
  );
  assert(
    spent() + gas * gasPrice + value <= runBudget,
    "Scenario budget reached; confirmed transactions are preserved",
  );
  const reserved = Object.values(journal.steps)
    .filter((s) => s.actor === action.actor && !s.block)
    .reduce(
      (sum, s) => sum + BigInt(s.value) + BigInt(s.gas) * BigInt(s.gasPrice),
      0n,
    );
  assert(
    (await rpc.getBalance({ address: account.address })) >=
      gas * gasPrice +
        value +
        reserved +
        (action.actor === "owner" ? OWNER_RESERVE : 0n),
    `Insufficient Sepolia ETH for ${action.actor}; resume after funding`,
  );
  const serialized = await account.signTransaction({
    chainId,
    type: "legacy",
    nonce: await rpc.getTransactionCount({
      address: account.address,
      blockTag: "pending",
    }),
    to,
    data,
    value,
    gas,
    gasPrice,
  });
  const step: Step = {
    id: action.id,
    actor: action.actor,
    contract: action.contract,
    method: action.method,
    to,
    intent,
    hash: keccak256(serialized),
    value: value.toString(),
    gas: gas.toString(),
    gasPrice: gasPrice.toString(),
    serialized,
  };
  journal.steps[action.id] = step;
  save(); // Exact hash and bounded intent persisted BEFORE the first broadcast.
  try {
    await rpc.sendRawTransaction({ serializedTransaction: serialized });
  } catch (e) {
    try {
      await rpc.getTransaction({ hash: step.hash });
    } catch {
      throw e;
    }
  }
}
async function batch(label: string, actions: Action[], size = 10) {
  for (let i = 0; i < actions.length; i += size) {
    const group = actions.slice(i, i + size);
    try {
      for (const a of group) await send(a);
    } finally {
      // Flush every signed transaction before starting the next dependent phase.
      for (const a of group)
        if (journal.steps[a.id] && !journal.steps[a.id].block)
          await confirm(journal.steps[a.id], a);
    }
    const count = Object.values(journal.steps).filter((s) => s.block).length;
    console.log(
      `${label} ${Math.min(i + size, actions.length)}/${actions.length} · ${count} confirmed · ${formatEther(spent())} test ETH incl. actor funding`,
    );
  }
}
const a = (
  id: string,
  contract: ContractKey,
  method: string,
  args: unknown[],
  actor = "owner",
  result?: [string, string],
): Action => ({ id, contract, method, args, actor, output: result });

async function ensureInvestorGas(phase: string, names: string[]) {
  for (const name of new Set(names)) {
    const id = `setup/${phase}/gas/${name}`;
    if (journal.steps[id] && !journal.steps[id].block)
      await confirm(journal.steps[id]);
    if (
      (await rpc.getBalance({ address: actors[name].address })) <
      parseEther("0.0007")
    ) {
      await batch(
        "Test investor gas",
        [
          {
            id,
            actor: "owner",
            to: actors[name].address,
            value: parseEther("0.001"),
          },
        ],
        1,
      );
    }
  }
}
const done = (id: string) => !!journal.steps[id]?.block;
const lastAction = (p: ReturnType<typeof cityPlan>[number]) =>
  `${p.key}/${p.stage === 5 ? "claim" : p.stage === 4 ? "purchase" : p.stage >= 3 ? "list" : p.stage === 2 ? "verify-asset" : p.stage === 1 ? "submit" : "register"}`;

async function verify() {
  const registered = plan.filter((p) => done(`${p.key}/register`));
  const expectedAssets = 4 + registered.length,
    expectedRights = 4 + plan.filter((p) => done(`${p.key}/issue`)).length;
  assert(
    Number(await read("registry", "nextAssetId")) - 1 === expectedAssets,
    "Asset count differs; inspect other issuers before accepting this snapshot",
  );
  assert(
    Number(await read("rights", "nextRightId")) - 1 === expectedRights,
    "Right count differs",
  );
  for (const p of registered) {
    const assetId = output(`${p.key}/register`);
    const asset = (await read("registry", "getAsset", [BigInt(assetId)])) as {
      issuer: string;
      metadataURI: string;
      status: number;
    };
    assert(
      asset.issuer.toLowerCase() === actors.owner.address.toLowerCase() &&
        asset.metadataURI === p.metadata &&
        Number(asset.status) ===
          (done(`${p.key}/verify-asset`) ? 2 : done(`${p.key}/submit`) ? 1 : 0),
      `Asset state mismatch: ${p.key}`,
    );
    if (!done(`${p.key}/issue`)) continue;
    const rightId = output(`${p.key}/issue`);
    const right = (await read("rights", "getRight", [BigInt(rightId)])) as {
      assetId: bigint;
      status: number;
    };
    assert(
      String(right.assetId) === assetId &&
        Number(right.status) ===
          (done(`${p.key}/activate`)
            ? 2
            : done(`${p.key}/verify-right`)
              ? 1
              : 0),
      `Right state mismatch: ${p.key}`,
    );
    assert(
      Number(
        await read("rights", "balanceOf", [
          actors.owner.address,
          BigInt(rightId),
        ]),
      ) ===
        p.supply - (done(`${p.key}/purchase`) ? p.subscription : 0),
      `Owner balance mismatch: ${p.key}`,
    );
    if (done(`${p.key}/purchase`))
      assert(
        Number(
          await read("rights", "balanceOf", [
            actors[p.investor].address,
            BigInt(rightId),
          ]),
        ) === p.subscription,
        `Investor balance mismatch: ${p.key}`,
      );
    if (done(`${p.key}/claim`))
      assert(
        String(
          await read("revenue", "claimable", [
            BigInt(rightId),
            actors[p.investor].address,
          ]),
        ) === "0",
        `Income not fully claimed: ${p.key}`,
      );
  }
  const steps = Object.values(journal.steps);
  const report = {
    checkedAt: new Date().toISOString(),
    chainId,
    locallyForked: fork,
    dataset: CITY_DATASET,
    assets: expectedAssets,
    rights: expectedRights,
    preservedAssets: 4,
    targetAssets: 4 + plan.length,
    completedAdditionalScenarios: plan.filter((p) => done(lastAction(p)))
      .length,
    complete: plan.every((p) => done(lastAction(p))),
    issuerRemainingETH: formatEther(
      await rpc.getBalance({ address: actors.owner.address }),
    ),
    protectedReserveETH: formatEther(OWNER_RESERVE),
    newVolumeMockJPY: plan.reduce(
      (s, p) => s + (done(`${p.key}/purchase`) ? p.price * p.subscription : 0),
      0,
    ),
    newIncomeMockJPY: plan.reduce(
      (s, p) => s + (done(`${p.key}/revenue`) ? p.deposit : 0),
      0,
    ),
    confirmedTransactions: steps.filter((s) => s.block).length,
    gasUsed: steps
      .reduce((s, p) => s + BigInt(p.gasCost || "0") / BigInt(p.gasPrice), 0n)
      .toString(),
    testETHIncludingActorFunding: formatEther(spent()),
    onchainStatesAndBalancesMatched: true,
    multiBaasIndexVerified: false,
    limitations: [
      "Fictional locations and simulated ownership verification",
      "Transactions have their actual block timestamps; no backdated activity",
      "Generated ENS names for new spaces remain previews",
    ],
  };
  writeFileSync(publicReport, JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify(report, null, 2));
}
async function main() {
  assert(flag("--env"), "Use an explicit --env .env.sepolia");
  assert(
    config.chainId === 11155111 && (await rpc.getChainId()) === chainId,
    "Unexpected chain",
  );
  if (fork) {
    const url = new URL(forkUrl!);
    assert(
      ["127.0.0.1", "localhost"].includes(url.hostname) &&
        String(await rpc.request({ method: "web3_clientVersion" }))
          .toLowerCase()
          .includes("anvil"),
      "Fork rehearsal requires a local Anvil on chain 31338",
    );
  } else
    assert(
      (await clients().chains.getChainStatus()).data.result.chainID ===
        11155111,
      "MultiBaas chain mismatch",
    );
  for (const key of Object.keys(abis) as ContractKey[])
    assert(
      config.addresses[key].toLowerCase() === manifest[key].toLowerCase(),
      `Unexpected ${key} contract`,
    );
  assert(
    process.env.PRIVATE_KEY &&
      /^0x[0-9a-f]{64}$/i.test(process.env.PRIVATE_KEY),
    "Missing local signer",
  );
  actors.owner = privateKeyToAccount(process.env.PRIVATE_KEY as Hex);
  assert(
    actors.owner.address.toLowerCase() === manifest.admin.toLowerCase(),
    "Unexpected issuer",
  );
  assert(
    String(await read("settlement", "decimals")) === "18",
    "Unexpected MockJPY decimals",
  );
  console.log(
    JSON.stringify(
      {
        ...cityPlanSummary(),
        selected: plan.length,
        chainId,
        budgetETH: formatEther(MAX_SPEND),
        ownerBalanceETH: formatEther(
          await rpc.getBalance({ address: actors.owner.address }),
        ),
      },
      null,
      2,
    ),
  );
  if (
    !process.argv.includes("--broadcast") &&
    !process.argv.includes("--verify")
  ) {
    console.log(
      "Read-only preflight. --broadcast creates/resumes; --verify checks an existing run.",
    );
    return;
  }
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  chmodSync(directory, 0o700);
  if (existsSync(lock)) {
    const pid = Number(readFileSync(lock, "utf8"));
    let alive = false;
    try {
      if (pid > 0) {
        process.kill(pid, 0);
        alive = true;
      }
    } catch {}
    assert(!alive, "Another city seed is running");
    unlinkSync(lock);
  }
  writeFileSync(lock, String(process.pid), { flag: "wx", mode: 0o600 });
  locked = true;
  const keysFile = resolve(directory, "actors.json");
  if (!existsSync(keysFile)) {
    assert(
      !process.argv.includes("--verify"),
      "No existing scenario to verify",
    );
    const previous = resolve(
      `.data/sepolia-market-${manifest.registry.toLowerCase()}/actors.env`,
    );
    const investorB = fork
      ? generatePrivateKey()
      : readFileSync(previous, "utf8").trim().split("=")[1];
    writeFileSync(
      keysFile,
      JSON.stringify({ investorB, investorC: generatePrivateKey() }),
      { mode: 0o600 },
    );
  }
  const keys = JSON.parse(readFileSync(keysFile, "utf8"));
  for (const name of ["investorB", "investorC"])
    actors[name] = privateKeyToAccount(keys[name]);
  if (fork)
    for (const account of Object.values(actors))
      await rpc.request({
        method: "anvil_setBalance" as never,
        params: [account.address, "0x56BC75E2D63100000"] as never,
      });
  if (existsSync(journalFile))
    journal = JSON.parse(readFileSync(journalFile, "utf8"));
  else {
    assert(
      Number(await read("registry", "nextAssetId")) === 5 &&
        Number(await read("rights", "nextRightId")) === 5,
      "Expected the preserved four-asset deployment",
    );
    journal = {
      chainId,
      registry: manifest.registry,
      planHash: hashPlan,
      startedAt: new Date().toISOString(),
      start: Number((await rpc.getBlock()).timestamp) - 60,
      actors: Object.fromEntries(
        Object.entries(actors).map(([n, account]) => [n, account.address]),
      ),
      steps: {},
    };
  }
  assert(
    journal.chainId === chainId &&
      journal.registry === manifest.registry &&
      journal.planHash === hashPlan,
    "Journal configuration changed",
  );
  for (const [name, account] of Object.entries(actors))
    assert(journal.actors[name] === account.address, "Signer changed");
  const last = Object.values(journal.steps)
    .filter((s) => s.block)
    .at(-1);
  if (last)
    assert(
      (await rpc.getBlock({ blockNumber: BigInt(last.block!) })).hash ===
        last.blockHash,
      "Confirmed journal block is no longer canonical",
    );
  save();
  if (process.argv.includes("--verify")) {
    await verify();
    return;
  }
  assert(
    await read("registry", "hasRole", [
      keccak256(stringToHex("VERIFIER_ROLE")),
      actors.owner.address,
    ]),
    "Verifier role required",
  );
  if (process.argv.includes("--spend-available")) {
    const balance = await rpc.getBalance({ address: actors.owner.address });
    assert(
      balance > OWNER_RESERVE,
      "Reserve protected; add test ETH before resuming",
    );
    const available = spent() + balance - OWNER_RESERVE;
    runBudget = available < MAX_SPEND ? available : MAX_SPEND;
    console.log(
      `Run budget ${formatEther(runBudget)} test ETH; issuer reserve ${formatEther(OWNER_RESERVE)} ETH.`,
    );
  }
  const setup: Action[] = [];
  const cashRequired = (investor: string) =>
    plan
      .filter((p) => p.investor === investor)
      .reduce((sum, p) => sum + p.price * p.subscription, 10000);
  for (const investor of ["investorB", "investorC"]) {
    // The valueless faucet accepts at most 1,000,000 mJPY per call.
    for (
      let remaining = cashRequired(investor), part = 0;
      remaining > 0;
      part++
    ) {
      const amount = Math.min(remaining, 1000000);
      setup.push(
        a(`setup/${investor}/cash-${part}`, "settlement", "mint", [
          actors[investor].address,
          parseEther(String(amount)),
        ]),
      );
      remaining -= amount;
    }
  }
  setup.push(
    a("setup/owner/cash", "settlement", "mint", [
      actors.owner.address,
      parseEther("100000"),
    ]),
  );
  setup.push(
    a("setup/owner/rights", "rights", "setApprovalForAll", [
      manifest.market,
      true,
    ]),
  );
  setup.push(
    a("setup/owner/revenue", "settlement", "approve", [
      manifest.revenue,
      parseEther("100000"),
    ]),
  );
  await batch("Setup", setup, 4);
  await ensureInvestorGas(
    "initial",
    ["investorB", "investorC"].filter(
      (n) => !journal.steps[`setup/${n}/approve`]?.block,
    ),
  );
  await batch(
    "Investor approvals",
    ["investorB", "investorC"].map((n) =>
      a(
        `setup/${n}/approve`,
        "settlement",
        "approve",
        [manifest.market, parseEther(String(cashRequired(n)))],
        n,
      ),
    ),
  );
  for (let offset = 0; offset < plan.length; offset += 7) {
    const wave = plan.slice(offset, offset + 7);
    await batch(
      "Register spaces",
      wave.map((p) =>
        a(
          `${p.key}/register`,
          "registry",
          "registerAsset",
          [
            keccak256(stringToHex(`${CITY_DATASET}:${p.key}`)),
            p.metadata,
            assetTypeCode(p.kind),
          ],
          "owner",
          ["AssetRegistered", "assetId"],
        ),
      ),
    );
    await batch(
      "Request review",
      wave
        .filter((p) => p.stage >= 1)
        .map((p) =>
          a(`${p.key}/submit`, "registry", "requestVerification", [
            output(`${p.key}/register`),
          ]),
        ),
    );
    await batch(
      "Verify spaces",
      wave
        .filter((p) => p.stage >= 2)
        .map((p) =>
          a(`${p.key}/verify-asset`, "registry", "verifyAsset", [
            output(`${p.key}/register`),
            true,
          ]),
        ),
    );
    const issued = wave.filter((p) => p.stage >= 3);
    await batch(
      "Issue rights",
      issued.map((p) =>
        a(
          `${p.key}/issue`,
          "rights",
          "createScopedRight",
          [
            [
              output(`${p.key}/register`),
              p.revenue ? 1 : 0,
              String(p.supply),
              p.terms,
              keccak256(stringToHex(p.terms)),
              journal.start,
              journal.start + 365 * 86400,
              0,
              p.scope,
              keccak256(stringToHex(p.purpose)),
              !p.revenue,
            ],
          ],
          "owner",
          ["RightCreated", "rightId"],
        ),
      ),
      5,
    );
    await batch(
      "Verify rights",
      issued.map((p) =>
        a(`${p.key}/verify-right`, "rights", "verifyRight", [
          output(`${p.key}/issue`),
          true,
        ]),
      ),
    );
    await batch(
      "Open listings",
      issued.map((p) =>
        a(
          `${p.key}/list`,
          "market",
          "createListing",
          [
            manifest.rights,
            output(`${p.key}/issue`),
            String(p.supply),
            parseEther(String(p.price)),
          ],
          "owner",
          ["ListingCreated", "listingId"],
        ),
      ),
    );
    await ensureInvestorGas(
      `wave-${offset}`,
      issued
        .filter(
          (p) =>
            p.subscription > 0 &&
            (!journal.steps[`${p.key}/purchase`]?.block ||
              (p.deposit > 0 && !journal.steps[`${p.key}/claim`]?.block)),
        )
        .map((p) => p.investor),
    );
    await batch(
      "Fund projects",
      issued
        .filter((p) => p.subscription > 0)
        .map((p) =>
          a(
            `${p.key}/purchase`,
            "market",
            "purchase",
            [output(`${p.key}/list`), String(p.subscription)],
            p.investor,
          ),
        ),
      3,
    );
    await batch(
      "Activate operations",
      issued
        .filter((p) => p.stage === 5)
        .map((p) =>
          a(`${p.key}/activate`, "rights", "activateRight", [
            output(`${p.key}/issue`),
          ]),
        ),
    );
    await batch(
      "Deposit income",
      issued
        .filter((p) => p.deposit > 0)
        .map((p) =>
          a(`${p.key}/revenue`, "revenue", "depositRevenue", [
            output(`${p.key}/issue`),
            parseEther(String(p.deposit)),
          ]),
        ),
      6,
    );
    await batch(
      "Receive income",
      issued
        .filter((p) => p.deposit > 0)
        .map((p) =>
          a(
            `${p.key}/claim`,
            "revenue",
            "claim",
            [output(`${p.key}/issue`)],
            p.investor,
          ),
        ),
      6,
    );
  }
  await verify();
}
main()
  .catch(async (e) => {
    let message = String(
      e.response?.data?.message ||
        e.shortMessage ||
        e.message ||
        "Scenario failed",
    );
    for (const [key, value] of Object.entries(process.env))
      if (value && value.length > 6 && /KEY|SECRET|TOKEN|URL/.test(key))
        message = message.split(value).join("[redacted]");
    console.error(
      "City scenario stopped:",
      message.replace(/https?:\/\/\S+/g, "[URL]").slice(0, 500),
    );
    process.exitCode = 1;
    if (journal && !Object.values(journal.steps).some((s) => !s.block)) {
      try {
        await verify();
      } catch {
        console.error(
          "Partial state verification could not finish; rerun --verify.",
        );
      }
    }
  })
  .finally(() => {
    if (locked && existsSync(lock)) unlinkSync(lock);
  });
