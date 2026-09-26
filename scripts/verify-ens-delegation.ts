import { loadEnvFile } from "node:process";
import {
  readFileSync,
  writeFileSync,
  existsSync,
  renameSync,
  openSync,
  closeSync,
  unlinkSync,
} from "node:fs";
import { dirname, resolve } from "node:path";
import {
  createPublicClient,
  createWalletClient,
  http,
  keccak256,
  encodeFunctionData,
  stringToHex,
  parseEther,
  decodeEventLog,
  type Abi,
  type Hex,
  type Address,
} from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { sepolia } from "viem/chains";
import {
  authorityAbi,
  bindingId,
  eacAbi,
  delegatedRightsAbi,
} from "../src/lib/ens/authority";
import { ensPreflight } from "./ens-preflight";

let proofLock: string | undefined;
async function main() {
  const index = process.argv.indexOf("--env");
  if (index < 0) throw new Error("Pass --env .env.sepolia");
  loadEnvFile(process.argv[index + 1]);
  if (!process.argv.includes("--broadcast"))
    throw new Error(
      "This bounded test requires --broadcast; sends only Sepolia test transactions",
    );
  const file =
    process.env.ENSV2_DEPLOYMENT_FILE ||
    resolve(
      process.env.ENSV2_JOURNAL_DIR || ".data/ens-sepolia",
      "deployment.json",
    );
  const d = JSON.parse(readFileSync(file, "utf8"));
  if (d.chainId !== 11155111) throw new Error("Sepolia manifest required");
  const rpc = process.env.ENSV2_RPC_URL!;
  await ensPreflight(rpc);
  const owner = privateKeyToAccount(
    process.env.ENSV2_DEPLOYER_PRIVATE_KEY as Hex,
  );
  if (owner.address.toLowerCase() !== d.admin.toLowerCase())
    throw new Error("Issuer mismatch");
  const c = createPublicClient({
    chain: sepolia,
    transport: http(rpc, { timeout: 20000, retryCount: 2 }),
  });
  const jfile = resolve(dirname(file), "delegation-proof.private.json");
  const lock = resolve(dirname(file), "delegation-proof.lock");
  closeSync(openSync(lock, "wx", 0o600));
  proofLock = lock;
  type ProofJournal = {
    key: Hex;
    start: number;
    end: number;
    steps: Record<string, { hash: Hex; serialized: Hex }>;
    rejected: string[];
  };
  const j: ProofJournal = existsSync(jfile)
    ? JSON.parse(readFileSync(jfile, "utf8"))
    : {
        key: generatePrivateKey(),
        start: Number((await c.getBlock()).timestamp),
        end: Number((await c.getBlock()).timestamp) + 86400,
        steps: {},
        rejected: [],
      };
  const save = () => {
    writeFileSync(jfile + ".tmp", JSON.stringify(j, null, 2), { mode: 0o600 });
    renameSync(jfile + ".tmp", jfile);
  };
  save();
  const operator = privateKeyToAccount(j.key);
  const send = async (
    key: string,
    who: typeof owner,
    to: Address,
    data: Hex,
    value = 0n,
  ) => {
    if (!j.steps[key]) {
      const w = createWalletClient({
        account: who,
        chain: sepolia,
        transport: http(rpc, { timeout: 20000, retryCount: 2 }),
      });
      const req = await c.prepareTransactionRequest({
        account: who,
        to,
        data,
        value,
      });
      if (
        (req.maxFeePerGas ?? 0n) > 20_000_000_000n ||
        (req.gas ?? 0n) * (req.maxFeePerGas ?? 0n) + value > parseEther("0.01")
      )
        throw new Error("Test cost ceiling exceeded");
      const serialized = await w.signTransaction(req);
      j.steps[key] = { hash: keccak256(serialized), serialized };
      save();
    }
    const s = j.steps[key];
    let receipt = await c
      .getTransactionReceipt({ hash: s.hash })
      .catch(() => null);
    if (!receipt) {
      const pending = await c
        .getTransaction({ hash: s.hash })
        .catch(() => null);
      if (!pending)
        await c.sendRawTransaction({ serializedTransaction: s.serialized });
      receipt = await c.waitForTransactionReceipt({
        hash: s.hash,
        timeout: 180000,
      });
    }
    if (receipt.status !== "success")
      throw new Error(`Reverted proof step ${key}`);
    console.log(`${key}: ${s.hash}`);
    return receipt;
  };
  const call = async (
    key: string,
    who: typeof owner,
    to: Address,
    abi: Abi,
    method: string,
    args: unknown[],
  ) =>
    send(key, who, to, encodeFunctionData({ abi, functionName: method, args }));
  const id = bindingId("1", 0),
    role = 1n << 24n,
    label = BigInt(keccak256(stringToHex("rooftop")));
  const limits = {
    purpose: keccak256(stringToHex("SOLAR")),
    kind: 1,
    policy: 0,
    exclusive: false,
    minStart: j.start,
    maxEnd: j.end,
    validUntil: j.end,
    maxSupply: 100n,
  };
  const terms = "data:application/json,%7B%22demo%22%3Atrue%7D";
  const q = {
    assetId: 1n,
    kind: 1,
    supply: 10n,
    terms,
    termsHash: keccak256(stringToHex(terms)),
    start: BigInt(j.start),
    end: BigInt(j.end),
    policy: 0,
    scope: 0,
    purpose: limits.purpose,
    exclusive: false,
  };
  await send(
    "fund-operator",
    owner,
    operator.address,
    "0x",
    parseEther("0.001"),
  );
  await call("grant-ens", owner, d.building, eacAbi, "grantRoles", [
    label,
    role,
    operator.address,
  ]);
  await call(
    "grant-issuance",
    owner,
    d.authority,
    authorityAbi,
    "grantIssuance",
    [id, operator.address, limits],
  );
  const reject = async (key: string, request: typeof q) => {
    // Negative eth_call simulations do not spend gas. Require a decoded on-chain revert,
    // never count an RPC outage as proof that authorization was denied.
    let denied = false;
    try {
      await c.simulateContract({
        account: operator,
        address: d.rights,
        abi: delegatedRightsAbi,
        functionName: "createScopedRightForIssuer",
        args: [request],
      });
    } catch (e) {
      let cause: unknown = e;
      for (let i = 0; i < 8 && cause; i++) {
        if (
          (cause as { name?: string }).name === "ContractFunctionRevertedError"
        )
          denied = true;
        cause = (cause as { cause?: unknown }).cause;
      }
    }
    if (!denied) throw new Error(`Missing decoded rejection for ${key}`);
    if (!j.rejected.includes(key)) j.rejected.push(key);
    save();
  };
  if (!j.steps["revoke-ens"]) {
    await reject("interior-denied", { ...q, scope: 1 });
    await reject("other-asset-denied", { ...q, assetId: 2n });
  }
  // Public Sepolia base fees can exceed the fork's fees. Reserve enough test ETH
  // for the full registry-path validation, while retaining the per-tx cost cap.
  if (
    !j.steps["issue-rooftop"] &&
    (await c.getBalance({ address: operator.address })) < parseEther("0.003")
  ) {
    await send(
      "fund-operator-gas-buffer",
      owner,
      operator.address,
      "0x",
      parseEther("0.003"),
    );
  }
  const receipt = await call(
    "issue-rooftop",
    operator,
    d.rights,
    delegatedRightsAbi,
    "createScopedRightForIssuer",
    [q],
  );
  const rightsABI = JSON.parse(
    readFileSync(
      "contracts/out/UrbanRightToken.sol/UrbanRightToken.json",
      "utf8",
    ),
  ).abi as Abi;
  const created = receipt.logs
    .map((log) => {
      try {
        return decodeEventLog({
          abi: rightsABI,
          data: log.data,
          topics: log.topics,
        });
      } catch {
        return null;
      }
    })
    .find((log) => log?.eventName === "DelegatedRightCreated");
  const rightId = (created?.args as { rightId?: bigint })?.rightId;
  if (!rightId) throw new Error("Missing delegated issuance event");
  const balance = await c.readContract({
    address: d.rights,
    abi: rightsABI,
    functionName: "balanceOf",
    args: [owner.address, rightId],
  });
  if (balance !== 10n) throw new Error("Rights did not arrive at the issuer");
  await call("revoke-ens", owner, d.building, eacAbi, "revokeRoles", [
    label,
    role,
    operator.address,
  ]);
  await reject("revoked-ens-denied", q);
  await call(
    "revoke-issuance",
    owner,
    d.authority,
    authorityAbi,
    "revokeIssuance",
    [id, operator.address],
  );
  const proof = {
    network: d.ens.locallyForked ? "local Sepolia fork" : "public Sepolia",
    chainId: 11155111,
    checkedAt: new Date().toISOString(),
    parent: d.ens.parent,
    name: d.ens.name,
    rights: d.rights,
    authority: d.authority,
    issuer: owner.address,
    operator: operator.address,
    rightId: rightId.toString(),
    issuerBalance: balance.toString(),
    rightStatus: "Pending verification",
    permissionsAfterTest: "revoked",
    negativeChecks: j.rejected,
    transactions: Object.fromEntries(
      Object.entries(j.steps).map(([key, s]) => [key, s.hash]),
    ),
  };
  const output = resolve(dirname(file), "delegation-proof.json");
  writeFileSync(output, JSON.stringify(proof, null, 2) + "\n");
  console.log(`Delegation proof saved: ${output}`);
}
main()
  .catch((e) => {
    let cause: unknown = e;
    const kinds: string[] = [];
    for (let i = 0; i < 8 && cause; i++) {
      const error = cause as {
        name?: string;
        data?: { errorName?: string };
        cause?: unknown;
      };
      if (error.name && /^[A-Za-z0-9_]+$/.test(error.name))
        kinds.push(error.name);
      if (error.data?.errorName && /^[A-Za-z0-9_]+$/.test(error.data.errorName))
        kinds.push(error.data.errorName);
      cause = error.cause;
    }
    if (kinds.length) console.error(`Failure category: ${kinds.join(" / ")}`);
    console.error(
      e instanceof Error && e.constructor === Error
        ? e.message
        : "ENS delegation verification interrupted; resume using the same private journal.",
    );
    process.exitCode = 1;
  })
  .finally(() => {
    if (proofLock) unlinkSync(proofLock);
  });
