import { describe, expect, it } from "vitest";
import {
  DORMANT_BOUNDS,
  DORMANT_SITES,
  dormantCount,
  generateDormantSites,
} from "./dormant";
describe("dormant demo dataset", () => {
  it("is deterministic", () => {
    expect(generateDormantSites()).toEqual(generateDormantSites());
    expect(generateDormantSites()).toEqual(DORMANT_SITES);
  });
  it("has about 750 unique sites inside central Tokyo", () => {
    expect(DORMANT_SITES).toHaveLength(750);
    expect(new Set(DORMANT_SITES.map((s) => s.id)).size).toBe(750);
    for (const {
      coordinates: [lng, lat],
    } of DORMANT_SITES) {
      expect(lng).toBeGreaterThanOrEqual(DORMANT_BOUNDS.west);
      expect(lng).toBeLessThanOrEqual(DORMANT_BOUNDS.east);
      expect(lat).toBeGreaterThanOrEqual(DORMANT_BOUNDS.south);
      expect(lat).toBeLessThanOrEqual(DORMANT_BOUNDS.north);
    }
  });
  it("mixes rooftops, vacant homes and idle land", () => {
    const share = (k: string) => dormantCount(k) / DORMANT_SITES.length;
    expect(share("Rooftop")).toBeGreaterThan(0.45);
    expect(share("Rooftop")).toBeLessThan(0.65);
    expect(share("Vacant Home")).toBeGreaterThan(0.2);
    expect(share("Vacant Home")).toBeLessThan(0.4);
    expect(share("Idle Land")).toBeGreaterThan(0.07);
    expect(share("Idle Land")).toBeLessThan(0.23);
    expect(
      dormantCount("Rooftop") +
        dormantCount("Vacant Home") +
        dormantCount("Idle Land"),
    ).toBe(750);
    expect(dormantCount("All assets")).toBe(750);
  });
});
