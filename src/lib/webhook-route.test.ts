import { it, expect, vi } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { createHmac } from "node:crypto";
it("HTTP delivery validates HMAC, persists once, and changes the application activity revision", async () => {
  const dir = await mkdtemp(tmpdir() + "/tokyo-route-");
  const address = "0x" + "a".repeat(40),
    secret = "local-test-only";
  vi.stubEnv("MULTIBAAS_WEBHOOK_SECRET", secret);
  vi.stubEnv("WEBHOOK_DATA_DIR", dir);
  vi.stubEnv("NEXT_PUBLIC_REGISTRY_ADDRESS", address);
  vi.resetModules();
  try {
    const { POST } = await import("../app/api/webhooks/multibaas/route");
    const { GET } = await import("../app/api/activity/route");
    const before = await (await GET()).json();
    const raw = JSON.stringify([
      {
        id: "event-1",
        event: "event.emitted",
        data: { event: { name: "AssetVerified", contract: { address } } },
      },
    ]);
    const time = String(Math.floor(Date.now() / 1000));
    const signature = createHmac("sha256", secret)
      .update(raw)
      .update(time)
      .digest("hex");
    const request = () =>
      new Request("http://localhost/api/webhooks/multibaas", {
        method: "POST",
        body: raw,
        headers: {
          "X-MultiBaas-Timestamp": time,
          "X-MultiBaas-Signature": signature,
        },
      });
    expect(
      (
        await POST(
          new Request("http://localhost", { method: "POST", body: raw }),
        )
      ).status,
    ).toBe(401);
    expect(await (await POST(request())).json()).toEqual({ accepted: 1 });
    const after = await (await GET()).json();
    expect(after.revision).not.toBe(before.revision);
    expect(after.events[0].name).toBe("AssetVerified");
    expect(await (await POST(request())).json()).toEqual({ accepted: 0 });
    expect((await (await GET()).json()).revision).toBe(after.revision);
    vi.stubEnv("MULTIBAAS_WEBHOOK_SECRET", "");
    expect((await POST(request())).status).toBe(503);
  } finally {
    vi.unstubAllEnvs();
    await rm(dir, { recursive: true, force: true });
  }
});
