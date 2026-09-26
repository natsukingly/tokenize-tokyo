import { expect, it } from "vitest";
import {
  initialFinance,
  buyFraction,
  listFraction,
  rentRight,
} from "./finance-lab";
import { parseFinanceStorage } from "./finance-storage";
it("restores valid holdings and rentals without resetting their balances", () => {
  const bought = buyFraction(initialFinance(), "fraction-parking", 10);
  const saved = rentRight(
    listFraction(bought, bought.positions[0].id, 3, 60),
    "rental-storage",
    7,
    1000,
  );
  expect(parseFinanceStorage(JSON.parse(JSON.stringify(saved)))).toEqual(saved);
});
it("rejects malformed entries, invalid amounts, duplicate IDs and missing references", () => {
  const base = initialFinance();
  for (const saved of [
    null,
    {},
    { ...base, offers: [null] },
    { ...base, cash: -1 },
    { ...base, sequence: null },
    { ...base, offers: [{ ...base.offers[0], price: Infinity }] },
    { ...base, offers: [base.offers[0], base.offers[0]] },
    { ...base, positions: [{ id: "p1", offerId: "missing", shares: 3 }] },
    {
      ...base,
      rentals: [
        {
          id: "r1",
          offerId: "fraction-parking",
          days: 1,
          endsAt: 1,
          active: true,
          ownerRetainsToken: true,
        },
      ],
    },
  ])
    expect(parseFinanceStorage(saved)).toBeNull();
});
