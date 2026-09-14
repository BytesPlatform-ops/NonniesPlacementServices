import type { CoverageType } from "@prisma/client";

/**
 * Provider geographic coverage: what a provider promises, and whether a given
 * location falls inside it.
 *
 * Pure functions over plain data, deliberately: the same rules decide the
 * provider's own map, the staff provider search, the marketplace and the public
 * directory, and a rule that lived in a query would have to be restated in each
 * of them.
 *
 * Two principles run through everything here.
 *
 *  1. A narrow area never implies a wide one. "Chicago" does not make Illinois
 *     covered; ZIP 60601 does not make Chicago covered. Only an explicit STATE
 *     or COUNTRY area covers everything beneath it.
 *  2. Nothing is inferred that was not entered. A city name is never turned
 *     into a coordinate, so a radius is only ever applied when a real latitude
 *     and longitude were supplied for both sides.
 */

export interface CoverageArea {
  id: string;
  coverageType: CoverageType;
  country: string;
  state: string | null;
  county: string | null;
  city: string | null;
  postalCode: string | null;
  postalCodes: string[];
  street: string | null;
  addressLine: string | null;
  latitude: number | null;
  longitude: number | null;
  radiusMiles: number | null;
  active: boolean;
}

/** Where the person needing care is. Every field is optional. */
export interface SeekerLocation {
  country?: string | null;
  state?: string | null;
  county?: string | null;
  city?: string | null;
  postalCode?: string | null;
  latitude?: number | null;
  longitude?: number | null;
}

export type StateCoverage = "FULL" | "PARTIAL" | "NONE";

const norm = (value: string | null | undefined): string => (value ?? "").trim().toLowerCase();

/**
 * Full state names, so a value entered either way resolves to one code.
 *
 * Real data arrives both ways — a form filled in as "Illinois" and one filled
 * in as "IL" mean the same state, and the map and the matcher both key on the
 * code. Normalising at the edge is what makes existing rows work without
 * rewriting them.
 */
const STATE_CODE_BY_NAME: Record<string, string> = {
  alabama: "AL", alaska: "AK", arizona: "AZ", arkansas: "AR", california: "CA", colorado: "CO",
  connecticut: "CT", delaware: "DE", florida: "FL", georgia: "GA", hawaii: "HI", idaho: "ID",
  illinois: "IL", indiana: "IN", iowa: "IA", kansas: "KS", kentucky: "KY", louisiana: "LA",
  maine: "ME", maryland: "MD", massachusetts: "MA", michigan: "MI", minnesota: "MN",
  mississippi: "MS", missouri: "MO", montana: "MT", nebraska: "NE", nevada: "NV",
  "new hampshire": "NH", "new jersey": "NJ", "new mexico": "NM", "new york": "NY",
  "north carolina": "NC", "north dakota": "ND", ohio: "OH", oklahoma: "OK", oregon: "OR",
  pennsylvania: "PA", "rhode island": "RI", "south carolina": "SC", "south dakota": "SD",
  tennessee: "TN", texas: "TX", utah: "UT", vermont: "VT", virginia: "VA", washington: "WA",
  "west virginia": "WV", wisconsin: "WI", wyoming: "WY",
};

/** A two-letter code from either a code or a full state name. */
export function toStateCode(value: string | null | undefined): string {
  const raw = (value ?? "").trim();
  if (!raw) return "";
  if (raw.length === 2) return raw.toUpperCase();
  return STATE_CODE_BY_NAME[raw.toLowerCase()] ?? raw.toUpperCase();
}
const upper = (value: string | null | undefined): string => (value ?? "").trim().toUpperCase();

/**
 * Every postal code an area covers.
 *
 * `postalCodes` is authoritative; the legacy single `postalCode` is the
 * fallback for rows written before the list existed.
 */
export function effectivePostalCodes(area: Pick<CoverageArea, "postalCode" | "postalCodes">): string[] {
  const list = area.postalCodes?.filter((code) => code.trim().length > 0) ?? [];
  if (list.length > 0) return [...new Set(list.map(upper))];
  return area.postalCode?.trim() ? [upper(area.postalCode)] : [];
}

/** Great-circle distance in miles. Used only when both sides have coordinates. */
export function haversineMiles(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number },
): number {
  const R = 3958.7613; // mean Earth radius, miles
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** True when the location is inside this area's radius, if it has a usable one. */
export function withinRadius(area: CoverageArea, location: SeekerLocation): boolean {
  if (!area.radiusMiles || area.latitude === null || area.longitude === null) return false;
  if (location.latitude === null || location.latitude === undefined) return false;
  if (location.longitude === null || location.longitude === undefined) return false;
  const distance = haversineMiles(
    { latitude: area.latitude, longitude: area.longitude },
    { latitude: location.latitude, longitude: location.longitude },
  );
  return distance <= area.radiusMiles;
}

/**
 * Does one active coverage area cover this location?
 *
 * The country must agree first — a state code means nothing across borders.
 * After that each type is judged on its own terms, from widest to narrowest,
 * and a radius can rescue a location that the named fields miss (a neighbouring
 * town inside 25 miles of the centre).
 */
export function areaCovers(area: CoverageArea, location: SeekerLocation): boolean {
  if (!area.active) return false;

  // Country: an unspecified seeker country is assumed to be the area's own, so
  // a US-only platform does not have to state it everywhere.
  if (location.country && upper(area.country) !== upper(location.country)) return false;

  switch (area.coverageType) {
    case "COUNTRY":
      return true;

    case "STATE":
      return Boolean(area.state) && toStateCode(area.state) === toStateCode(location.state);

    case "COUNTY":
      // A county name is only unique within its state, so both must match.
      return (
        Boolean(area.county) &&
        norm(area.county) === norm(location.county) &&
        (!area.state || !location.state || toStateCode(area.state) === toStateCode(location.state))
      );

    case "CITY":
      if (
        Boolean(area.city) &&
        norm(area.city) === norm(location.city) &&
        (!area.state || !location.state || toStateCode(area.state) === toStateCode(location.state))
      ) {
        return true;
      }
      return withinRadius(area, location);

    case "POSTAL_CODE":
      if (location.postalCode && effectivePostalCodes(area).includes(upper(location.postalCode))) return true;
      return withinRadius(area, location);

    case "ADDRESS":
      // A single address covers only what its radius reaches, plus the exact
      // postal code it sits in. Nobody is served by a building alone.
      if (location.postalCode && effectivePostalCodes(area).includes(upper(location.postalCode))) return true;
      return withinRadius(area, location);

    case "RADIUS":
      return withinRadius(area, location);

    default:
      return false;
  }
}

export interface CoverageMatch {
  eligible: boolean;
  /** Every area that covers the location — overlaps are reported, not collapsed. */
  matchedAreaIds: string[];
}

/** Whether a provider's coverage reaches a location, and which areas did it. */
export function matchCoverage(areas: CoverageArea[], location: SeekerLocation): CoverageMatch {
  const matched = areas.filter((area) => areaCovers(area, location));
  return { eligible: matched.length > 0, matchedAreaIds: matched.map((a) => a.id) };
}

/**
 * How completely each state is covered, for the schematic map.
 *
 * FULL only when an area explicitly says so — a STATE area, or a COUNTRY area
 * that contains it. Anything narrower leaves the state PARTIAL, which is the
 * distinction the map exists to show.
 */
export function stateCoverage(areas: CoverageArea[]): Map<string, StateCoverage> {
  const result = new Map<string, StateCoverage>();
  const active = areas.filter((a) => a.active);

  for (const area of active) {
    const code = toStateCode(area.state);
    if (!code) continue;
    if (area.coverageType === "STATE") result.set(code, "FULL");
    else if (!result.has(code)) result.set(code, "PARTIAL");
  }

  // A country-wide area covers every state it names — but it cannot name them,
  // so it only upgrades states already known from other areas. States with no
  // record at all stay absent: the map must not invent coverage.
  if (active.some((a) => a.coverageType === "COUNTRY")) {
    for (const code of result.keys()) result.set(code, "FULL");
  }
  return result;
}

export interface CoverageSummary {
  states: number;
  counties: number;
  cities: number;
  postalCodes: number;
  addresses: number;
  radiusAreas: number;
  totalActive: number;
  countrywide: boolean;
}

/** The counts shown at the top of the provider's coverage page. */
export function summarizeCoverage(areas: CoverageArea[]): CoverageSummary {
  const active = areas.filter((a) => a.active);
  const states = new Set<string>();
  const counties = new Set<string>();
  const cities = new Set<string>();
  const postalCodes = new Set<string>();

  for (const area of active) {
    if (area.state) states.add(toStateCode(area.state));
    // Scoped by state, so "Lake County, IL" and "Lake County, IN" count twice.
    if (area.county) counties.add(`${norm(area.county)}|${toStateCode(area.state)}`);
    if (area.city) cities.add(`${norm(area.city)}|${toStateCode(area.state)}`);
    for (const code of effectivePostalCodes(area)) postalCodes.add(code);
  }

  return {
    states: states.size,
    counties: counties.size,
    cities: cities.size,
    postalCodes: postalCodes.size,
    addresses: active.filter((a) => a.coverageType === "ADDRESS").length,
    radiusAreas: active.filter((a) => a.radiusMiles !== null && a.radiusMiles > 0).length,
    totalActive: active.length,
    countrywide: active.some((a) => a.coverageType === "COUNTRY"),
  };
}

/**
 * Pairs of areas whose radii overlap.
 *
 * Reported so the provider can see it, never acted on: both records stay, and
 * neither is merged or removed. Only computable when both have coordinates.
 */
export function overlappingPairs(areas: CoverageArea[]): Array<[string, string]> {
  const withCentre = areas.filter(
    (a) => a.active && a.radiusMiles && a.latitude !== null && a.longitude !== null,
  );
  const pairs: Array<[string, string]> = [];
  for (let i = 0; i < withCentre.length; i += 1) {
    for (let j = i + 1; j < withCentre.length; j += 1) {
      const a = withCentre[i]!;
      const b = withCentre[j]!;
      const distance = haversineMiles(
        { latitude: a.latitude!, longitude: a.longitude! },
        { latitude: b.latitude!, longitude: b.longitude! },
      );
      if (distance < (a.radiusMiles ?? 0) + (b.radiusMiles ?? 0)) pairs.push([a.id, b.id]);
    }
  }
  return pairs;
}
