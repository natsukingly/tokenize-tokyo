import type { AssetKind } from "./catalog";

export type ProjectAssumptions = {
  initialCost: number;
  annualRevenue: number;
  annualCosts: number;
  distributionPercent: number;
};
// AI-authored illustrative drafts, deliberately not presented as live AI/site analysis.
const concepts: Record<
  AssetKind,
  {
    use: string;
    customers: string;
    operations: string;
    costs: string;
    checks: string;
    budget: ProjectAssumptions;
  }
> = {
  Rooftop: {
    use: "Install a small rooftop solar project and share the cash it actually generates.",
    customers: "The building's electricity users or a contracted power buyer.",
    operations:
      "An appointed operator maintains the equipment, monitors generation and reports metered sales monthly.",
    costs:
      "Panels, installation, grid connection, insurance, maintenance and an equipment replacement reserve.",
    checks:
      "Roof loading, waterproofing, shading, grid access and a signed power purchase arrangement.",
    budget: {
      initialCost: 6000000,
      annualRevenue: 900000,
      annualCosts: 240000,
      distributionPercent: 80,
    },
  },
  "Vacant Home": {
    use: "Refit an unused interior as a bookable neighborhood workshop and small event space.",
    customers:
      "Local makers, instructors and small businesses booking sessions.",
    operations:
      "The operator schedules sessions, manages access and cleaning, and records paid bookings.",
    costs:
      "Safety upgrades, fit-out, utilities, cleaning, insurance and operator compensation.",
    checks:
      "Owner consent, permitted use, fire safety, accessibility and evidence of local demand.",
    budget: {
      initialCost: 3500000,
      annualRevenue: 2400000,
      annualCosts: 1680000,
      distributionPercent: 70,
    },
  },
  "Idle Land": {
    use: "Operate a temporary market with bookable vendor pitches on an unused plot.",
    customers:
      "Food vendors, local retailers and organizers of weekend events.",
    operations:
      "The operator recruits vendors, organizes site access, utilities and cleanup, and reports pitch fees.",
    costs:
      "Surface preparation, temporary utilities, permits, insurance, staffing and waste collection.",
    checks:
      "Permitted land use, drainage, public access, noise limits and vendor commitments.",
    budget: {
      initialCost: 1800000,
      annualRevenue: 2160000,
      annualCosts: 1620000,
      distributionPercent: 70,
    },
  },
  Parking: {
    use: "Make unused parking capacity available through clearly scheduled, paid bookings.",
    customers: "Nearby residents, businesses and visiting drivers.",
    operations:
      "The operator handles bookings, access control and occupancy reports, with enforcement of the permitted vehicle limits.",
    costs:
      "Access equipment, signage, payment processing, maintenance and management.",
    checks:
      "Legal vehicle access, bay dimensions, utilization evidence and the owner's operating agreement.",
    budget: {
      initialCost: 900000,
      annualRevenue: 1080000,
      annualCosts: 780000,
      distributionPercent: 75,
    },
  },
  Storage: {
    use: "Convert suitable idle interior capacity into secure, bookable storage units.",
    customers: "Local retailers and households needing dry-goods storage.",
    operations:
      "The operator allocates units, verifies permitted contents and maintains access logs and occupancy records.",
    costs:
      "Partitions, security, insurance, utilities, cleaning and ongoing management.",
    checks:
      "Fire safety, humidity, access, insurance coverage and prohibited-goods procedures.",
    budget: {
      initialCost: 2400000,
      annualRevenue: 1800000,
      annualCosts: 1200000,
      distributionPercent: 75,
    },
  },
  Advertising: {
    use: "Offer a defined wall surface as a managed advertising placement.",
    customers: "Nearby shops and advertisers with approved creative material.",
    operations:
      "The operator sells placement periods, installs approved displays and records actual advertiser payments.",
    costs:
      "Mounting, installation, inspections, maintenance, sales commissions and insurance.",
    checks:
      "Signage permission, structural safety, visibility, content approval and advertiser demand.",
    budget: {
      initialCost: 1500000,
      annualRevenue: 1440000,
      annualCosts: 960000,
      distributionPercent: 75,
    },
  },
  Other: {
    use: "Create a bookable community use for the selected underused space.",
    customers:
      "Local organizations and operators with a defined temporary use.",
    operations:
      "Appoint an operator to manage bookings, access and a monthly cash report.",
    costs:
      "Site preparation, safety work, insurance, utilities and operator compensation.",
    checks:
      "Ownership evidence, permitted use, site safety and customer demand.",
    budget: {
      initialCost: 2000000,
      annualRevenue: 1500000,
      annualCosts: 1080000,
      distributionPercent: 70,
    },
  },
};
export function suggestedProject(kind: AssetKind, name: string) {
  const c = concepts[kind] || concepts.Other;
  return {
    overview: `PROJECT\n${name || "This space"}: ${c.use}\n\nCUSTOMERS & BUSINESS MODEL\n${c.customers} Revenue comes from completed sales or bookings, not token price appreciation.\n\nOPERATIONS & USE OF FUNDS\n${c.operations} Funding covers ${c.costs.toLowerCase()}\n\nLAUNCH PLAN\nConfirm rights and site suitability → obtain quotes and permits → appoint the operator → fund the agreed budget → prepare the site → record activation evidence and begin reporting.\n\nECONOMICS & RISKS\nThe editable scenario below estimates annual operating cash and a simple payback period. Demand can fall and costs can rise; a negative year may produce no distributions. ${c.checks} remain unverified.\n\nTOKEN HOLDER BENEFIT\nA revenue right can receive only the cash deposited under its agreed terms. A usage right grants the stated access, not passive income. This draft is a planning example, not an appraisal or a legal entitlement.`,
    assumptions: { ...c.budget },
  };
}
export function parseAssumptions(value: unknown): ProjectAssumptions | null {
  if (!value || typeof value !== "object") return null;
  const a = value as ProjectAssumptions;
  if (
    ![
      a.initialCost,
      a.annualRevenue,
      a.annualCosts,
      a.distributionPercent,
    ].every(Number.isFinite) ||
    a.initialCost <= 0 ||
    a.initialCost > 1e12 ||
    a.annualRevenue < 0 ||
    a.annualRevenue > 1e12 ||
    a.annualCosts < 0 ||
    a.annualCosts > 1e12 ||
    a.distributionPercent < 0 ||
    a.distributionPercent > 100
  )
    return null;
  return {
    initialCost: a.initialCost,
    annualRevenue: a.annualRevenue,
    annualCosts: a.annualCosts,
    distributionPercent: a.distributionPercent,
  };
}
export function projectScenarios(a: ProjectAssumptions) {
  if (!parseAssumptions(a)) return [];
  return [
    { name: "Conservative", sales: 0.65, cost: 1.2 },
    { name: "Base", sales: 1, cost: 1 },
    { name: "Strong", sales: 1.2, cost: 1.1 },
  ].map((s) => {
    const revenue = a.annualRevenue * s.sales,
      costs = a.annualCosts * s.cost,
      net = revenue - costs;
    return {
      name: s.name,
      revenue,
      costs,
      net,
      cashReturnPercent: (net / a.initialCost) * 100,
      paybackYears: net > 0 ? a.initialCost / net : null,
      distributable: (Math.max(0, net) * a.distributionPercent) / 100,
    };
  });
}
