export interface MapPoint {
  id: string;
  x: number;
  y: number;
}

export interface MapCluster {
  x: number;
  y: number;
  members: MapPoint[];
}

/** Candidates arrive in funding-progress order; prefer a mix of asset types
 * and leave room for the map controls and each expanded project card. */
export function pickMapHighlights(
  candidates: (MapPoint & { kind: string })[],
  viewport: { width: number; height: number },
  reserved: MapPoint[] = [],
) {
  const limit = viewport.width < 640 ? 1 : 3;
  const picks: typeof candidates = [];
  const kinds = new Set<string>();
  for (const diverse of [true, false]) {
    for (const point of candidates) {
      if (picks.length >= limit) return picks;
      if (picks.includes(point) || (diverse && kinds.has(point.kind))) continue;
      if (
        point.x < 140 ||
        point.x > viewport.width - 140 ||
        point.y < 235 ||
        point.y > viewport.height - 85
      )
        continue;
      if (
        [...reserved, ...picks].some(
          (other) =>
            Math.abs(point.x - other.x) < 280 &&
            Math.abs(point.y - other.y) < 145,
        )
      )
        continue;
      picks.push(point);
      kinds.add(point.kind);
    }
  }
  return picks;
}

/** Group visual neighbours in screen space, including a pitched map's horizon.
 * Sorting makes the same viewport independent of API result order. Asset
 * coordinates are never moved; a group's centre is only its count label.
 */
export function clusterMapPoints(
  points: MapPoint[],
  radius: number,
): MapCluster[] {
  const groups: MapCluster[] = [];
  for (const point of [...points].sort((a, b) =>
    a.id < b.id ? -1 : a.id > b.id ? 1 : 0,
  )) {
    let nearest: MapCluster | undefined;
    let distance = radius * radius;
    for (const group of groups) {
      const candidate = (group.x - point.x) ** 2 + (group.y - point.y) ** 2;
      if (candidate < distance) {
        nearest = group;
        distance = candidate;
      }
    }
    if (!nearest) {
      groups.push({ x: point.x, y: point.y, members: [point] });
      continue;
    }
    const count = nearest.members.length;
    nearest.x = (nearest.x * count + point.x) / (count + 1);
    nearest.y = (nearest.y * count + point.y) / (count + 1);
    nearest.members.push(point);
  }
  return groups;
}
