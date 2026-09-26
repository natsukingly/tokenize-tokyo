import { it, expect } from "vitest";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { createGasChallenge, gasMessage, verifyGasChallenge } from "./test-gas";
const signer = privateKeyToAccount(generatePrivateKey());
const origin = "https://tokenize-tokyo.example",
  secret = "test-server-only-key";
it("only funds the signer for this website with a fresh, untampered challenge", async () => {
  const c = createGasChallenge(signer.address, origin, secret);
  const signature = await signer.signMessage({ message: gasMessage(c) });
  expect(await verifyGasChallenge(c, signature, origin, secret)).toBe(true);
  expect(
    await verifyGasChallenge(c, signature, "https://elsewhere.example", secret),
  ).toBe(false);
  expect(
    await verifyGasChallenge(
      { ...c, address: "0x" + "a".repeat(40) },
      signature,
      origin,
      secret,
    ),
  ).toBe(false);
  expect(
    await verifyGasChallenge(c, signature, origin, secret, c.expires + 1),
  ).toBe(false);
  expect(
    await verifyGasChallenge(
      { ...c, expires: c.expires + 1000 },
      signature,
      origin,
      secret,
    ),
  ).toBe(false);
  const stranger = privateKeyToAccount(generatePrivateKey());
  expect(
    await verifyGasChallenge(
      c,
      await stranger.signMessage({ message: gasMessage(c) }),
      origin,
      secret,
    ),
  ).toBe(false);
  expect(await verifyGasChallenge(null as never, "", origin, secret)).toBe(
    false,
  );
});
