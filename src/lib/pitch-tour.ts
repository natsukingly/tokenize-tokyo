import type { MarketState } from "./model";
import { ACTORS } from "./demo";
import { eventIdentity, tourEvents } from "./tour";
import type { SpaceForm } from "@/components/TokenizeFlow";

export const PITCH_NAME = "Tokyo Home Solar Roof · Pitch";
export const PITCH_STEPS = [
  "discover",
  "define",
  "verify-asset",
  "issue",
  "verify-right",
  "publish",
  "purchase",
  "activate",
  "deposit",
  "claim",
  "resale",
  "dashboard",
  "proof",
  "finish",
] as const;
export type PitchStep = (typeof PITCH_STEPS)[number];

// Recorded public Sepolia run, independent of the browser simulation.
// Source: deployments/sepolia-demo-receipts.json (roof/purchase, roof/claim).
// Card purchase: deployments/card-checkout-hosted-verification.json.
export const PITCH_EVIDENCE = {
  card: {
    title: "Open CloudWallet purchase",
    hash: "0x8e5d49e8f3e84ccd479e039dbd2501fb1592c38455e6d12d1e930a1322dfffbc",
  },
  purchase: {
    title: "Open Sepolia purchase",
    hash: "0xb09ca5256562dfd44d3cd9aa8843d64188ef0f0604eb1f83c5bdb8c6c6f8b9b3",
  },
  claim: {
    title: "Open Sepolia revenue claim",
    hash: "0x5dc6545942d2ff6ea504954feaf4d50d13135c3fcc9db4cdab6c34319370e09e",
  },
} as const;
export const pitchEvidenceUrl = (kind: keyof typeof PITCH_EVIDENCE) =>
  `https://sepolia.etherscan.io/tx/${PITCH_EVIDENCE[kind].hash}`;

export function pitchForm(
  form: SpaceForm,
  state: MarketState,
  now = Date.now(),
): SpaceForm {
  // Find a fresh fictional location without deleting or changing previous demos.
  let lng = 139.775;
  while (
    state.assets.some(
      (a) =>
        Math.abs(a.coordinates[0] - lng) < 0.000001 &&
        Math.abs(a.coordinates[1] - 35.689) < 0.000001,
    )
  )
    lng = Number((lng + 0.00002).toFixed(5));
  return {
    ...form,
    name: PITCH_NAME,
    district: "TOKYO",
    kind: "Rooftop",
    right: "Revenue Share",
    area: "100",
    capacity: "20",
    supply: "100",
    price: "1000",
    scope: "Rooftop",
    purpose: "SOLAR",
    exclusive: "No",
    policy: "Open",
    lng: String(lng),
    lat: "35.689",
    start: new Date(now).toISOString().slice(0, 10),
    end: new Date(now + 365 * 86400000).toISOString().slice(0, 10),
    terms:
      "Receive a proportional share of revenue actually deposited by this solar project. No guaranteed yield.",
    evidence:
      "Fictional rooftop and simulated ownership review for this presentation.",
    overview:
      "Use an idle residential rooftop for a solar project. Participants buy revenue shares and receive a proportional share of deposited project income.",
    analysis: "null",
  };
}

export function pitchProgress(state: MarketState, baseline: Set<string>) {
  const changes = tourEvents(state.events, baseline);
  const registered = changes.find(
    (e) =>
      e.name === "AssetRegistered" &&
      String(e.args.issuer).toLowerCase() === ACTORS["Owner A"] &&
      state.assets.some(
        (a) => a.id === String(e.args.assetId) && a.name === PITCH_NAME,
      ),
  );
  const asset = state.assets.find(
    (a) => a.id === String(registered?.args.assetId),
  );
  const right = state.rights.find((r) => r.assetId === asset?.id);
  const event = (name: string, actor?: [string, string]) =>
    !!right &&
    changes.some(
      (e) =>
        e.name === name &&
        String(e.args.rightId) === right.id &&
        (!actor || String(e.args[actor[0]]).toLowerCase() === actor[1]),
    );
  const bought = event("ListingPurchased", ["buyer", ACTORS["Investor B"]]);
  return {
    asset,
    right,
    complete: {
      discover: true,
      define: !!asset && asset.status !== "Draft",
      "verify-asset": asset?.status === "Verified",
      issue: !!right,
      "verify-right": !!right && ["Verified", "Active"].includes(right.status),
      publish: event("ListingCreated", ["seller", ACTORS["Owner A"]]),
      purchase: bought,
      activate: right?.status === "Active",
      deposit: bought && event("RevenueDeposited"),
      claim: event("RevenueClaimed", ["holder", ACTORS["Investor B"]]),
      resale: event("ListingCreated", ["seller", ACTORS["Investor B"]]),
      dashboard: true,
      proof: false,
      finish: true,
    } satisfies Record<PitchStep, boolean>,
  };
}
export const pitchBaseline = (state: MarketState) =>
  new Set(state.events.map(eventIdentity));
