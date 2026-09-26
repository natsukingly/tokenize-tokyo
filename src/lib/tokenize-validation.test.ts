import { expect, it } from "vitest";
import { spaceDraftError, rightDraftError } from "./tokenize-validation";

const space = {
  name: "Rooftop",
  area: "100",
  capacity: "20",
  lng: "139.77",
  lat: "35.69",
};
const right = {
  terms: "Deposited revenue only",
  evidence: "Demo",
  purpose: "SOLAR",
  supply: "100",
  start: "2030-01-01",
  end: "2031-01-01",
  price: "2400",
};
const now = Date.UTC(2029, 0, 1);
it("rejects empty, negative and non-finite space measurements and invalid coordinates", () => {
  expect(spaceDraftError(space)).toBe("");
  for (const area of ["", "0", "-1", "1e309", "NaN"])
    expect(spaceDraftError({ ...space, area })).toMatch(/area/i);
  expect(spaceDraftError({ ...space, capacity: "-1" })).toMatch(/capacity/i);
  expect(spaceDraftError({ ...space, capacity: "0" })).toBe("");
  expect(spaceDraftError({ ...space, name: " " })).toMatch(/name/i);
  expect(spaceDraftError({ ...space, lng: "-74" })).toMatch(/Tokyo/);
});
it("uses the contract supply bound and exact decimal settlement prices before review", () => {
  expect(rightDraftError(right, now)).toBe("");
  for (const supply of ["0", "-1", "0.1", "1e2", "1000000000001"])
    expect(rightDraftError({ ...right, supply }, now)).toMatch(/supply/i);
  expect(rightDraftError({ ...right, supply: "1000000000000" }, now)).toBe("");
  for (const price of ["", "0", "-1", "1e2", "0.0000000000000000001", "NaN"])
    expect(rightDraftError({ ...right, price }, now)).toMatch(/price/i);
  expect(
    rightDraftError({ ...right, price: "0.000000000000000001" }, now),
  ).toBe("");
});
it("rejects expired, impossible, reversed dates and oversized encoded terms", () => {
  for (const end of [
    "",
    "2028-12-31",
    "2030-01-01",
    "2030-02-30",
    "100000-01-01",
  ])
    expect(rightDraftError({ ...right, end }, now)).toMatch(/dates/i);
  expect(rightDraftError({ ...right, terms: " " }, now)).toMatch(/terms/i);
  expect(
    rightDraftError({ ...right, terms: "屋根".repeat(1000) }, now),
  ).toMatch(/4 KB/);
});
