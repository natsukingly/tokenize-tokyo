// Isolated Anvil lifecycle; no public funds, private keys or public transactions.
import { spawn, execFileSync } from "node:child_process";
import { createServer } from "node:net";
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import {
  createPublicClient,
  createWalletClient,
  http,
  parseEther,
  keccak256,
  stringToHex,
  toFunctionSelector,
  type Address,
  type Hex,
} from "viem";
import { sepolia } from "viem/chains";
import { ContractsApi, ChainsApi } from "@curvegrid/multibaas-sdk";

execFileSync("forge", ["build", "--root", "contracts", "--quiet"], {
  stdio: "inherit",
});
const socket = createServer();
await new Promise<void>((resolve) => socket.listen(0, "127.0.0.1", resolve));
const port = (socket.address() as { port: number }).port;
await new Promise<void>((resolve) => socket.close(() => resolve()));
const anvil = spawn(
  "anvil",
  [
    "--host",
    "127.0.0.1",
    "--port",
    String(port),
    "--chain-id",
    "11155111",
    "--silent",
  ],
  { stdio: "ignore" },
);
const url = `http://127.0.0.1:${port}`;
try {
  const rpc = createPublicClient({
    chain: sepolia,
    transport: http(url),
    pollingInterval: 50,
  });
  const wallet = createWalletClient({ chain: sepolia, transport: http(url) });
  for (let attempt = 0; ; attempt++) {
    try {
      await rpc.getChainId();
      break;
    } catch {
      if (attempt === 30) throw new Error("Anvil unavailable");
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
  const [owner, buyer] = await wallet.getAddresses();
  const addresses: Record<string, Address> = {};
  const artifacts: Record<string, any> = {};
  const names = {
    registry: "UrbanAssetRegistry",
    settlement: "MockJPY",
    rights: "UrbanRightToken",
    revenue: "RevenueVault",
    basket: "BasketVault",
    market: "UrbanMarketplace",
  };
  async function deploy(key: keyof typeof names, args: unknown[]) {
    const name = names[key];
    const artifact = JSON.parse(
      readFileSync(`contracts/out/${name}.sol/${name}.json`, "utf8"),
    );
    artifacts[key] = artifact;
    const hash = await wallet.deployContract({
      account: owner,
      abi: artifact.abi,
      bytecode: artifact.bytecode.object,
      args,
    });
    const receipt = await rpc.waitForTransactionReceipt({ hash });
    assert.equal(receipt.status, "success");
    addresses[key] = receipt.contractAddress!;
  }
  await deploy("registry", [owner]);
  await deploy("settlement", []);
  await deploy("rights", [addresses.registry, addresses.settlement]);
  await deploy("revenue", [addresses.rights]);
  const setup = await wallet.writeContract({
    account: owner,
    address: addresses.rights,
    abi: artifacts.rights.abi,
    functionName: "setRevenueVault",
    args: [addresses.revenue],
  });
  assert.equal(
    (await rpc.waitForTransactionReceipt({ hash: setup })).status,
    "success",
  );
  await deploy("basket", [addresses.rights, addresses.revenue]);
  await deploy("market", [
    addresses.rights,
    addresses.basket,
    addresses.settlement,
  ]);
  process.env.NEXT_PUBLIC_CHAIN_ID = "11155111";
  process.env.NEXT_PUBLIC_RPC_URL = url;
  process.env.NEXT_PUBLIC_MULTIBAAS_URL = "https://quota-test.invalid";
  process.env.NEXT_PUBLIC_MULTIBAAS_DAPP_KEY = "test-only";
  for (const [name, address] of Object.entries(addresses))
    process.env[`NEXT_PUBLIC_${name.toUpperCase()}_ADDRESS`] = address;
  let sdkCalls = 0,
    submissions = 0;
  const unavailable = async () => {
    sdkCalls++;
    throw { response: { status: 429 } };
  };
  ContractsApi.prototype.callContractFunction = unavailable;
  ChainsApi.prototype.getTransactionReceipt = unavailable;
  const { sendViaMultiBaas } = await import("../src/lib/multibaas");
  const { coreWriteAbis } = await import("../src/lib/core-transactions");
  let checkedSelectors = 0;
  for (const [key, abi] of Object.entries(coreWriteAbis))
    for (const item of abi)
      if (item.type === "function") {
        assert(
          Object.values(artifacts[key].methodIdentifiers).includes(
            toFunctionSelector(item).slice(2),
          ),
          `ABI mismatch: ${key}.${item.name}`,
        );
        checkedSelectors++;
      }
  const provider = (account: Address) => ({
    request: async ({
      method,
      params,
    }: {
      method: string;
      params?: unknown[];
    }) => {
      if (method === "eth_accounts") return [account];
      if (method === "eth_chainId") return "0xaa36a7";
      if (method !== "eth_sendTransaction")
        throw new Error(`Unexpected request: ${method}`);
      const tx = params![0] as {
        from: Address;
        to: Address;
        data: Hex;
        value: string;
      };
      assert.equal(tx.from, account);
      assert.equal(BigInt(tx.value), 0n);
      const call = { account, to: tx.to, data: tx.data, value: 0n };
      const gas = await rpc.estimateGas(call);
      submissions++;
      return wallet.sendTransaction({ ...call, gas: (gas * 12n) / 10n });
    },
  });
  const send = (
    account: Address,
    contract: keyof typeof names,
    method: string,
    args: unknown[],
  ) => sendViaMultiBaas(provider(account), account, contract, method, args);
  const read = (
    contract: keyof typeof names,
    functionName: string,
    args: unknown[],
  ) =>
    rpc.readContract({
      address: addresses[contract],
      abi: artifacts[contract].abi,
      functionName,
      args,
    });
  const now = (await rpc.getBlock()).timestamp;
  await send(owner, "registry", "registerAsset", [
    keccak256(stringToHex("isolated roof")),
    "data:application/json,%7B%7D",
    0,
  ]);
  await send(owner, "registry", "requestVerification", ["1"]);
  await send(owner, "registry", "verifyAsset", ["1", true]);
  await send(owner, "rights", "createScopedRight", [
    [
      "1",
      1,
      "100",
      "Test terms",
      keccak256(stringToHex("terms")),
      String(now),
      String(now + 86400n),
      0,
      0,
      keccak256(stringToHex("SOLAR")),
      false,
    ],
  ]);
  await send(owner, "rights", "verifyRight", ["1", true]);
  await send(owner, "rights", "activateRight", ["1"]);
  await send(owner, "rights", "setApprovalForAll", [addresses.market, true]);
  await send(owner, "market", "createListing", [
    addresses.rights,
    "1",
    "10",
    String(parseEther("5")),
  ]);
  await send(buyer, "settlement", "mint", [buyer, String(parseEther("100"))]);
  await send(buyer, "settlement", "approve", [
    addresses.market,
    String(parseEther("10")),
  ]);
  await send(buyer, "market", "purchase", ["1", "2"]);
  assert.equal(await read("rights", "balanceOf", [buyer, 1n]), 2n);
  assert.equal(
    await read("settlement", "balanceOf", [buyer]),
    parseEther("90"),
  );
  assert.equal(
    await read("settlement", "allowance", [buyer, addresses.market]),
    0n,
  );
  await send(owner, "settlement", "mint", [owner, String(parseEther("100"))]);
  await send(owner, "settlement", "approve", [
    addresses.revenue,
    String(parseEther("100")),
  ]);
  await send(owner, "revenue", "depositRevenue", [
    "1",
    String(parseEther("100")),
  ]);
  await send(buyer, "revenue", "claim", ["1"]);
  assert.equal(
    await read("settlement", "balanceOf", [buyer]),
    parseEther("92"),
  );
  await send(owner, "rights", "createRight", [
    "1",
    1,
    "100",
    "Test terms",
    keccak256(stringToHex("terms")),
    String(now),
    String(now + 86400n),
    0,
  ]);
  await send(owner, "rights", "verifyRight", ["2", true]);
  await send(owner, "rights", "activateRight", ["2"]);
  await send(owner, "basket", "createBasket", [
    ["1", "2"],
    ["1", "1"],
    "Test basket",
  ]);
  await send(owner, "rights", "setApprovalForAll", [addresses.basket, true]);
  await send(owner, "basket", "depositUnderlying", ["1", "2"]);
  await send(owner, "basket", "redeem", ["1", "1"]);
  assert.equal(await read("basket", "balanceOf", [owner, 1n]), 1n);
  const before = submissions;
  await assert.rejects(send(buyer, "registry", "verifyAsset", ["1", true]));
  assert.equal(
    submissions,
    before,
    "Unauthorized action must fail before wallet submission",
  );
  assert.equal(sdkCalls, 0);
  console.log(
    JSON.stringify(
      {
        ok: true,
        chain: "isolated Anvil",
        checkedSelectors,
        submissions,
        sdkCalls,
        flows: [
          "register",
          "verify",
          "issue scoped right",
          "activate",
          "list",
          "exact approval",
          "purchase",
          "deposit revenue",
          "claim",
          "basket deposit",
          "redeem",
          "unauthorized preflight rejection",
        ],
      },
      null,
      2,
    ),
  );
} finally {
  anvil.kill("SIGTERM");
}
