import { readActivity } from "@/lib/webhook";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET() {
  return Response.json(
    await readActivity(process.env.WEBHOOK_DATA_DIR || ".data"),
    { headers: { "Cache-Control": "no-store" } },
  );
}
