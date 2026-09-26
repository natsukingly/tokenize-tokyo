import { describe, expect, it } from "vitest";
import { parseMetadata } from "./model";
import { ASSET_KINDS } from "./catalog";
import {
  cityPlan,
  cityPlanSummary,
  CITY_DATASET,
  CITY_STAGES,
} from "./sepolia-city-plan";

describe("additive Sepolia city catalog", () => {
  it("adds 196 unique spaces to the existing four, balanced across seven kinds and stages", () => {
    const plan = cityPlan();
    expect(plan).toHaveLength(196);
    expect(new Set(plan.map((p) => p.key)).size).toBe(196);
    expect(new Set(plan.map((p) => p.name)).size).toBe(196);
    expect(Object.values(cityPlanSummary().kinds)).toEqual(
      ASSET_KINDS.map(() => 28),
    );
    expect(Object.values(cityPlanSummary().stages)).toEqual(
      CITY_STAGES.map(() => 28),
    );
    expect(cityPlanSummary().newRights).toBe(112);
  });
  it("keeps inline metadata within contract limits with map coordinates and explicit fictional provenance", () => {
    for (const p of cityPlan()) {
      expect(Buffer.byteLength(p.metadata)).toBeLessThanOrEqual(4096);
      const m = parseMetadata(p.metadata);
      expect(m.dataset).toBe(CITY_DATASET);
      expect(m.simulated).toBe(true);
      expect(m.name).toBe(p.name);
      expect(m.coordinates).toHaveLength(2);
      expect(p.scope).toBeGreaterThanOrEqual(0);
    }
  });
  it("keeps exclusive usage separate from income funding and deposits only into operating income rights", () => {
    for (const p of cityPlan()) {
      expect(p.subscription).toBeLessThanOrEqual(p.supply);
      if (!p.revenue)
        expect([p.supply, p.subscription, p.deposit]).toEqual([1, 0, 0]);
      if (p.stage === 4) expect(p.subscription).toBeGreaterThan(0);
      if (p.deposit > 0)
        expect([p.stage, p.revenue, p.subscription]).toEqual([5, true, 100]);
    }
  });
});
