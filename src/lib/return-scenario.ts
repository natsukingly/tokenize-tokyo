// Scenario arithmetic only. Nothing here accrues revenue or mutates balances.
const positive = (n: number) =>
  Number.isFinite(n) && n > 0 && n <= Number.MAX_SAFE_INTEGER;
const nonnegative = (n: number) =>
  Number.isFinite(n) && n >= 0 && n <= Number.MAX_SAFE_INTEGER;
export type ReturnScenario = {
  cost: number;
  income: number;
  exit: number;
  proceeds: number;
  profit: number;
  roi: number;
  breakEven: number;
};
function result(
  cost: number,
  income: number,
  exit: number,
  breakEven: number,
): ReturnScenario | null {
  const proceeds = income + exit,
    profit = proceeds - cost,
    roi = (profit / cost) * 100;
  if (
    ![cost, income, exit, proceeds, profit, roi, breakEven].every(
      Number.isFinite,
    ) ||
    cost <= 0
  )
    return null;
  return { cost, income, exit, proceeds, profit, roi, breakEven };
}
export function fractionScenario(p: {
  units: number;
  totalSupply: number;
  price: number;
  months: number;
  annualPoolIncome: number;
  resalePrice: number;
  costs: number;
}): ReturnScenario | null {
  if (
    ![p.units, p.totalSupply, p.months].every(Number.isSafeInteger) ||
    ![p.units, p.totalSupply, p.price, p.months].every(positive) ||
    p.units > p.totalSupply ||
    ![p.annualPoolIncome, p.resalePrice, p.costs].every(nonnegative)
  )
    return null;
  const cost = p.units * p.price + p.costs;
  const income =
    p.annualPoolIncome * (p.units / p.totalSupply) * (p.months / 12);
  return result(
    cost,
    income,
    p.units * p.resalePrice,
    Math.max(0, (cost - income) / p.units),
  );
}
export function rentalScenario(p: {
  days: number;
  price: number;
  dailyRevenue: number;
  operatingCosts: number;
}): ReturnScenario | null {
  if (
    !Number.isSafeInteger(p.days) ||
    ![p.days, p.price].every(positive) ||
    ![p.dailyRevenue, p.operatingCosts].every(nonnegative)
  )
    return null;
  const cost = p.days * p.price + p.operatingCosts;
  return result(cost, p.days * p.dailyRevenue, 0, cost / p.days);
}
