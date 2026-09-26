import "./env";
import {
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import {
  createPublicClient,
  createWalletClient,
  encodeFunctionData,
  http,
  keccak256,
  parseEther,
  parseTransaction,
  type Address,
  type Hex,
  type TransactionReceipt,
} from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { sepolia } from "viem/chains";
import { loadEnsBinding } from "../src/lib/ens/authority";
import {
  checkReporter,
  loadReport,
  reportCall,
  reporterGrantCall,
  reporterRevokeCall,
  REPORT_KEY,
} from "../src/lib/ens/reports";
import { permissionedResolverAbi } from "../src/lib/ens/resolver-abi";
import { clients } from "../src/lib/multibaas";
import { positionalArguments } from "../src/lib/ens/call";

const directory = ".data/ens-reports";
let locked = false;
async function main() {
  const live = await loadEnsBinding();
  const report = await loadReport(live);
  const rpc = process.env.ENSV2_RPC_URL || process.env.NEXT_PUBLIC_RPC_URL;
  if (!rpc) throw new Error("Sepolia RPC required");
  const client = createPublicClient({
    chain: sepolia,
    transport: http(rpc, { timeout: 15000, retryCount: 1 }),
  });
  if ((await client.getChainId()) !== 11155111) throw new Error("Sepolia only");
  console.log(
    JSON.stringify({
      name: live.name,
      resolver: report.resolver,
      reportKey: REPORT_KEY,
      block: report.blockNumber.toString(),
      broadcast: process.argv.includes("--broadcast"),
    }),
  );
  if (!process.argv.includes("--broadcast")) return;
  const owner = privateKeyToAccount(
    process.env.ENSV2_DEPLOYER_PRIVATE_KEY as Hex,
  );
  if (owner.address.toLowerCase() !== live.binding.issuer.toLowerCase())
    throw new Error("Issuer key required");
  mkdirSync(directory, { recursive: true });
  closeSync(openSync(`${directory}/proof.lock`, "wx", 0o600));
  locked = true;
  const file = `${directory}/proof.private.json`;
  type Journal = {
    key: Hex;
    resolver: Address;
    name: string;
    period: string;
    steps: Record<string, { hash: Hex; serialized: Hex; cost: string }>;
    checks: unknown[];
    superseded?: { step: string; hash: Hex; nonce: number }[];
  };
  const journal: Journal = existsSync(file)
    ? JSON.parse(readFileSync(file, "utf8"))
    : {
        key: generatePrivateKey(),
        resolver: report.resolver,
        name: live.name,
        period: new Date().toISOString().slice(0, 7),
        steps: {},
        checks: [],
      };
  if (journal.resolver !== report.resolver || journal.name !== live.name)
    throw new Error("Journal deployment mismatch");
  const save = () => {
    writeFileSync(file + ".tmp", JSON.stringify(journal, null, 2), {
      mode: 0o600,
    });
    renameSync(file + ".tmp", file);
  };
  save();
  const reporter = privateKeyToAccount(journal.key);
  const send = async (
    step: string,
    account: typeof owner,
    to: Address,
    data: Hex,
    value = 0n,
    attempt = 0,
  ): Promise<TransactionReceipt> => {
    if (attempt > 4)
      throw new Error(
        "Issuer nonce is busy; resume after other transactions finish.",
      );
    if (!journal.steps[step]) {
      const request = await client.prepareTransactionRequest({
        account,
        to,
        data,
        value,
      });
      const cost = (request.gas ?? 0n) * (request.maxFeePerGas ?? 0n) + value;
      const total =
        Object.values(journal.steps).reduce(
          (sum, s) => sum + BigInt(s.cost),
          0n,
        ) + cost;
      if (
        total > parseEther("0.003") ||
        (request.maxFeePerGas ?? 0n) > 20_000_000_000n
      )
        throw new Error("Test budget exceeded");
      const wallet = createWalletClient({
        account,
        chain: sepolia,
        transport: http(rpc),
      });
      const serialized = await wallet.signTransaction(request);
      journal.steps[step] = {
        hash: keccak256(serialized),
        serialized,
        cost: cost.toString(),
      };
      save();
    }
    const saved = journal.steps[step];
    let receipt = await client
      .getTransactionReceipt({ hash: saved.hash })
      .catch(() => null);
    const nonce = parseTransaction(saved.serialized).nonce!;
    for (let poll = 0; !receipt && poll < 20; poll++) {
      // Another setup process may have consumed this nonce. Re-read our exact
      // receipt first; never accept a replacement transaction as this action.
      if (
        (await client.getTransactionCount({
          address: account.address,
          blockTag: "latest",
        })) > nonce
      ) {
        receipt = await client
          .getTransactionReceipt({ hash: saved.hash })
          .catch(() => null);
        if (receipt) break;
        journal.superseded ??= [];
        journal.superseded.push({ step, hash: saved.hash, nonce });
        delete journal.steps[step];
        save();
        return send(step, account, to, data, value, attempt + 1);
      }
      const pending = await client
        .getTransaction({ hash: saved.hash })
        .catch(() => null);
      if (!pending) {
        // A different confirmed transaction consumed this nonce. The old signed
        // intent cannot execute now; preserve it and prepare the same bounded call.
        if (
          (await client.getTransactionCount({
            address: account.address,
            blockTag: "latest",
          })) > nonce
        ) {
          journal.superseded ??= [];
          journal.superseded.push({ step, hash: saved.hash, nonce });
          delete journal.steps[step];
          save();
          return send(step, account, to, data, value, attempt + 1);
        }
        await client.sendRawTransaction({
          serializedTransaction: saved.serialized,
        });
      }
      await new Promise((resolve) => setTimeout(resolve, 2000));
      receipt = await client
        .getTransactionReceipt({ hash: saved.hash })
        .catch(() => null);
    }
    if (!receipt)
      throw new Error("Transaction is pending; resume using the same journal.");
    if (receipt.status !== "success") throw new Error(`Reverted ${step}`);
    console.log(`${step}: ${saved.hash}`);
    return receipt;
  };
  const encode = (
    call:
      | ReturnType<typeof reportCall>
      | ReturnType<typeof reporterGrantCall>
      | ReturnType<typeof reporterRevokeCall>,
  ) => encodeFunctionData({ abi: permissionedResolverAbi, ...call });
  await send(
    "fund-reporter",
    owner,
    reporter.address,
    "0x",
    parseEther("0.00015"),
  );
  const grantReceipt = await send(
    "grant-report-key",
    owner,
    report.resolver,
    encode(reporterGrantCall(live.name, reporter.address)),
  );
  if (!journal.steps["revoke-report-key"]) {
    const before = await checkReporter(
      live,
      report.resolver,
      reporter.address,
      grantReceipt.blockNumber,
    );
    if (
      before.checks[0].result !== "allowed" ||
      before.checks.slice(1).some((c) => c.result !== "denied")
    )
      throw new Error("Scoped permission check failed");
    journal.checks.push({
      phase: "granted",
      ...before,
      blockNumber: before.blockNumber.toString(),
    });
    save();
  }
  const update = reportCall(live.name, journal.period, "125.50");
  // The RPC estimator caps the available execution gas by the sender balance.
  // Cover the observed testnet fee increase while staying inside the total cap.
  if (
    !journal.steps["write-energy-report"] &&
    (await client.getBalance({ address: reporter.address })) <
      parseEther("0.0005")
  )
    await send(
      "fund-reporter-buffer",
      owner,
      reporter.address,
      "0x",
      parseEther("0.00045"),
    );
  if (!journal.steps["write-energy-report"]) {
    const response = (
      await clients().contracts.callContractFunction(
        report.resolver,
        "enspermissionedresolver",
        "setText",
        {
          from: reporter.address,
          args: positionalArguments(permissionedResolverAbi, "setText", [
            ...update.args,
          ]),
          signAndSubmit: false,
        },
      )
    ).data.result;
    if (
      response.kind !== "TransactionToSignResponse" ||
      response.submitted ||
      response.tx.data.toLowerCase() !== encode(update).toLowerCase()
    )
      throw new Error("MultiBaas unsigned calldata mismatch");
    console.log("MultiBaas report calldata verified; no server signature.");
  }
  const writeReceipt = await send(
    "write-energy-report",
    reporter,
    report.resolver,
    encode(update),
  );
  const readback = await loadReport(live, writeReceipt.blockNumber);
  if (readback.value !== update.args[2])
    throw new Error("Universal Resolver readback mismatch");
  const revokeReceipt = await send(
    "revoke-report-key",
    owner,
    report.resolver,
    encode(reporterRevokeCall(reporter.address)),
  );
  const after = await checkReporter(
    live,
    report.resolver,
    reporter.address,
    revokeReceipt.blockNumber,
  );
  if (after.checks.some((c) => c.result !== "denied"))
    throw new Error("Revocation check failed");
  journal.checks.push({
    phase: "revoked",
    ...after,
    blockNumber: after.blockNumber.toString(),
  });
  save();
  const evidence = {
    chainId: 11155111,
    checkedAt: new Date().toISOString(),
    name: live.name,
    resolver: report.resolver,
    reporter: reporter.address,
    issuer: owner.address,
    reportKey: REPORT_KEY,
    value: readback.value,
    permissionsAfterTest: "revoked",
    checks: journal.checks,
    transactions: Object.fromEntries(
      Object.entries(journal.steps).map(([k, v]) => [k, v.hash]),
    ),
  };
  writeFileSync(
    "deployments/ens-v2-sepolia-report-proof.json",
    JSON.stringify(evidence, null, 2) + "\n",
  );
  console.log(
    "Verified scoped report, protected-record denials and revocation; public evidence saved.",
  );
}
main()
  .catch((error) => {
    if (error?.response)
      console.error(
        "MultiBaas response",
        error.response.status,
        String(
          error.response.data?.message ||
            error.response.data?.error ||
            "Request rejected",
        ).slice(0, 240),
      );
    console.error(
      "ENS reporting verification stopped.",
      error instanceof Error && error.constructor === Error
        ? error.message
        : String(error?.shortMessage || error?.name || "Unknown failure"),
    );
    if (error?.details)
      console.error(
        String(error.details)
          .replace(/https?:\/\/\S+/g, "[RPC]")
          .slice(0, 300),
      );
    process.exitCode = 1;
  })
  .finally(() => {
    if (locked) unlinkSync(`${directory}/proof.lock`);
  });
