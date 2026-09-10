import { compareServices, humanize, toProviderView, toRequirementView, toServiceView } from "./seeker.serializer";
import type { SeekerCaseRow, SeekerReferralRow } from "./seeker.serializer";

/** A provider row carrying every internal field the family must never see. */
function provider(overrides: Record<string, unknown> = {}) {
  return {
    id: "prov-1",
    organizationId: "SECRET-ORG-ID",
    displayName: "Angels of Cascades",
    description: "A warm adult family home.",
    publicDescription: "Warm, homely care in Tacoma.",
    publicFeaturedImageUrl: "https://cdn.example/photo.jpg",
    city: "Tacoma",
    state: "WA",
    phone: "253-555-0100",
    internalNotes: "SECRET internal staff note",
    eligibilityNotes: "SECRET eligibility commentary",
    licenseNumber: "SECRET-LIC-9999",
    licenseType: "AFH",
    status: "ACTIVE",
    services: [
      { serviceCategory: { id: "sc-1", code: "PERSONAL_CARE", name: "Personal Care" }, description: null, levelOfCare: "SUPPORTIVE" },
      { serviceCategory: { id: "sc-2", code: "SKILLED_NURSING", name: "Skilled Nursing" }, description: null, levelOfCare: null },
    ],
    languages: [{ language: { name: "English" } }, { language: { name: "English" } }],
    paymentTypes: [{ paymentType: { name: "Medicaid" } }],
    coverageAreas: [],
    hours: [],
    capacity: [{ status: "AVAILABLE", serviceCategoryId: null }],
    ...overrides,
  };
}

function referral(overrides: Record<string, unknown> = {}): SeekerReferralRow {
  return {
    id: "ref-1",
    status: "SENT",
    lastResponseAt: null,
    coordinationNote: "SECRET staff coordination note",
    provider: provider(),
    placement: null,
    serviceRequest: { id: "sr-1", category: "PERSONAL_CARE", serviceCategory: { name: "Personal Care" } },
    ...overrides,
  } as unknown as SeekerReferralRow;
}

const requestedServices = [
  { id: "sr-1", category: "PERSONAL_CARE", status: "MATCHING", serviceCategory: { id: "sc-1", code: "PERSONAL_CARE", name: "Personal Care" } },
  { id: "sr-2", category: "TRANSPORTATION", status: "REQUESTED", serviceCategory: null },
  { id: "sr-3", category: "HOSPICE", status: "CANCELLED", serviceCategory: null },
] as unknown as SeekerCaseRow["serviceRequests"];

describe("toProviderView", () => {
  const view = toProviderView(referral(), requestedServices);
  const serialized = JSON.stringify(view);

  it("shows the provider information a family needs", () => {
    expect(view.providerName).toBe("Angels of Cascades");
    expect(view.city).toBe("Tacoma");
    expect(view.summary).toBe("Warm, homely care in Tacoma.");
    expect(view.imageUrl).toBe("https://cdn.example/photo.jpg");
    expect(view.paymentTypes).toEqual(["Medicaid"]);
  });

  it("de-duplicates repeated language rows", () => {
    expect(view.languages).toEqual(["English"]);
  });

  // The central leak guard. Projecting field by field is what makes this hold.
  it("leaks no internal provider data", () => {
    expect(serialized).not.toContain("SECRET");
    for (const forbidden of [
      "internalNotes",
      "eligibilityNotes",
      "licenseNumber",
      "licenseType",
      "organizationId",
      "coordinationNote",
    ]) {
      expect(serialized).not.toContain(forbidden);
    }
  });

  it("exposes no bed count anywhere", () => {
    expect(serialized).not.toContain("availableCount");
    expect(serialized).not.toContain("capacity");
    // Only the human status survives.
    expect(view.availabilityLabel).toBe("Available");
  });

  it("compares requested services against what the provider offers", () => {
    expect(view.servicesCovered).toEqual(["Personal Care"]);
    expect(view.servicesNotCovered).toEqual(["Transportation"]);
  });

  it("carries no invented match percentage", () => {
    expect(serialized).not.toMatch(/matchScore|score|percent/i);
  });

  it("marks the accepted provider as selected", () => {
    expect(toProviderView(referral({ status: "ACCEPTED" }), requestedServices).isSelected).toBe(true);
    expect(view.isSelected).toBe(false);
  });
});

describe("compareServices", () => {
  it("ignores a cancelled request", () => {
    const { covered, notCovered } = compareServices(requestedServices, provider() as never);
    expect([...covered, ...notCovered]).not.toContain("Hospice");
  });

  it("matches on the category code even when the request is not linked to the catalog", () => {
    // `sr-2` has no serviceCategory row, so the stable enum has to carry it.
    const { notCovered } = compareServices(requestedServices, provider() as never);
    expect(notCovered).toContain("Transportation");
  });

  it("counts each service once", () => {
    const duplicated = [...requestedServices, requestedServices[0]!] as SeekerCaseRow["serviceRequests"];
    const { covered } = compareServices(duplicated, provider() as never);
    expect(covered).toEqual(["Personal Care"]);
  });
});

describe("toServiceView", () => {
  it("uses the catalog name and never a raw enum", () => {
    const view = toServiceView({
      id: "sr-1",
      category: "PERSONAL_CARE",
      status: "MATCHING",
      levelOfCare: "SUPPORTIVE",
      frequency: "Daily",
      requestedStartDate: new Date("2026-10-01T00:00:00Z"),
      serviceCategory: { id: "sc-1", code: "PERSONAL_CARE", name: "Personal Care" },
      referrals: [{ status: "ACCEPTED" }],
    } as never);
    expect(view.name).toBe("Personal Care");
    expect(view.levelOfCare).toBe("Supportive");
    expect(view.arrangementLabel).toBe("Confirmed");
  });

  it("renders the enum readably when no catalog row is linked", () => {
    const view = toServiceView({
      id: "sr-2",
      category: "PHYSICAL_THERAPY",
      status: "REQUESTED",
      levelOfCare: null,
      frequency: null,
      requestedStartDate: null,
      serviceCategory: null,
      referrals: [],
    } as never);
    expect(view.name).toBe("Physical Therapy");
    expect(view.name).not.toContain("_");
  });
});

describe("toRequirementView", () => {
  it("keeps the real mandatory flag and hides staff notes", () => {
    const view = toRequirementView({
      id: "req-1",
      label: "Proof of insurance",
      detail: "Front and back",
      category: "INSURANCE_FUNDING",
      status: "PENDING",
      mandatory: true,
      dueDate: null,
      notes: "SECRET staff working note",
      completedByUserId: "SECRET-USER",
    } as never);
    expect(view.mandatory).toBe(true);
    expect(view.statusLabel).toBe("Still needed");
    expect(view.category).toBe("Insurance Funding");
    expect(JSON.stringify(view)).not.toContain("SECRET");
  });
});

describe("humanize", () => {
  it("turns an enum into words", () => {
    expect(humanize("SKILLED_NURSING_FACILITY")).toBe("Skilled Nursing Facility");
    expect(humanize("TOUR")).toBe("Tour");
  });
});
