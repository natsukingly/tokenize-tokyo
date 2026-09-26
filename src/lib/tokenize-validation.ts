import { parseEther } from "viem";
import { metadataURI } from "./model";

type SpaceInput = {
  name: string;
  area: string;
  capacity: string;
  lng: string;
  lat: string;
};
type RightInput = {
  terms: string;
  evidence: string;
  purpose: string;
  supply: string;
  start: string;
  end: string;
  price: string;
};

export function spaceDraftError(form: SpaceInput): string {
  if (!form.name.trim()) return "Give this space a name.";
  if (
    !form.area.trim() ||
    !Number.isFinite(Number(form.area)) ||
    Number(form.area) <= 0
  )
    return "Enter a positive area in square meters.";
  if (!Number.isFinite(Number(form.capacity)) || Number(form.capacity) < 0)
    return "Enter a non-negative estimated capacity.";
  const lng = Number(form.lng),
    lat = Number(form.lat);
  if (
    !Number.isFinite(lng) ||
    !Number.isFinite(lat) ||
    lng < 138 ||
    lng > 141 ||
    lat < 34 ||
    lat > 37
  )
    return "Choose a location near Tokyo.";
  return "";
}

export function rightTermsURI(
  form: Pick<RightInput, "terms" | "evidence" | "purpose">,
) {
  return metadataURI({
    purpose: form.terms,
    evidence: form.evidence,
    simulated: true,
    permittedUse: form.purpose,
    repairConditions: "Issuer approval required for structural works.",
  });
}

function dateValue(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return NaN;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) &&
    date.toISOString().slice(0, 10) === value
    ? date.getTime()
    : NaN;
}

export function rightDraftError(form: RightInput, now = Date.now()): string {
  const start = dateValue(form.start),
    end = dateValue(form.end);
  if (
    !Number.isFinite(start) ||
    !Number.isFinite(end) ||
    end <= start ||
    end <= now
  )
    return "Choose valid dates with an end after the start and today.";
  if (
    !/^[0-9]{1,13}$/.test(form.supply) ||
    BigInt(form.supply) <= 0n ||
    BigInt(form.supply) > 1_000_000_000_000n
  )
    return "Choose a whole supply from 1 to 1,000,000,000,000.";
  try {
    if (
      !/^\d{1,59}(\.\d{1,18})?$/.test(form.price) ||
      parseEther(form.price) <= 0n ||
      parseEther(form.price) >= 2n ** 256n
    )
      return "Enter a positive price with at most 18 decimal places.";
  } catch {
    return "Enter a valid positive price.";
  }
  if (!form.terms.trim() || !form.purpose.trim())
    return "Add the terms and a permitted purpose.";
  if (new TextEncoder().encode(rightTermsURI(form)).length > 4096)
    return "Terms and evidence exceed the 4 KB limit. Shorten them before issuing rights.";
  return "";
}
