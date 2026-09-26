import { it, expect } from "vitest";
import {
  initialFinance,
  buyFraction,
  listFraction,
  fillResale,
  rentRight,
  returnRental,
} from "./finance-lab";
it("fraction purchases consume finite inventory; resale cannot duplicate ownership", () => {
  const s = initialFinance();
  const purchased = buyFraction(s, "fraction-parking", 10);
  expect(purchased.positions[0].shares).toBe(10);
  expect(s.positions).toHaveLength(0);
  const listed = listFraction(purchased, purchased.positions[0].id, 4, 60);
  expect(listed.positions[0].shares).toBe(6);
  const sold = fillResale(listed, listed.resales[0].id);
  expect(sold.cash).toBe(purchased.cash + 240);
  expect(() => fillResale(sold, sold.resales[0].id)).toThrow();
  expect(() =>
    listFraction(purchased, purchased.positions[0].id, 11, 60),
  ).toThrow();
});
it("rentals keep title with owner and reject unavailable or overlong usage", () => {
  const s = initialFinance();
  expect(() => rentRight(s, "rental-storage", 31, 1000)).toThrow();
  const rented = rentRight(s, "rental-storage", 7, 1000);
  expect(rented.rentals[0].endsAt).toBe(1000 + 7 * 86400000);
  expect(rented.rentals[0].ownerRetainsToken).toBe(true);
  expect(() => rentRight(rented, "rental-storage", 1, 1000)).toThrow();
  const returned = returnRental(rented, rented.rentals[0].id);
  expect(returned.rentals[0].active).toBe(false);
  expect(returned.cash).toBe(rented.cash);
  expect(rentRight(returned, "rental-storage", 1, 1000).rentals).toHaveLength(
    2,
  );
});
it("rejects insufficient mock funds, zero, noninteger and excess purchases", () => {
  const s = initialFinance();
  for (const n of [0, 1.5, 10001])
    expect(() => buyFraction(s, "fraction-parking", n)).toThrow();
  expect(() => buyFraction({ ...s, cash: 0 }, "fraction-parking", 1)).toThrow();
});
it("creates one referenced mock market per type and never mutates the original state", async () => {
  const { createMockOffer } = await import("./finance-lab");
  const s = initialFinance(),
    source = {
      id: "Urban right #5",
      name: "My parking",
      kind: "Parking" as const,
    };
  const made = createMockOffer(s, source, "fraction", 30);
  expect(made.offers[0].total).toBe(1000);
  expect(s.offers).toHaveLength(6);
  expect(() => createMockOffer(made, source, "fraction", 30)).toThrow();
  expect(createMockOffer(made, source, "rental", 300).offers[0].maxDays).toBe(
    30,
  );
  expect(() => createMockOffer(s, source, "rental", 0)).toThrow();
  expect(() => buyFraction(s, "missing", 1)).toThrow();
  const closed = returnRental(rentRight(s, "rental-storage", 1, 0), "rental-1");
  expect(() => returnRental(closed, "rental-1")).toThrow();
});
