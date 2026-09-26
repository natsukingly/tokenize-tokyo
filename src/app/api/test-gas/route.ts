import { config } from "@/lib/config";
import {
  createGasChallenge,
  GAS_CHAIN_ID,
  gasMessage,
  verifyGasChallenge,
} from "@/lib/test-gas";
import { isAddress } from "@/lib/wallet";
export const runtime = "nodejs";
// A second guard in each warm server instance. The upstream faucet also enforces
// rate limits; this in-memory guard is not a durable distributed rate limiter.
const pending = new Set<string>();
const recent = new Map<string, number>();
const reply = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
export async function POST(request: Request) {
  const secret = process.env.MULTIBAAS_FAUCET_KEY;
  if (config.chainId !== GAS_CHAIN_ID || !secret || !config.rpc || !config.url)
    return reply(
      { error: "Self-service gas is unavailable on this deployment." },
      503,
    );
  // Next may normalize request.url to localhost behind a proxy. Bind signatures
  // to an explicit website allowlist, never to an untrusted forwarded Host.
  const origin = request.headers.get("origin") || "";
  const allowed = [
    process.env.APP_ORIGIN || "https://tokenize-tokyo.vercel.app",
  ];
  if (process.env.NODE_ENV !== "production")
    allowed.push(
      "http://127.0.0.1:3000",
      "http://127.0.0.1:3002",
      "http://localhost:3000",
    );
  if (!allowed.includes(origin))
    return reply({ error: "Use the wallet panel on this website." }, 403);
  if (
    !request.headers.get("content-type")?.includes("application/json") ||
    Number(request.headers.get("content-length") || "0") > 4096
  )
    return reply({ error: "Invalid request." }, 400);
  let body;
  try {
    const text = await request.text();
    if (text.length > 4096) return reply({ error: "Invalid request." }, 400);
    body = JSON.parse(text);
  } catch {
    return reply({ error: "Invalid request." }, 400);
  }
  if (!body || typeof body !== "object")
    return reply({ error: "Invalid request." }, 400);
  if (body.action === "challenge" && isAddress(body.address)) {
    const challenge = createGasChallenge(body.address, origin, secret);
    return reply({ challenge, message: gasMessage(challenge) });
  }
  if (
    body.action !== "claim" ||
    !(await verifyGasChallenge(body.challenge, body.signature, origin, secret))
  )
    return reply(
      { error: "Invalid or expired wallet signature. Request test gas again." },
      401,
    );
  const address = body.challenge.address.toLowerCase();
  const now = Date.now();
  for (const [key, at] of recent) if (now - at > 300_000) recent.delete(key);
  if (pending.has(address) || recent.has(address))
    return reply(
      {
        error:
          "A gas request was already made. Check your balance and wait before retrying.",
      },
      429,
    );
  pending.add(address);
  try {
    const rpc = async (method: string, params: unknown[]) => {
      const response = await fetch(config.rpc, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
        signal: AbortSignal.timeout(10000),
      });
      const data = await response.json();
      if (!response.ok || data.error || !data.result)
        throw new Error("Network unavailable");
      return data.result;
    };
    if (Number(BigInt(await rpc("eth_chainId", []))) !== GAS_CHAIN_ID)
      throw new Error("Unexpected network");
    const balance = BigInt(await rpc("eth_getBalance", [address, "latest"]));
    if (balance >= 10n ** 16n)
      return reply({ error: "You already have enough test ETH for gas." }, 409);
    recent.set(address, now);
    const response = await fetch(
      new URL("/api/v0/chains/ethereum/faucet", config.url),
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${secret}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ address }),
        signal: AbortSignal.timeout(15000),
      },
    );
    if (!response.ok)
      return reply(
        {
          error:
            response.status === 429
              ? "The testnet faucet is rate limited. Please try later."
              : "The testnet faucet is temporarily unavailable. Please try later.",
        },
        response.status === 429 ? 429 : 502,
      );
    return reply({
      ok: true,
      message: "Test gas requested. Your balance will update shortly.",
    });
  } catch {
    return reply(
      { error: "Unable to reach the testnet. Please try later." },
      502,
    );
  } finally {
    pending.delete(address);
  }
}
