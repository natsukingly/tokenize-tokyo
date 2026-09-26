import {
  createHmac,
  timingSafeEqual,
  createHash,
  randomUUID,
} from "node:crypto";
import {
  mkdir,
  writeFile,
  readdir,
  readFile,
  link,
  unlink,
} from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
export function verifySignature(
  body: string,
  timestamp: string,
  signature: string,
  secret: string,
  now = Math.floor(Date.now() / 1000),
): boolean {
  if (
    !secret ||
    !/^\d{10}$/.test(timestamp) ||
    !/^[a-f\d]{64}$/i.test(signature) ||
    Math.abs(now - Number(timestamp)) > 300
  )
    return false;
  const expected = createHmac("sha256", secret)
    .update(body)
    .update(timestamp)
    .digest();
  return timingSafeEqual(expected, Buffer.from(signature, "hex"));
}
const delivery = z
  .array(
    z.object({
      id: z.string().min(1).max(200),
      event: z.string(),
      data: z.object({
        event: z
          .object({
            name: z.string(),
            contract: z.object({ address: z.string() }),
          })
          .optional(),
        transaction: z.object({ txHash: z.string() }).optional(),
      }),
    }),
  )
  .max(1000);
export type Activity = {
  id: string;
  name: string;
  txHash: string;
  receivedAt: string;
};
export async function ingest(body: string, dir: string, addresses: string[]) {
  const events = delivery.parse(JSON.parse(body));
  const allowed = new Set(
    addresses.filter(Boolean).map((a) => a.toLowerCase()),
  );
  await mkdir(dir, { recursive: true, mode: 0o700 });
  let accepted = 0;
  for (const e of events) {
    if (
      e.event !== "event.emitted" ||
      !e.data.event ||
      !allowed.has(e.data.event.contract.address.toLowerCase())
    )
      continue;
    const record: Activity = {
      id: e.id,
      name: e.data.event.name,
      txHash: e.data.transaction?.txHash || "",
      receivedAt: new Date().toISOString(),
    };
    const key = createHash("sha256").update(e.id).digest("hex");
    const temporary = path.join(dir, "." + randomUUID() + ".tmp");
    try {
      await writeFile(temporary, JSON.stringify(record), {
        flag: "wx",
        mode: 0o600,
      });
      // Publish a complete record atomically; hard-link creation is exclusive.
      await link(temporary, path.join(dir, key + ".json"));
      accepted++;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
    } finally {
      await unlink(temporary).catch(() => {});
    }
  }
  return accepted;
}
export async function readActivity(
  dir: string,
): Promise<{ revision: string; events: Activity[] }> {
  let files: string[];
  try {
    files = (await readdir(dir))
      .filter((f) => /^[a-f0-9]{64}\.json$/.test(f))
      .sort();
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT")
      return { revision: "empty", events: [] };
    throw error;
  }
  const events: Activity[] = [];
  for (const f of files) {
    try {
      events.push(
        JSON.parse(await readFile(path.join(dir, f), "utf8")) as Activity,
      );
    } catch {
      /* Concurrent write: included on next poll. */
    }
  }
  events.sort((a, b) => b.receivedAt.localeCompare(a.receivedAt));
  return {
    revision: createHash("sha256")
      .update(
        events
          .map((e) => e.id)
          .sort()
          .join("|"),
      )
      .digest("hex"),
    events: events.slice(0, 30),
  };
}
