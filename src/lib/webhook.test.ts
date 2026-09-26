import { describe, it, expect } from "vitest";
import { createHmac } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { verifySignature, ingest, readActivity } from "./webhook";
const now = 1800000000,
  secret = "test-only-secret",
  address = "0x" + "a".repeat(40);
const payload = JSON.stringify([
  {
    id: "delivery-1",
    event: "event.emitted",
    data: {
      event: { name: "AssetVerified", contract: { address } },
      transaction: { txHash: "0x" + "b".repeat(64) },
    },
  },
]);
const signature = (body = payload, time = String(now)) =>
  createHmac("sha256", secret).update(body).update(time).digest("hex");
describe("MultiBaas signed deliveries", () => {
  it("accepts exact raw body + timestamp", () =>
    expect(
      verifySignature(payload, String(now), signature(), secret, now),
    ).toBe(true));
  it.each([
    [payload + " ", String(now), signature()],
    [payload, String(now - 301), signature(payload, String(now - 301))],
    [payload, String(now + 301), signature(payload, String(now + 301))],
    [payload, "bad", signature()],
    [payload, String(now), "nope"],
    [payload, String(now), "a".repeat(64)],
    [payload, "", signature()],
  ])("rejects tampering, replay and malformed headers", (body, time, sig) =>
    expect(verifySignature(body, time, sig, secret, now)).toBe(false),
  );
  it("rejects missing secret", () =>
    expect(verifySignature(payload, String(now), signature(), "", now)).toBe(
      false,
    ));
  it("persists idempotently under concurrent retry and ignores unrelated contracts", async () => {
    const dir = await mkdtemp(tmpdir() + "/tokyo-webhook-");
    try {
      await Promise.all([
        ingest(payload, dir, [address]),
        ingest(payload, dir, [address]),
      ]);
      const result = await readActivity(dir);
      expect(result.events).toHaveLength(1);
      expect(result.events[0].name).toBe("AssetVerified");
      await ingest(
        payload
          .replace("delivery-1", "delivery-2")
          .replace(address, "0x" + "c".repeat(40)),
        dir,
        [address],
      );
      expect((await readActivity(dir)).revision).toBe(result.revision);
      await expect(ingest("{}", dir, [address])).rejects.toThrow();
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
  it("empty store is readable", async () =>
    expect(
      (await readActivity("/tmp/tokenize-tokyo-does-not-exist")).events,
    ).toEqual([]));
});
