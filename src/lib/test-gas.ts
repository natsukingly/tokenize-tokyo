import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { verifyMessage, type Address, type Hex } from "viem";

export const GAS_CHAIN_ID = 2017072401;
export type GasChallenge = {
  address: string;
  origin: string;
  expires: number;
  nonce: string;
  token: string;
};
const payload = (c: Omit<GasChallenge, "token">) =>
  [c.address.toLowerCase(), c.origin, c.expires, c.nonce].join("\n");
const mac = (c: Omit<GasChallenge, "token">, secret: string) =>
  createHmac("sha256", secret).update(payload(c)).digest("hex");
export function createGasChallenge(
  address: string,
  origin: string,
  secret: string,
  now = Date.now(),
): GasChallenge {
  const c = {
    address: address.toLowerCase(),
    origin,
    expires: now + 300_000,
    nonce: randomBytes(16).toString("hex"),
  };
  return { ...c, token: mac(c, secret) };
}
export function gasMessage(c: GasChallenge) {
  return [
    "TOKENIZE TOKYO — Request test gas",
    `Website: ${c.origin}`,
    `Wallet: ${c.address}`,
    `Network: Curvegrid Testnet (${GAS_CHAIN_ID})`,
    "Request: 1 test ETH for gas. No monetary value.",
    "This signature only requests test gas. It does not approve spending or prove property ownership.",
    `Expires: ${new Date(c.expires).toISOString()}`,
    `Nonce: ${c.nonce}`,
  ].join("\n");
}
export async function verifyGasChallenge(
  c: GasChallenge,
  signature: string,
  origin: string,
  secret: string,
  now = Date.now(),
) {
  if (
    !c ||
    !/^0x[0-9a-f]{40}$/i.test(c.address) ||
    c.origin !== origin ||
    !Number.isSafeInteger(c.expires) ||
    c.expires < now ||
    c.expires > now + 300_000 ||
    !/^[0-9a-f]{32}$/.test(c.nonce) ||
    !/^[0-9a-f]{64}$/.test(c.token) ||
    !/^0x[0-9a-f]{130}$/i.test(signature)
  )
    return false;
  if (
    !timingSafeEqual(
      Buffer.from(c.token, "hex"),
      Buffer.from(mac(c, secret), "hex"),
    )
  )
    return false;
  try {
    return await verifyMessage({
      address: c.address as Address,
      message: gasMessage(c),
      signature: signature as Hex,
    });
  } catch {
    return false;
  }
}
