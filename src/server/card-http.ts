import { createHash, randomBytes } from "node:crypto";
import { cardSettings, stripeClient } from "./card-settings";
import { cardStore } from "./card-store";
import { cardChain } from "./card-chain";
import { cardService } from "./card-service";

export const cardReply = (
  body: unknown,
  status = 200,
  headers: Record<string, string> = {},
) =>
  Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store", ...headers },
  });
export function browserToken(request: Request) {
  const token = request.headers
    .get("cookie")
    ?.split(";")
    .map((v) => v.trim())
    .find((v) => v.startsWith("tt-card-browser="))
    ?.slice(16);
  return token && /^[\da-f]{64}$/.test(token) ? token : undefined;
}
export const ownerHash = (token: string) =>
  createHash("sha256").update(token).digest("hex");
export function browserCookie(request: Request) {
  const token = browserToken(request) || randomBytes(32).toString("hex");
  return `tt-card-browser=${token}; HttpOnly; SameSite=Lax; Path=/api/card-checkout; Max-Age=2592000${process.env.NODE_ENV === "production" ? "; Secure" : ""}`;
}
export async function boundedText(request: Request, max: number) {
  const reader = request.body?.getReader();
  if (!reader) throw new Error("Missing body");
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > max) {
      await reader.cancel();
      throw new Error("Body too large");
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString("utf8");
}
export function cardDependencies() {
  const settings = cardSettings();
  const stripe = stripeClient(settings);
  const store = cardStore(settings.databaseUrl);
  const service = cardService(
    store,
    stripe,
    cardChain(settings),
    settings.origin,
  );
  return { settings, stripe, store, service };
}
