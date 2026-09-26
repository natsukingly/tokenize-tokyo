import { describe, expect, it } from "vitest";
import { clusterMapPoints, pickMapHighlights } from "./map-clusters";

describe("map marker density", () => {
  it("keeps each space exactly once without changing its position", () => {
    const points = [
      { id: "a", x: 100, y: 100 },
      { id: "b", x: 120, y: 110 },
      { id: "c", x: 500, y: 300 },
      { id: "d", x: 500, y: 300 },
      { id: "e", x: 900, y: 600 },
    ];
    const original = structuredClone(points);
    const groups = clusterMapPoints(points, 64);
    expect(groups.map((group) => group.members.length)).toEqual([2, 2, 1]);
    expect(
      groups
        .flatMap((group) => group.members)
        .map((p) => p.id)
        .sort(),
    ).toEqual(points.map((p) => p.id));
    expect(points).toEqual(original);
    expect(clusterMapPoints([...points].reverse(), 64)).toEqual(groups);
  });

  it("separates nearby spaces as their projected distance increases with zoom", () => {
    const points = [
      { id: "a", x: 100, y: 100 },
      { id: "b", x: 120, y: 110 },
    ];
    expect(clusterMapPoints(points, 64)).toHaveLength(1);
    expect(
      clusterMapPoints(
        points.map((point) => ({ ...point, x: point.x * 4, y: point.y * 4 })),
        64,
      ),
    ).toHaveLength(2);
    expect(clusterMapPoints([], 64)).toEqual([]);
  });

  it("shows up to three distinct project types without overlapping cards or controls", () => {
    const picks = pickMapHighlights(
      [
        { id: "control", x: 400, y: 100, kind: "Rooftop" },
        { id: "roof", x: 300, y: 300, kind: "Rooftop" },
        { id: "nearby", x: 350, y: 320, kind: "Parking" },
        { id: "another-roof", x: 700, y: 300, kind: "Rooftop" },
        { id: "parking", x: 700, y: 600, kind: "Parking" },
        { id: "storage", x: 1100, y: 300, kind: "Storage" },
      ],
      { width: 1400, height: 900 },
    );
    expect(picks.map((p) => p.id)).toEqual(["roof", "parking", "storage"]);
  });

  it("limits mobile recommendations and makes room for a selected asset", () => {
    const points = [
      { id: "a", x: 195, y: 300, kind: "Rooftop" },
      { id: "b", x: 195, y: 600, kind: "Parking" },
    ];
    expect(pickMapHighlights(points, { width: 390, height: 750 })).toHaveLength(
      1,
    );
    expect(
      pickMapHighlights(points, { width: 390, height: 750 }, [points[0]]).map(
        (p) => p.id,
      ),
    ).toEqual(["b"]);
  });
});
