import {
  toProviderPublicCard,
  toProviderPublicDetail,
  type ProviderPublicCardRow,
  type ProviderPublicDetailRow,
} from "./public-provider.serializer";

describe("public provider serializer (no internal leakage)", () => {
  const detailRow = {
    id: "prov-1",
    organizationId: "org-1",
    displayName: "Sunrise Senior Living",
    description: "Internal-ish description",
    publicDescription: "A calm residential community.",
    publicSlug: "sunrise-senior-living",
    publicFeaturedImageUrl: "https://x.supabase.co/storage/v1/object/public/nonnis-content/providers/public/a.jpg",
    publicFeaturedImageStoragePath: "providers/public/a.jpg",
    internalNotes: "SECRET internal notes",
    eligibilityNotes: "SECRET eligibility",
    phone: "555-1000",
    email: "info@sunrise.example",
    website: "https://sunrise.example",
    city: "Sacramento",
    state: "CA",
    addressLine1: "1 Oak St",
    postalCode: "95814",
    status: "ACTIVE",
    services: [{ serviceCategory: { name: "Assisted Living" }, description: null, levelOfCare: "SUPPORTIVE" }],
    languages: [{ language: { name: "Spanish" } }],
    paymentTypes: [{ paymentType: { name: "Medicaid" } }],
    coverageAreas: [{ coverageType: "CITY", city: "Sacramento", county: null, state: "CA", postalCode: null, radiusMiles: null }],
    hours: [{ dayOfWeek: "MONDAY", closed: false, open24: false, opensAt: "08:00", closesAt: "17:00" }],
  } as unknown as ProviderPublicDetailRow;

  it("detail exposes only public fields and prefers the public description", () => {
    const view = toProviderPublicDetail(detailRow);
    const serialized = JSON.stringify(view);
    expect(serialized).not.toContain("SECRET");
    expect(serialized).not.toContain("internalNotes");
    expect(serialized).not.toContain("eligibilityNotes");
    expect(serialized).not.toContain("org-1");
    expect(view).not.toHaveProperty("id");
    expect(view).not.toHaveProperty("status");
    expect(view).not.toHaveProperty("featuredImageStoragePath");
    expect(view).not.toHaveProperty("publicFeaturedImageStoragePath");
    expect(view.description).toBe("A calm residential community.");
    expect(view.services).toEqual([{ name: "Assisted Living", levelOfCare: "SUPPORTIVE", description: null }]);
    expect(view.coverage).toEqual(["Sacramento, CA"]);
    expect(view.imageUrl).toContain("/providers/public/a.jpg"); // public URL only
  });

  it("card omits body-heavy and internal fields", () => {
    const cardRow = {
      displayName: "Sunrise",
      description: null,
      publicDescription: "Short summary",
      publicSlug: "sunrise",
      publicFeaturedImageUrl: null,
      city: "Reno",
      state: "NV",
      internalNotes: "SECRET",
      services: [{ serviceCategory: { name: "Memory Care" } }],
      languages: [{ language: { name: "English" } }],
      paymentTypes: [{ paymentType: { name: "Private Pay" } }, { paymentType: { name: "Medicaid" } }],
    } as unknown as ProviderPublicCardRow;
    const view = toProviderPublicCard(cardRow);
    expect(JSON.stringify(view)).not.toContain("SECRET");
    expect(view).not.toHaveProperty("phone");
    expect(view.services).toEqual(["Memory Care"]);
    expect(view.slug).toBe("sunrise");
    // Funding is public on the detail page, so the card carries it too — the
    // directory and homepage cards both display it.
    expect(view.paymentTypes).toEqual(["Private Pay", "Medicaid"]);
  });

  it("card still exposes no capacity, notes or internal identifiers", () => {
    // Capacity is deliberately never public: the homepage cannot show real bed
    // availability, so it must not claim any.
    const cardRow = {
      displayName: "Sunrise",
      publicSlug: "sunrise",
      publicDescription: "Short summary",
      city: "Reno",
      state: "NV",
      services: [],
      languages: [],
      paymentTypes: [],
      capacity: [{ totalBeds: 12, availableBeds: 3 }],
      internalNotes: "SECRET",
    } as unknown as ProviderPublicCardRow;
    const serialized = JSON.stringify(toProviderPublicCard(cardRow));
    expect(serialized).not.toContain("capacity");
    expect(serialized).not.toContain("availableBeds");
    expect(serialized).not.toContain("SECRET");
    expect(serialized).not.toContain("organizationId");
  });
});
