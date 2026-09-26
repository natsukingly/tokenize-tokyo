import { describe, expect, it } from "vitest";
import { zeroAddress, type Address } from "viem";
import { ENSV2_CHAIN_ID, namespaceIdentity, spaceNamespace } from "./spaces";
import {
  inspectNamespace,
  namespaceDelegationCall,
  type RegistryReader,
} from "./registry";

const root = "0x0000000000000000000000000000000000000011" as Address;
const child = "0x0000000000000000000000000000000000000022" as Address;
const owner = "0x0000000000000000000000000000000000000033" as Address;
const operator = "0x0000000000000000000000000000000000000044" as Address;
function reader(overrides: Partial<RegistryReader> = {}): RegistryReader {
  return {
    chainId: async () => ENSV2_CHAIN_ID,
    snapshot: async () => ({ number: 99n, timestamp: 1000n }),
    state: async (_registry, _id, block) => {
      expect(block).toBe(99n);
      return {
        status: 2,
        expiry: 2000n,
        latestOwner: owner,
        tokenId: 55n,
        resource: 66n,
      };
    },
    subregistry: async () => child,
    resolver: async () => zeroAddress,
    parent: async () => [root, "parent"],
    roles: async () => 1n << 24n,
    ...overrides,
  };
}
const path = { anchor: root, labels: ["parent", "rooftop"], operator };
describe("ENSv2 spatial namespace adapter (fixtures, not live ENS)", () => {
  it("builds a scope below an explicitly supplied parent without claiming ownership", () => {
    expect(
      spaceNamespace({
        parent: "sample.eth",
        district: "chiyoda",
        assetId: "1024",
        scope: "Rooftop",
      }).name,
    ).toBe("rooftop.building-1024.chiyoda.sample.eth");
    expect(() =>
      spaceNamespace({
        parent: "sample.eth",
        district: "roof.evil",
        assetId: "1",
        scope: "Rooftop",
      }),
    ).toThrow();
    expect(() =>
      spaceNamespace({
        parent: "sample.eth",
        district: "chiyoda",
        assetId: "0",
        scope: "Rooftop",
      }),
    ).toThrow();
  });
  it("inspects canonical pointers at one block, using labelhash across token regeneration", async () => {
    const result = await inspectNamespace(reader(), path);
    expect(result.entries[1].registry).toBe(child);
    expect(result.entries[1].labelhash).toBe(
      namespaceIdentity(child, "rooftop").labelhash,
    );
    expect(result.entries[1].resource).toBe(66n);
    expect(result.authority).toBe("namespace-inspection-only");
    expect(result.explicitNamespaceRoles).toBe(1n << 24n);
  });
  it("fails closed on Curvegrid Testnet instead of treating Sepolia names as local authority", async () => {
    await expect(
      inspectNamespace(reader({ chainId: async () => 2017072401 }), path),
    ).rejects.toThrow("Sepolia");
  });
  it.each([0, 1])("rejects unavailable/reserved status %i", async (status) => {
    await expect(
      inspectNamespace(
        reader({
          state: async () => ({
            status,
            expiry: 2000n,
            latestOwner: owner,
            tokenId: 1n,
            resource: 1n,
          }),
        }),
        path,
      ),
    ).rejects.toThrow("unregistered");
  });
  it("rejects expiry at the boundary even when an index still says registered", async () => {
    await expect(
      inspectNamespace(
        reader({
          state: async () => ({
            status: 2,
            expiry: 1000n,
            latestOwner: owner,
            tokenId: 1n,
            resource: 1n,
          }),
        }),
        path,
      ),
    ).rejects.toThrow("expired");
  });
  it("rejects detached or noncanonical subregistries", async () => {
    await expect(
      inspectNamespace(reader({ subregistry: async () => zeroAddress }), path),
    ).rejects.toThrow("attached");
    await expect(
      inspectNamespace(reader({ parent: async () => [root, "wall"] }), path),
    ).rejects.toThrow("mismatch");
  });
  it("does not grant issuance authority when an operator has namespace roles", async () => {
    const result = await inspectNamespace(reader(), path);
    expect(result).not.toHaveProperty("canIssue");
    expect(result).not.toHaveProperty("verifiedOwner");
  });
  it("prepares only a per-name regular resolver role, never root/admin/verification roles", () => {
    const grant = namespaceDelegationCall("grant", child, "rooftop", operator);
    expect(grant.method).toBe("grantRoles");
    expect(grant.args[1]).toBe((1n << 24n).toString());
    expect(grant.signAndSubmit).toBe(false);
    expect(
      namespaceDelegationCall("revoke", child, "rooftop", operator).method,
    ).toBe("revokeRoles");
    expect(() =>
      namespaceDelegationCall("grant", child, "rooftop", zeroAddress),
    ).toThrow();
  });
});
