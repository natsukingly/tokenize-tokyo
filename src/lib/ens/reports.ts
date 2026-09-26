import {
  BaseError,
  ContractFunctionRevertedError,
  decodeFunctionResult,
  encodeFunctionData,
  getAddress,
  keccak256,
  namehash,
  parseAbi,
  stringToHex,
  toHex,
  zeroAddress,
  type Address,
} from "viem";
import { packetToBytes } from "viem/ens";
import { ensClient, type LiveEnsBinding } from "./authority";
import { ENSV2_DEPLOYMENT } from "./deployment";
import { ensRegistryAbi } from "./registry";
import { permissionedResolverAbi } from "./resolver-abi";

export const REPORT_KEY = "urban.energyReport";
export const REPORT_ROLE = 1n << 4n;
const textAbi = parseAbi([
  "function text(bytes32 node,string key) view returns(string)",
]);
const universalAbi = parseAbi([
  "function resolve(bytes name,bytes data) view returns(bytes,address)",
]);
const factoryAbi = parseAbi([
  "function verifyContract(address candidate) view returns(address)",
]);

export function reportValue(period: string, energyKWh: string) {
  if (
    !/^20\d{2}-(0[1-9]|1[0-2])$/.test(period) ||
    !/^(0|[1-9]\d{0,8})(\.\d{1,3})?$/.test(energyKWh)
  )
    throw new Error(
      "Enter a reporting month (YYYY-MM) and a non-negative kWh reading with up to three decimals.",
    );
  return JSON.stringify({
    period,
    energyKWh,
    source: "operator-reported test data",
  });
}
function reporterAddress(address: string) {
  const value = getAddress(address);
  if (value === zeroAddress)
    throw new Error("Choose a non-zero reporter address.");
  return value;
}
export function reportCall(name: string, period: string, energyKWh: string) {
  return {
    functionName: "setText",
    args: [
      toHex(packetToBytes(name)),
      REPORT_KEY,
      reportValue(period, energyKWh),
    ],
  } as const;
}
export function reporterGrantCall(name: string, reporter: string) {
  return {
    functionName: "grantSetterRoles",
    args: [
      encodeFunctionData({
        abi: permissionedResolverAbi,
        functionName: "setText",
        args: [toHex(packetToBytes(name)), REPORT_KEY, ""],
      }),
      reporterAddress(reporter),
    ],
  } as const;
}
export function reporterRevokeCall(reporter: string) {
  return {
    functionName: "revokeRoles",
    args: [
      BigInt(keccak256(stringToHex(REPORT_KEY))),
      REPORT_ROLE,
      reporterAddress(reporter),
    ],
  } as const;
}

/** Only a decoded EAC denial is evidence; RPC failures and unrelated reverts are inconclusive. */
export function rejectedByContract(error: unknown) {
  const reverted =
    error instanceof BaseError
      ? error.walk((e) => e instanceof ContractFunctionRevertedError)
      : null;
  return (
    reverted instanceof ContractFunctionRevertedError &&
    reverted.data?.errorName === "EACUnauthorizedAccountRoles"
  );
}

export async function resolveText(
  name: string,
  key: string,
  blockNumber?: bigint,
) {
  const [data, resolver] = await ensClient().readContract({
    address: ENSV2_DEPLOYMENT.UniversalResolverV2,
    abi: universalAbi,
    functionName: "resolve",
    args: [
      toHex(packetToBytes(name)),
      encodeFunctionData({
        abi: textAbi,
        functionName: "text",
        args: [namehash(name), key],
      }),
    ],
    blockNumber,
  });
  return {
    value: decodeFunctionResult({ abi: textAbi, functionName: "text", data }),
    resolver,
  };
}

export async function loadReport(
  live: LiveEnsBinding,
  confirmedBlock?: bigint,
) {
  const client = ensClient();
  const blockNumber =
    confirmedBlock ?? (await client.getBlockNumber({ cacheTime: 0 }));
  const leaf = live.binding.path[3];
  const resolver = await client.readContract({
    address: leaf.registry,
    abi: ensRegistryAbi,
    functionName: "getResolver",
    args: [leaf.label],
    blockNumber,
  });
  if (resolver === zeroAddress) throw new Error("This space has no resolver.");
  const implementation = await client.readContract({
    address: ENSV2_DEPLOYMENT.VerifiableFactory,
    abi: factoryAbi,
    functionName: "verifyContract",
    args: [resolver],
    blockNumber,
  });
  if (
    getAddress(implementation) !==
    getAddress(ENSV2_DEPLOYMENT.PermissionedResolverImpl)
  )
    throw new Error(
      "The current resolver is not the pinned ENSv2 Permissioned Resolver.",
    );
  const keys = [
    "urban.assetId",
    "urban.scope",
    "urban.authority",
    REPORT_KEY,
  ] as const;
  const results = await Promise.all(
    keys.map((key) => resolveText(live.name, key, blockNumber)),
  );
  if (
    results.some((r) => getAddress(r.resolver) !== getAddress(resolver)) ||
    results[0].value !== live.binding.assetId.toString() ||
    results[1].value !== "rooftop" ||
    results[2].value.toLowerCase() !== live.setting.authority.toLowerCase()
  )
    throw new Error(
      "Resolver records do not match this verified rooftop binding.",
    );
  return { resolver, value: results[3].value, blockNumber };
}

export async function checkReporter(
  live: LiveEnsBinding,
  resolver: Address,
  reporter: string,
  confirmedBlock?: bigint,
) {
  const account = reporterAddress(reporter);
  const client = ensClient();
  const blockNumber =
    confirmedBlock ?? (await client.getBlockNumber({ cacheTime: 0 }));
  const checks = await Promise.all(
    [REPORT_KEY, "urban.assetId", "urban.rightsContract"].map(async (key) => {
      try {
        await client.simulateContract({
          address: resolver,
          abi: permissionedResolverAbi,
          functionName: "setText",
          args: [
            toHex(packetToBytes(live.name)),
            key,
            "Permission check only; no transaction is sent.",
          ],
          account,
          blockNumber,
        });
        return { key, result: "allowed" as const };
      } catch (error) {
        return {
          key,
          result: rejectedByContract(error)
            ? ("denied" as const)
            : ("unavailable" as const),
        };
      }
    }),
  );
  return { account, blockNumber, checks };
}
