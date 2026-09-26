import { afterEach, expect, it, vi } from "vitest";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { POST } from "./route";
vi.mock("@/lib/config", () => ({
  config: {
    chainId: 2017072401,
    rpc: "https://test.invalid/web3/public",
    url: "https://test.invalid",
  },
}));
const origin = "https://tokenize-tokyo.vercel.app";
const request = (body: unknown, originHeader = origin) =>
  new Request(origin + "/api/test-gas", {
    method: "POST",
    headers: { Origin: originHeader, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
it("rejects unsigned and wrong-origin faucet calls without contacting upstream", async () => {
  vi.stubEnv("MULTIBAAS_FAUCET_KEY", "server-only");
  const fetch = vi.fn();
  vi.stubGlobal("fetch", fetch);
  expect(
    (await POST(request({ action: "claim", address: "0x" + "a".repeat(40) })))
      .status,
  ).toBe(401);
  expect(
    (
      await POST(
        request(
          { action: "challenge", address: "0x" + "a".repeat(40) },
          "https://attacker.example",
        ),
      )
    ).status,
  ).toBe(403);
  expect(fetch).not.toHaveBeenCalled();
});
it("checks chain and balance, forwards only the signer address, and blocks immediate replay", async () => {
  vi.stubEnv("MULTIBAAS_FAUCET_KEY", "server-only");
  const signer = privateKeyToAccount(generatePrivateKey());
  const { challenge, message } = await (
    await POST(request({ action: "challenge", address: signer.address }))
  ).json();
  const signature = await signer.signMessage({ message });
  const fetch = vi
    .fn()
    .mockResolvedValueOnce(Response.json({ result: "0x783a1511" }))
    .mockResolvedValueOnce(Response.json({ result: "0x0" }))
    .mockResolvedValueOnce(Response.json({ message: "success" }));
  vi.stubGlobal("fetch", fetch);
  const body = {
    action: "claim",
    challenge,
    signature,
    amount: "99999999",
    address: "0x" + "b".repeat(40),
  };
  expect((await POST(request(body))).status).toBe(200);
  expect(JSON.parse(fetch.mock.calls[2][1].body)).toEqual({
    address: signer.address.toLowerCase(),
  });
  expect((await POST(request(body))).status).toBe(429);
  expect(fetch).toHaveBeenCalledTimes(3);
});
it("does not fund an already funded address", async () => {
  vi.stubEnv("MULTIBAAS_FAUCET_KEY", "server-only");
  const signer = privateKeyToAccount(generatePrivateKey());
  const { challenge, message } = await (
    await POST(request({ action: "challenge", address: signer.address }))
  ).json();
  const signature = await signer.signMessage({ message });
  const fetch = vi
    .fn()
    .mockResolvedValueOnce(Response.json({ result: "0x783a1511" }))
    .mockResolvedValueOnce(Response.json({ result: "0xde0b6b3a7640000" }));
  vi.stubGlobal("fetch", fetch);
  expect(
    (await POST(request({ action: "claim", challenge, signature }))).status,
  ).toBe(409);
  expect(fetch).toHaveBeenCalledTimes(2);
});
