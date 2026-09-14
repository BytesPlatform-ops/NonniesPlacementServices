import {
  areaCovers,
  effectivePostalCodes,
  haversineMiles,
  matchCoverage,
  overlappingPairs,
  stateCoverage,
  summarizeCoverage,
  toStateCode,
  type CoverageArea,
} from "./coverage-matching";

const area = (over: Partial<CoverageArea> = {}): CoverageArea => ({
  id: "a1",
  coverageType: "CITY",
  country: "US",
  state: "IL",
  county: null,
  city: "Chicago",
  postalCode: null,
  postalCodes: [],
  street: null,
  addressLine: null,
  latitude: null,
  longitude: null,
  radiusMiles: null,
  active: true,
  ...over,
});

// Real coordinates, so the distance assertions below mean something.
const CHICAGO = { latitude: 41.8781, longitude: -87.6298 };
const NAPERVILLE = { latitude: 41.7508, longitude: -88.1535 };
const INDIANAPOLIS = { latitude: 39.7684, longitude: -86.1581 };

describe("a narrow area never implies a wider one", () => {
  it("covering Chicago does not cover the rest of Illinois", () => {
    const chicago = area({ coverageType: "CITY", city: "Chicago", state: "IL" });
    expect(areaCovers(chicago, { city: "Chicago", state: "IL" })).toBe(true);
    expect(areaCovers(chicago, { city: "Springfield", state: "IL" })).toBe(false);
  });

  it("covering one postal code does not cover the city it sits in", () => {
    const zip = area({ coverageType: "POSTAL_CODE", postalCodes: ["60601"], city: "Chicago" });
    expect(areaCovers(zip, { postalCode: "60601" })).toBe(true);
    expect(areaCovers(zip, { postalCode: "60620", city: "Chicago", state: "IL" })).toBe(false);
  });

  it("an address covers its own postal code and nothing else by name", () => {
    const address = area({
      coverageType: "ADDRESS",
      street: "123 Michigan Avenue",
      postalCodes: ["60601"],
      city: "Chicago",
    });
    expect(areaCovers(address, { postalCode: "60601" })).toBe(true);
    // Same city, different code: a building does not serve a whole city.
    expect(areaCovers(address, { city: "Chicago", state: "IL", postalCode: "60602" })).toBe(false);
  });

  it("explicit state coverage does cover every city in it", () => {
    const illinois = area({ coverageType: "STATE", state: "IL", city: null });
    expect(areaCovers(illinois, { city: "Chicago", state: "IL" })).toBe(true);
    expect(areaCovers(illinois, { city: "Springfield", state: "IL" })).toBe(true);
    expect(areaCovers(illinois, { city: "Indianapolis", state: "IN" })).toBe(false);
  });

  it("county coverage covers that county only", () => {
    const cook = area({ coverageType: "COUNTY", county: "Cook", state: "IL", city: null });
    expect(areaCovers(cook, { county: "Cook", state: "IL" })).toBe(true);
    expect(areaCovers(cook, { county: "DuPage", state: "IL" })).toBe(false);
  });

  it("distinguishes same-named counties in different states", () => {
    const lakeIL = area({ coverageType: "COUNTY", county: "Lake", state: "IL", city: null });
    expect(areaCovers(lakeIL, { county: "Lake", state: "IL" })).toBe(true);
    expect(areaCovers(lakeIL, { county: "Lake", state: "IN" })).toBe(false);
  });

  it("country coverage covers everything within that country", () => {
    const us = area({ coverageType: "COUNTRY", state: null, city: null });
    expect(areaCovers(us, { state: "TX", city: "Austin" })).toBe(true);
    expect(areaCovers(us, { country: "CA", state: "ON" })).toBe(false);
  });
});

describe("radius", () => {
  it("covers a nearby town the named fields would miss", () => {
    // Naperville is ~30 mi from Chicago: inside 35, outside 20.
    const wide = area({ coverageType: "RADIUS", city: "Chicago", radiusMiles: 35, ...CHICAGO });
    const narrow = area({ coverageType: "RADIUS", city: "Chicago", radiusMiles: 20, ...CHICAGO });
    expect(areaCovers(wide, { city: "Naperville", state: "IL", ...NAPERVILLE })).toBe(true);
    expect(areaCovers(narrow, { city: "Naperville", state: "IL", ...NAPERVILLE })).toBe(false);
  });

  it("is never applied without real coordinates on both sides", () => {
    // A city name is never turned into a coordinate.
    const noCentre = area({ coverageType: "RADIUS", city: "Chicago", radiusMiles: 50 });
    expect(areaCovers(noCentre, { city: "Naperville", ...NAPERVILLE })).toBe(false);

    const noSeekerPoint = area({ coverageType: "RADIUS", radiusMiles: 50, ...CHICAGO });
    expect(areaCovers(noSeekerPoint, { city: "Naperville", state: "IL" })).toBe(false);
  });

  it("measures a real distance", () => {
    const miles = haversineMiles(CHICAGO, INDIANAPOLIS);
    expect(miles).toBeGreaterThan(150);
    expect(miles).toBeLessThan(200);
  });
});

describe("postal codes", () => {
  it("prefers the list and falls back to the legacy single code", () => {
    expect(effectivePostalCodes({ postalCode: null, postalCodes: ["60601", "60602"] })).toEqual(["60601", "60602"]);
    expect(effectivePostalCodes({ postalCode: "60540", postalCodes: [] })).toEqual(["60540"]);
    expect(effectivePostalCodes({ postalCode: null, postalCodes: [] })).toEqual([]);
  });

  it("matches any code in the list", () => {
    const multi = area({ coverageType: "POSTAL_CODE", postalCodes: ["60601", "60602", "60603"] });
    for (const code of ["60601", "60602", "60603"]) {
      expect(areaCovers(multi, { postalCode: code })).toBe(true);
    }
    expect(areaCovers(multi, { postalCode: "60604" })).toBe(false);
  });
});

describe("state status for the schematic map", () => {
  it("is PARTIAL when only a city inside it is covered", () => {
    const map = stateCoverage([area({ coverageType: "CITY", city: "Chicago", state: "IL" })]);
    expect(map.get("IL")).toBe("PARTIAL");
    expect(map.has("IN")).toBe(false);
  });

  it("is FULL only when the state itself is named", () => {
    const map = stateCoverage([area({ coverageType: "STATE", state: "IL", city: null })]);
    expect(map.get("IL")).toBe("FULL");
  });

  it("does not downgrade a full state because a city is also listed", () => {
    const map = stateCoverage([
      area({ id: "a", coverageType: "STATE", state: "IL", city: null }),
      area({ id: "b", coverageType: "CITY", state: "IL", city: "Chicago" }),
    ]);
    expect(map.get("IL")).toBe("FULL");
  });

  it("ignores inactive areas entirely", () => {
    const map = stateCoverage([area({ coverageType: "CITY", state: "IL", active: false })]);
    expect(map.size).toBe(0);
  });

  it("never invents a state that has no record", () => {
    const map = stateCoverage([area({ coverageType: "COUNTRY", state: null, city: null })]);
    // A countrywide area names no state, so it upgrades nothing out of nothing.
    expect(map.size).toBe(0);
  });
});

describe("matching a provider as a whole", () => {
  const areas = [
    area({ id: "chicago", coverageType: "CITY", city: "Chicago", county: "Cook", state: "IL", postalCodes: ["60601"], radiusMiles: 25, ...CHICAGO }),
    area({ id: "naperville", coverageType: "POSTAL_CODE", city: "Naperville", county: "DuPage", state: "IL", postalCodes: ["60540"], radiusMiles: 20, ...NAPERVILLE }),
    area({ id: "lake", coverageType: "COUNTY", county: "Lake", state: "IL", city: null }),
  ];

  it("accepts a seeker inside a covered city", () => {
    expect(matchCoverage(areas, { city: "Chicago", state: "IL" }).eligible).toBe(true);
  });

  it("accepts a seeker by postal code alone", () => {
    expect(matchCoverage(areas, { postalCode: "60540" }).eligible).toBe(true);
  });

  it("rejects a seeker in another state", () => {
    expect(matchCoverage(areas, { city: "New York", state: "NY" }).eligible).toBe(false);
  });

  it("rejects an uncovered county in a covered state", () => {
    expect(matchCoverage(areas, { county: "Sangamon", state: "IL" }).eligible).toBe(false);
  });

  it("reports every area that matched, so overlaps stay visible", () => {
    // Chicago is inside its own city area and within Naperville's 20 mi? No —
    // but it IS inside the Chicago radius, which is the same area. Use a point
    // both radii reach.
    const between = { latitude: 41.82, longitude: -87.9 };
    const match = matchCoverage(areas, { ...between });
    expect(match.matchedAreaIds).toContain("chicago");
    expect(match.matchedAreaIds).toContain("naperville");
    expect(match.matchedAreaIds.length).toBe(2);
  });

  it("ignores deactivated areas", () => {
    const off = areas.map((a) => ({ ...a, active: false }));
    expect(matchCoverage(off, { city: "Chicago", state: "IL" }).eligible).toBe(false);
  });
});

describe("summary counts", () => {
  it("counts each level distinctly and scopes counties to their state", () => {
    const summary = summarizeCoverage([
      area({ id: "1", coverageType: "CITY", city: "Chicago", county: "Cook", state: "IL", postalCodes: ["60601", "60602"], radiusMiles: 25 }),
      area({ id: "2", coverageType: "POSTAL_CODE", city: "Naperville", county: "DuPage", state: "IL", postalCodes: ["60540"], radiusMiles: 20 }),
      area({ id: "3", coverageType: "COUNTY", county: "Lake", state: "IL", city: null }),
      area({ id: "4", coverageType: "ADDRESS", street: "123 Michigan Ave", city: "Chicago", county: "Cook", state: "IL", postalCodes: ["60601"], radiusMiles: 10 }),
      area({ id: "5", coverageType: "COUNTY", county: "Lake", state: "IN", city: null }),
    ]);
    expect(summary.states).toBe(2);
    // Lake IL and Lake IN are different counties.
    expect(summary.counties).toBe(4);
    expect(summary.cities).toBe(2);
    expect(summary.postalCodes).toBe(3);
    expect(summary.addresses).toBe(1);
    expect(summary.radiusAreas).toBe(3);
    expect(summary.totalActive).toBe(5);
    expect(summary.countrywide).toBe(false);
  });

  it("excludes inactive areas from every count", () => {
    const summary = summarizeCoverage([area({ active: false })]);
    expect(summary.totalActive).toBe(0);
    expect(summary.states).toBe(0);
  });
});

describe("overlaps are reported, never resolved", () => {
  it("finds two radii that reach each other", () => {
    const pairs = overlappingPairs([
      area({ id: "chicago", radiusMiles: 25, ...CHICAGO }),
      area({ id: "naperville", radiusMiles: 20, ...NAPERVILLE }),
    ]);
    expect(pairs).toEqual([["chicago", "naperville"]]);
  });

  it("finds none when they are far apart", () => {
    expect(
      overlappingPairs([
        area({ id: "chicago", radiusMiles: 25, ...CHICAGO }),
        area({ id: "indy", radiusMiles: 25, ...INDIANAPOLIS }),
      ]),
    ).toEqual([]);
  });

  it("cannot compute an overlap without coordinates, and says nothing", () => {
    expect(overlappingPairs([area({ id: "a", radiusMiles: 25 }), area({ id: "b", radiusMiles: 20 })])).toEqual([]);
  });
});

describe("state names and codes are the same state", () => {
  it("resolves either form to one code", () => {
    expect(toStateCode("Illinois")).toBe("IL");
    expect(toStateCode("il")).toBe("IL");
    expect(toStateCode("New York")).toBe("NY");
    expect(toStateCode("")).toBe("");
  });

  it("matches a seeker in IL against an area entered as Illinois", () => {
    // Real rows arrive both ways; a provider should not fail to match because
    // of how the form was filled in.
    const spelled = area({ coverageType: "STATE", state: "Illinois", city: null });
    expect(areaCovers(spelled, { state: "IL", city: "Chicago" })).toBe(true);
    expect(areaCovers(spelled, { state: "IN" })).toBe(false);
  });

  it("puts a spelled-out state on the right map tile", () => {
    const map = stateCoverage([area({ coverageType: "STATE", state: "Texas", city: null })]);
    expect(map.get("TX")).toBe("FULL");
  });

  it("counts a state once however it was written", () => {
    const summary = summarizeCoverage([
      area({ id: "1", coverageType: "CITY", state: "Illinois", city: "Chicago" }),
      area({ id: "2", coverageType: "CITY", state: "IL", city: "Naperville" }),
    ]);
    expect(summary.states).toBe(1);
  });
});
