import { ASSET_KINDS, SPACE_TYPES } from "./catalog";
import { CORE_DEMO_SITES, DEMO_SITES } from "./demo-catalog";
import { compactMetadataURI, metadataURI } from "./model";

export const CITY_DATASET = "sepolia-city-200-v1";
export const CITY_STAGES = [
  "Draft",
  "Review pending",
  "Verified",
  "Funding open",
  "Partly funded",
  "Operating",
  "Usage listed",
] as const;

/** Additive, fictional catalog. Never rewrites the existing four Sepolia assets. */
export function cityPlan() {
  return DEMO_SITES.slice(
    CORE_DEMO_SITES.length,
    CORE_DEMO_SITES.length + 196,
  ).map((site, index) => {
    const stage = (Math.floor(index / 7) + (index % 7)) % 7;
    const revenue = stage >= 3 && stage <= 5;
    const subscription =
      stage === 4
        ? [25, 45, 65, 85][Math.floor(index / 7) % 4]
        : stage === 5
          ? 100
          : 0;
    const price = revenue
      ? [600, 900, 1200, 1800, 2400][index % 5]
      : Number(SPACE_TYPES[site.kind].price);
    const description = revenue
      ? `Fictional ${site.kind.toLowerCase()} business in ${site.district.split(" · ")[0]}. Fund preparation and operation through 100 income units. Holders share only deposited test income; the operator controls physical use. ${stage === 5 ? "Operation is simulated and an initial test income deposit is included." : "Preparation, owner consent and operating checks are simulated."} No guaranteed return or property ownership.`
      : `Fictional ${site.kind.toLowerCase()} space. ${SPACE_TYPES[site.kind].terms} Site dimensions and ownership checks are simulated. This test does not convey property ownership.`;
    const name = site.name.replace(/ · Demo$/, " · Sepolia Test");
    const metadata = compactMetadataURI({
      name,
      district: site.district,
      kind: site.kind,
      coordinates: site.coordinates.map((v) => Number(v.toFixed(6))),
      area: site.area,
      capacity: site.capacity,
      description,
      simulated: true,
      dataset: CITY_DATASET,
    });
    const terms = metadataURI({
      purpose: revenue
        ? `${site.kind} operating income`
        : SPACE_TYPES[site.kind].purpose,
      description: revenue
        ? "Proportional share of deposited test income. No exclusive use or guaranteed yield."
        : SPACE_TYPES[site.kind].terms,
      simulated: true,
    });
    return {
      key: `city-${String(index + 1).padStart(3, "0")}`,
      index,
      name,
      kind: site.kind,
      stage,
      stageName: CITY_STAGES[stage],
      revenue,
      supply: revenue ? 100 : 1,
      subscription,
      price,
      deposit: stage === 5 ? [1000, 1500, 2400, 3200][index % 4] : 0,
      investor: index % 2 === 0 ? "investorB" : "investorC",
      metadata,
      terms,
      scope: ["Rooftop", "Interior", "Wall", "Land", "Whole asset"].indexOf(
        SPACE_TYPES[site.kind].scope,
      ),
      purpose: SPACE_TYPES[site.kind].purpose,
    };
  });
}

export function cityPlanSummary() {
  const plan = cityPlan();
  return {
    dataset: CITY_DATASET,
    targetAssets: 200,
    preservedAssets: 4,
    additionalAssets: plan.length,
    kinds: Object.fromEntries(
      ASSET_KINDS.map((kind) => [
        kind,
        plan.filter((p) => p.kind === kind).length,
      ]),
    ),
    stages: Object.fromEntries(
      CITY_STAGES.map((stage) => [
        stage,
        plan.filter((p) => p.stageName === stage).length,
      ]),
    ),
    newRights: plan.filter((p) => p.stage >= 3).length,
    expectedNewVolume: plan.reduce(
      (sum, p) => sum + p.subscription * p.price,
      0,
    ),
    expectedNewDeposits: plan.reduce((sum, p) => sum + p.deposit, 0),
  };
}
