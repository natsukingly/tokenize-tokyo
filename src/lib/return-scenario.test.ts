import { describe, expect, it } from "vitest";
import { fractionScenario, rentalScenario } from "./return-scenario";
const base = {
  units: 10,
  totalSupply: 1000,
  price: 50,
  months: 12,
  annualPoolIncome: 10000,
  resalePrice: 60,
  costs: 20,
};
describe("return scenarios", () => {
  it("allocates pool income pro rata and includes purchase, exit and fees", () => {
    const r = fractionScenario(base)!;
    expect(r).toMatchObject({
      cost: 520,
      income: 100,
      exit: 600,
      profit: 180,
      breakEven: 42,
    });
    expect(r.roi).toBeCloseTo(34.6153846);
    expect(fractionScenario({ ...base, months: 6 })!.income).toBe(50);
  });
  it("shows full capital loss with no income or resale, rather than invented yield", () => {
    expect(
      fractionScenario({ ...base, annualPoolIncome: 0, resalePrice: 0 })!.roi,
    ).toBe(-100);
    expect(
      fractionScenario({ ...base, annualPoolIncome: 100000 })!.breakEven,
    ).toBe(0);
  });
  it("models the renter's business result, with no token resale proceeds", () => {
    expect(
      rentalScenario({
        days: 7,
        price: 800,
        dailyRevenue: 1200,
        operatingCosts: 1400,
      }),
    ).toEqual({
      cost: 7000,
      income: 8400,
      exit: 0,
      proceeds: 8400,
      profit: 1400,
      roi: 20,
      breakEven: 1000,
    });
  });
  it("rejects invalid, fractional, negative and overflowing inputs", () => {
    for (const change of [
      { units: 0 },
      { units: 1001 },
      { units: 1.5 },
      { costs: -1 },
      { resalePrice: NaN },
      { months: 0 },
      { price: Infinity },
      { annualPoolIncome: Number.MAX_VALUE, months: 1000 },
    ])
      expect(fractionScenario({ ...base, ...change })).toBeNull();
    expect(
      rentalScenario({
        days: 0,
        price: 800,
        dailyRevenue: 1200,
        operatingCosts: 0,
      }),
    ).toBeNull();
  });
});
