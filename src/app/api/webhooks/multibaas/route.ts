import { verifySignature, ingest } from "@/lib/webhook";
import { ZodError } from "zod";
import { config } from "@/lib/config";
export const runtime = "nodejs";
export async function POST(request: Request) {
  const secret = process.env.MULTIBAAS_WEBHOOK_SECRET;
  if (!secret)
    return Response.json({ error: "Webhook not configured" }, { status: 503 });
  // Bound actual bytes, not just the untrusted Content-Length header.
  const reader = request.body?.getReader();
  if (!reader) return new Response(null, { status: 400 });
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > 1_048_576) {
      await reader.cancel();
      return new Response(null, { status: 413 });
    }
    chunks.push(value);
  }
  const body = Buffer.concat(chunks).toString("utf8");
  if (
    !verifySignature(
      body,
      request.headers.get("x-multibaas-timestamp") || "",
      request.headers.get("x-multibaas-signature") || "",
      secret,
    )
  )
    return Response.json(
      { error: "Invalid signature or timestamp" },
      { status: 401 },
    );
  try {
    const accepted = await ingest(
      body,
      process.env.WEBHOOK_DATA_DIR || ".data",
      Object.values(config.addresses),
    );
    return Response.json({ accepted });
  } catch (error) {
    const invalid = error instanceof SyntaxError || error instanceof ZodError;
    return Response.json(
      {
        error: invalid ? "Invalid delivery" : "Storage temporarily unavailable",
      },
      { status: invalid ? 400 : 503 },
    );
  }
}
