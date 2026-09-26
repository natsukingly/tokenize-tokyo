export type DormantKind = "Rooftop" | "Vacant Home" | "Idle Land";
export type LensKind = "All assets" | DormantKind;
export interface DormantSite {
  id: string;
  name: string;
  district: string;
  kind: DormantKind;
  coordinates: [number, number];
  area: number;
  capacity: number;
}
export const DORMANT_DATASET_LABEL = "Demo dataset · not real listings";
export const DORMANT_BOUNDS = {
  west: 139.735,
  east: 139.8,
  south: 35.665,
  north: 35.715,
};
// Rough neighbourhood centres [lng, lat] · ward. Demo only; not surveyed data.
const DISTRICTS: [string, string, number, number][] = [
  ["Marunouchi", "CHIYODA", 139.764, 35.681],
  ["Nihonbashi", "CHUO", 139.774, 35.684],
  ["Kanda", "CHIYODA", 139.769, 35.694],
  ["Akihabara", "CHIYODA", 139.773, 35.699],
  ["Kuramae", "TAITO", 139.791, 35.704],
  ["Asakusabashi", "TAITO", 139.786, 35.698],
  ["Ningyocho", "CHUO", 139.782, 35.686],
  ["Kyobashi", "CHUO", 139.77, 35.677],
  ["Ginza", "CHUO", 139.766, 35.671],
  ["Yaesu", "CHUO", 139.77, 35.68],
  ["Hongo", "BUNKYO", 139.76, 35.708],
  ["Ochanomizu", "CHIYODA", 139.765, 35.7],
  ["Iwamoto-cho", "CHIYODA", 139.776, 35.695],
  ["Bakurocho", "CHUO", 139.782, 35.693],
  ["Hatchobori", "CHUO", 139.778, 35.675],
  ["Tsukishima", "CHUO", 139.784, 35.667],
  ["Shimbashi", "MINATO", 139.758, 35.667],
  ["Toranomon", "MINATO", 139.748, 35.669],
];
function mulberry32(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function generateDormantSites(
  count = 750,
  seed = 20260926,
): DormantSite[] {
  const rand = mulberry32(seed),
    { west, east, south, north } = DORMANT_BOUNDS,
    clamp = (v: number, lo: number, hi: number) =>
      Math.min(hi, Math.max(lo, v));
  return Array.from({ length: count }, (_, i) => {
    const [place, ward, lng, lat] =
        DISTRICTS[Math.floor(rand() * DISTRICTS.length)],
      r = rand(),
      kind: DormantKind =
        r < 0.55 ? "Rooftop" : r < 0.85 ? "Vacant Home" : "Idle Land",
      area =
        kind === "Rooftop"
          ? 120 + Math.round(rand() * 780)
          : kind === "Vacant Home"
            ? 60 + Math.round(rand() * 160)
            : 150 + Math.round(rand() * 1050);
    return {
      id: "d" + (i + 1),
      name: place + " " + kind.toLowerCase() + " " + (i + 1),
      district: place.toUpperCase() + " · " + ward,
      kind,
      coordinates: [
        Number(clamp(lng + (rand() - 0.5) * 0.009, west, east).toFixed(6)),
        Number(clamp(lat + (rand() - 0.5) * 0.007, south, north).toFixed(6)),
      ],
      area,
      capacity: kind === "Rooftop" ? Math.round(area * 0.16) : 0,
    };
  });
}
export const DORMANT_SITES = generateDormantSites();
export const lensMatch = (s: DormantSite, kind: string) =>
  kind === "All assets" || s.kind === kind;
export const dormantCount = (kind: string, sites = DORMANT_SITES) =>
  sites.filter((s) => lensMatch(s, kind)).length;
