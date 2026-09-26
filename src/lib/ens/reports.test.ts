import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  decodeFunctionData,
  encodeErrorResult,
  ContractFunctionRevertedError,
  encodeAbiParameters,
  getAddress,
  keccak256,
  stringToHex,
  zeroAddress,
} from "viem";
import {
  reportValue,
  reportCall,
  reporterGrantCall,
  reporterRevokeCall,
  REPORT_KEY,
  REPORT_ROLE,
  rejectedByContract,
  loadReport,
  checkReporter,
} from "./reports";
import { permissionedResolverAbi } from "./resolver-abi";
import { ensClient, type LiveEnsBinding } from "./authority";
import { ENSV2_DEPLOYMENT } from "./deployment";
vi.mock("./authority", () => ({ ensClient: vi.fn() }));

const name = "rooftop.building-1.chiyoda.tokenizetokyo-demo-2026.eth";
const reporter = "0x00000000000000000000000000000000000000ab";
describe("ENS reporting permission", () => {
  it("keeps a measured quantity precise and labels operator reports", () => {
    expect(JSON.parse(reportValue("2026-09", "125.50"))).toEqual({
      period: "2026-09",
      energyKWh: "125.50",
      source: "operator-reported test data",
    });
  });
  it.each(["-1", "NaN", "1e5", "1.2345", "1000000000", ""])(
    "rejects an invalid reading %s",
    (value) => {
      expect(() => reportValue("2026-09", value)).toThrow();
    },
  );
  it.each(["2026-13", "2026-00", "2026-9", "invalid"])(
    "rejects an invalid reporting period %s",
    (period) => {
      expect(() => reportValue(period, "1")).toThrow();
    },
  );
  it("authorizes only the report text key, not all text records", () => {
    const call = reporterGrantCall(name, reporter);
    expect(call.functionName).toBe("grantSetterRoles");
    const setter = decodeFunctionData({
      abi: permissionedResolverAbi,
      data: call.args[0],
    });
    expect(setter.functionName).toBe("setText");
    expect(setter.args?.[1]).toBe(REPORT_KEY);
    expect(call.args[1]).toBe(getAddress(reporter));
    const revoke = reporterRevokeCall(reporter);
    expect(revoke.args).toEqual([
      BigInt(keccak256(stringToHex(REPORT_KEY))),
      REPORT_ROLE,
      getAddress(reporter),
    ]);
  });
  it("does not permit a zero reporter or a different record through the report action", () => {
    expect(() => reporterGrantCall(name, zeroAddress)).toThrow();
    const call = reportCall(name, "2026-09", "0");
    expect(call.args[1]).toBe(REPORT_KEY);
  });
  it("does not turn transport errors into evidence of permission denial", () => {
    expect(rejectedByContract(new Error("timeout"))).toBe(false);
    expect(rejectedByContract({ name: "ContractFunctionRevertedError" })).toBe(
      false,
    );
  });
  it("accepts a decoded ENS access-control denial and rejects unrelated reverts", () => {
    const denied = new ContractFunctionRevertedError({
      abi: permissionedResolverAbi,
      functionName: "setText",
      data: encodeErrorResult({
        abi: permissionedResolverAbi,
        errorName: "EACUnauthorizedAccountRoles",
        args: [1n, REPORT_ROLE, reporter],
      }),
    });
    expect(rejectedByContract(denied)).toBe(true);
    const other = new ContractFunctionRevertedError({
      abi: permissionedResolverAbi,
      functionName: "setText",
      data: encodeErrorResult({
        abi: permissionedResolverAbi,
        errorName: "InvalidInitialization",
        args: [],
      }),
    });
    expect(rejectedByContract(other)).toBe(false);
  });
});

describe("live report verification", () => {
  const resolver = "0x0000000000000000000000000000000000000001";
  const live = {
    name,
    setting: { authority: reporter },
    binding: {
      assetId: 1n,
      path: [{}, {}, {}, { registry: resolver, label: "rooftop" }],
    },
  } as unknown as LiveEnsBinding;
  const records: Record<string, string> = {
    "urban.assetId": "1",
    "urban.scope": "rooftop",
    "urban.authority": reporter,
    [REPORT_KEY]: "recorded generation",
  };
  let mode = "valid";
  const simulateContract = vi.fn();
  const readContract = vi.fn(
    async (call: { functionName: string; args: unknown[] }) => {
      if (call.functionName === "getResolver")
        return mode === "missing" ? zeroAddress : resolver;
      if (call.functionName === "verifyContract")
        return mode === "untrusted"
          ? zeroAddress
          : ENSV2_DEPLOYMENT.PermissionedResolverImpl;
      const key = Object.keys(records).find((item) =>
        String(call.args[1]).includes(Buffer.from(item).toString("hex")),
      )!;
      const value =
        mode === "wrong-asset" && key === "urban.assetId" ? "99" : records[key];
      return [
        encodeAbiParameters([{ type: "string" }], [value]),
        mode === "wrong-resolver" ? zeroAddress : resolver,
      ];
    },
  );
  beforeEach(() => {
    mode = "valid";
    readContract.mockClear();
    simulateContract.mockReset();
    vi.mocked(ensClient).mockReturnValue({
      getBlockNumber: vi.fn().mockResolvedValue(50n),
      readContract,
      simulateContract,
    } as unknown as ReturnType<typeof ensClient>);
  });
  it("reads the report through the Universal Resolver at the confirmed block", async () => {
    expect(await loadReport(live, 55n)).toEqual({
      resolver,
      value: "recorded generation",
      blockNumber: 55n,
    });
    expect(
      readContract.mock.calls.every(
        ([args]) =>
          (args as unknown as { blockNumber: bigint }).blockNumber === 55n,
      ),
    ).toBe(true);
  });
  it.each(["missing", "untrusted", "wrong-asset", "wrong-resolver"])(
    "refuses to use a %s binding for report writes",
    async (value) => {
      mode = value;
      await expect(loadReport(live)).rejects.toThrow();
    },
  );
  it("separates permission denial from a failed network check", async () => {
    const denied = new ContractFunctionRevertedError({
      abi: permissionedResolverAbi,
      functionName: "setText",
      data: encodeErrorResult({
        abi: permissionedResolverAbi,
        errorName: "EACUnauthorizedAccountRoles",
        args: [1n, REPORT_ROLE, reporter],
      }),
    });
    simulateContract
      .mockResolvedValueOnce({})
      .mockRejectedValueOnce(denied)
      .mockRejectedValueOnce(new Error("RPC offline"));
    const result = await checkReporter(live, resolver, reporter);
    expect(result.checks.map((item) => item.result)).toEqual([
      "allowed",
      "denied",
      "unavailable",
    ]);
    expect(result.blockNumber).toBe(50n);
  });
});
