import { describe, it, expect } from "vitest";
import { ASSET_KINDS } from "./catalog";
import {
  suggestedProject,
  projectScenarios,
  parseAssumptions,
} from "./project-plan";
import { compactMetadataURI, parseMetadata } from "./model";
describe("project planning scenarios", () => {
  it.each(ASSET_KINDS)("provides editable, bounded drafts for %s", (kind) => {
    const d = suggestedProject(kind, "Test site");
    expect(d.overview.length).toBeGreaterThan(900);
    expect(d.overview.length).toBeLessThan(2000);
    expect(d.overview).toContain("unverified");
    expect(projectScenarios(d.assumptions)).toHaveLength(3);
    const m = {
      name: "Example project with a longer name",
      kind,
      district: "CHIYODA",
      coordinates: [139.77, 35.69],
      area: 240,
      capacity: 40,
      description: d.overview,
      projectAssumptions: d.assumptions,
      evidence: "Simulated ownership evidence for this hackathon demo.",
      simulated: true,
      planningBasis:
        "Illustrative AI-authored draft, edited by issuer; not a site appraisal or market forecast.",
    };
    const uri = compactMetadataURI(m);
    expect(uri.length).toBeLessThanOrEqual(4096);
    expect(parseMetadata(uri)).toEqual(m);
  });
  it("round-trips Japanese overview text and rejects malformed metadata", () => {
    expect(
      parseMetadata(
        compactMetadataURI({
          description: "空き家を地域の工房として活用します。",
        }),
      ).description,
    ).toBe("空き家を地域の工房として活用します。");
    expect(parseMetadata("data:application/json;base64,!!!")).toEqual({});
  });
  it("shows negative operating cash without inventing a payout or recovery", () => {
    const a = {
      initialCost: 1000,
      annualRevenue: 100,
      annualCosts: 200,
      distributionPercent: 80,
    };
    const r = projectScenarios(a)[1];
    expect(r.net).toBe(-100);
    expect(r.distributable).toBe(0);
    expect(r.paybackYears).toBeNull();
    expect(r.cashReturnPercent).toBe(-10);
  });
  it("calculates base cash, distributions and payback from explicit inputs", () => {
    const r = projectScenarios({
      initialCost: 1000,
      annualRevenue: 300,
      annualCosts: 100,
      distributionPercent: 75,
    })[1];
    expect(r.net).toBe(200);
    expect(r.distributable).toBe(150);
    expect(r.paybackYears).toBe(5);
  });
  it("rejects zero investment, non-finite values and invalid allocation", () => {
    expect(
      parseAssumptions({
        initialCost: 0,
        annualRevenue: 1,
        annualCosts: 0,
        distributionPercent: 100,
      }),
    ).toBeNull();
    expect(
      projectScenarios({
        initialCost: 100,
        annualRevenue: Infinity,
        annualCosts: 1,
        distributionPercent: 101,
      }),
    ).toEqual([]);
  });
});
