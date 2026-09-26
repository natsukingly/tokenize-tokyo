import { ASSET_KINDS, SPACE_TYPES, type AssetKind } from "./catalog";

/** Fictional spaces for demo scenarios, never evidence of real vacancies. */
interface DemoSite {
  name: string;
  district: string;
  coordinates: [number, number];
  area: number;
  capacity: number;
  description: string;
  kind: AssetKind;
  activated?: boolean;
  revenue?: boolean;
  subscribed?: number;
  historyDay?: number;
}
const BASE_SITES: DemoSite[] = [
  {
    name: "Nihonbashi Solar Roof",
    district: "NIHONBASHI · CHUO",
    coordinates: [139.7748, 35.6842] as [number, number],
    area: 420,
    capacity: 72,
    description:
      "An underused rooftop can become a neighborhood source of clean energy.",
    kind: "Rooftop",
  },
  {
    name: "Kanda Community Solar",
    district: "KANDA · CHIYODA",
    coordinates: [139.769, 35.694] as [number, number],
    area: 310,
    capacity: 48,
    description:
      "Turn unused roof space into a community-funded solar project.",
    kind: "Rooftop",
  },
  {
    name: "Kuramae Makers House",
    district: "KURAMAE · TAITO",
    coordinates: [139.7892, 35.7034] as [number, number],
    area: 96,
    capacity: 0,
    description:
      "A simulated vacant space, reimagined as a neighborhood workshop. No residential or property ownership is sold.",
    kind: "Vacant Home",
  },
  {
    name: "Yaesu Weekend Market",
    district: "YAESU · CHUO",
    coordinates: [139.7718, 35.6804],
    area: 180,
    capacity: 0,
    description:
      "An idle plot for a neighborhood pop-up market. Fixed-term land usage, not land ownership.",
    kind: "Idle Land",
  },
  {
    name: "Akihabara Parking Bay",
    district: "AKIHABARA · CHIYODA",
    coordinates: [139.7766, 35.6993],
    area: 12,
    capacity: 0,
    description:
      "A spare parking bay for one passenger vehicle. A 30-day usage right, not a share of parking revenue.",
    kind: "Parking",
  },
  {
    name: "Asakusabashi Storage",
    district: "ASAKUSABASHI · TAITO",
    coordinates: [139.7854, 35.6972],
    area: 24,
    capacity: 0,
    description:
      "Unused interior space for dry-goods storage. A 90-day usage right with restricted contents.",
    kind: "Storage",
  },
  {
    name: "Ningyocho Wall Canvas",
    district: "NINGYOCHO · CHUO",
    coordinates: [139.7818, 35.6874],
    area: 18,
    capacity: 0,
    description:
      "A wall panel for an approved local campaign. A 30-day advertising right with content and installation review.",
    kind: "Advertising",
  },
];

const districts: { name: string; ward: string; center: [number, number] }[] = [
  { name: "Shibuya", ward: "SHIBUYA", center: [139.704, 35.661] },
  { name: "Shinjuku", ward: "SHINJUKU", center: [139.706, 35.695] },
  { name: "Ueno", ward: "TAITO", center: [139.781, 35.713] },
  { name: "Ryogoku", ward: "SUMIDA", center: [139.797, 35.697] },
  { name: "Shibaura", ward: "MINATO", center: [139.751, 35.643] },
  { name: "Meguro", ward: "MEGURO", center: [139.711, 35.634] },
];
const suffixes: Record<AssetKind, string> = {
  Rooftop: "Community Solar Roof",
  "Vacant Home": "Makers House",
  "Idle Land": "Pop-up Garden",
  Parking: "Shared Parking Bay",
  Storage: "Neighborhood Storage",
  Advertising: "Wall Canvas",
  Other: "Community Kitchen",
};
const sizes: Record<AssetKind, number> = {
  Rooftop: 320,
  "Vacant Home": 80,
  "Idle Land": 150,
  Parking: 12,
  Storage: 25,
  Advertising: 18,
  Other: 45,
};
// Separate examples preserve the existing fundraising walkthrough and saved holdings.
const ACTIVATED_SITES: DemoSite[] = [
  {
    name: "Kodenmacho Operating Solar Roof",
    district: "KODENMACHO · CHUO",
    coordinates: [139.7794, 35.6922],
    area: 360,
    capacity: 60,
    kind: "Rooftop",
    activated: true,
    description:
      "Simulated operating project: solar panels are already installed and generation has begun. Activation is a demo status, not a verified real installation. Revenue becomes claimable only after a deposit.",
  },
  {
    name: "Okachimachi Operating Solar Roof",
    district: "OKACHIMACHI · TAITO",
    coordinates: [139.7747, 35.7066],
    area: 240,
    capacity: 40,
    kind: "Rooftop",
    activated: true,
    description:
      "Simulated operating rooftop with an installed solar array. Compare this with roofs still awaiting funding. No revenue or return is implied by the Active status.",
  },
  {
    name: "Bakurocho Reopened Makers House",
    district: "BAKUROCHO · CHUO",
    coordinates: [139.7825, 35.6937],
    area: 88,
    capacity: 0,
    kind: "Vacant Home",
    activated: true,
    description:
      "Simulated reactivation: a formerly vacant house has been repaired and opened as a workshop. The fixed-term usage right covers workshop use, not property ownership. Physical handover is simulated.",
  },
  {
    name: "Higashi-kanda Operating Storage",
    district: "HIGASHI-KANDA · CHIYODA",
    coordinates: [139.7806, 35.6979],
    area: 32,
    capacity: 0,
    kind: "Storage",
    activated: true,
    description:
      "Simulated reactivation: an unused interior has been fitted out and opened for dry-goods storage. The 90-day right grants restricted storage use. Operation and site checks are simulated.",
  },
];

export const DEMO_CATALOG_VERSION = 5;
export const CORE_DEMO_SITES: DemoSite[] = [
  ...BASE_SITES,
  ...districts.flatMap((district, districtIndex) =>
    ASSET_KINDS.map((kind, kindIndex) => {
      const area = sizes[kind] + (kind === "Parking" ? 0 : districtIndex * 4);
      return {
        name: `${district.name} ${suffixes[kind]}`,
        district: `${district.name.toUpperCase()} · ${district.ward}`,
        coordinates: [
          district.center[0] + ((kindIndex % 3) - 1) * 0.0028,
          district.center[1] + (Math.floor(kindIndex / 3) - 1) * 0.0022,
        ] as [number, number],
        area,
        capacity: kind === "Rooftop" ? Math.round(area * 0.17) : 0,
        description: `Fictional ${kind.toLowerCase()} opportunity in ${district.name}. ${SPACE_TYPES[kind].terms} Location and dimensions are simulated.`,
        kind,
      };
    }),
  ),
  ...ACTIVATED_SITES,
];

// Keep the original catalog stable for transaction journals and existing tours.
// The expanded browser dataset never changes the on-chain seed manifest.
const CENTRAL_DISTRICTS: [string, string, number, number][] = [
  ["Kanda", "CHIYODA", 139.769, 35.694],
  ["Nihonbashi", "CHUO", 139.774, 35.684],
  ["Akihabara", "CHIYODA", 139.773, 35.699],
  ["Kuramae", "TAITO", 139.791, 35.704],
  ["Asakusabashi", "TAITO", 139.786, 35.698],
  ["Ningyocho", "CHUO", 139.782, 35.686],
  ["Ginza", "CHUO", 139.766, 35.671],
  ["Yaesu", "CHUO", 139.77, 35.68],
  ["Hongo", "BUNKYO", 139.76, 35.708],
  ["Shimbashi", "MINATO", 139.758, 35.667],
  ["Toranomon", "MINATO", 139.748, 35.669],
  ["Tsukishima", "CHUO", 139.784, 35.667],
];
export const DEMO_SITES: DemoSite[] = [
  ...CORE_DEMO_SITES,
  ...Array.from({ length: CORE_DEMO_SITES.length * 4 }, (_, index) => {
    const kind = ASSET_KINDS[index % ASSET_KINDS.length];
    const [district, ward, lng, lat] =
      CENTRAL_DISTRICTS[index % CENTRAL_DISTRICTS.length];
    const revenue = kind === "Rooftop" || index % 3 === 0;
    const activated = index % 4 === 0;
    const area = sizes[kind] + (index % 9) * 8;
    return {
      name: `${district} ${suffixes[kind]} ${String(index + 1).padStart(3, "0")} · Demo`,
      district: `${district.toUpperCase()} · ${ward}`,
      coordinates: [
        lng + Math.sin(index * 2.4) * 0.0038,
        lat + Math.cos(index * 2.4) * 0.0028,
      ] as [number, number],
      kind,
      area,
      capacity: kind === "Rooftop" ? Math.round(area * 0.17) : 0,
      revenue,
      activated,
      subscribed: revenue
        ? [0, 15, 35, 60, 85, 100][Math.floor(index / 3) % 6]
        : 0,
      historyDay: (index * 11 + Math.floor(index / 7)) % 28,
      description: `Simulated ${activated ? "operating" : "planned"} ${kind.toLowerCase()} project. ${revenue ? "Revenue shares cover only income deposited by this project; no physical usage permission or guaranteed return." : SPACE_TYPES[kind].terms} This is a fictional location and scenario.`,
    };
  }),
];
