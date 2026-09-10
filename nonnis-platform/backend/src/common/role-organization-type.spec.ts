import {
  ROLES,
  ROLE_ALLOWED_ORGANIZATION_TYPES,
  isRoleAllowedForOrganizationType,
  roleOrganizationTypeError,
  rolesForOrganizationType,
  type OrganizationTypeCode,
} from "./rbac";

/** Every value in the schema's OrganizationType enum. */
const ALL_TYPES: OrganizationTypeCode[] = [
  "NONNIS",
  "HOSPITAL",
  "REHABILITATION_CENTER",
  "SKILLED_NURSING_FACILITY",
  "PROVIDER",
  "PARTNER",
];

/** The full expected truth table, written out rather than derived. */
const EXPECTED: Record<string, OrganizationTypeCode[]> = {
  [ROLES.NONNIS_ADMIN]: ["NONNIS"],
  [ROLES.NONNIS_OPERATIONS]: ["NONNIS"],
  [ROLES.DISCHARGE_PROFESSIONAL]: ["HOSPITAL", "REHABILITATION_CENTER", "SKILLED_NURSING_FACILITY", "PARTNER"],
  [ROLES.PROVIDER_ADMIN]: ["PROVIDER"],
  [ROLES.PROVIDER_STAFF]: ["PROVIDER"],
};

describe("role ↔ organization type compatibility", () => {
  it("covers every role in ROLES", () => {
    // A role added without a rule would otherwise be silently unassignable.
    expect(Object.keys(ROLE_ALLOWED_ORGANIZATION_TYPES).sort()).toEqual(Object.values(ROLES).sort());
  });

  describe.each(Object.entries(EXPECTED))("%s", (roleCode, allowedTypes) => {
    it.each(allowedTypes)(`is allowed in %s`, (orgType) => {
      expect(isRoleAllowedForOrganizationType(roleCode, orgType)).toBe(true);
    });

    const rejected = ALL_TYPES.filter((t) => !allowedTypes.includes(t));
    it.each(rejected)(`is rejected in %s`, (orgType) => {
      expect(isRoleAllowedForOrganizationType(roleCode, orgType)).toBe(false);
    });
  });

  it("never allows a provider role outside a provider organization", () => {
    for (const role of [ROLES.PROVIDER_ADMIN, ROLES.PROVIDER_STAFF]) {
      for (const type of ALL_TYPES.filter((t) => t !== "PROVIDER")) {
        expect(isRoleAllowedForOrganizationType(role, type)).toBe(false);
      }
    }
  });

  it("never allows a Nonnis role outside the Nonnis organization", () => {
    for (const role of [ROLES.NONNIS_ADMIN, ROLES.NONNIS_OPERATIONS]) {
      for (const type of ALL_TYPES.filter((t) => t !== "NONNIS")) {
        expect(isRoleAllowedForOrganizationType(role, type)).toBe(false);
      }
    }
  });

  it("never allows a discharge professional in a provider or Nonnis organization", () => {
    expect(isRoleAllowedForOrganizationType(ROLES.DISCHARGE_PROFESSIONAL, "PROVIDER")).toBe(false);
    expect(isRoleAllowedForOrganizationType(ROLES.DISCHARGE_PROFESSIONAL, "NONNIS")).toBe(false);
  });

  it("rejects an unknown role rather than defaulting to permitted", () => {
    expect(isRoleAllowedForOrganizationType("CARE_SEEKER", "HOSPITAL")).toBe(false);
    expect(isRoleAllowedForOrganizationType("", "HOSPITAL")).toBe(false);
  });

  it("lists the roles valid for each organization type", () => {
    expect(rolesForOrganizationType("PROVIDER")).toEqual([ROLES.PROVIDER_ADMIN, ROLES.PROVIDER_STAFF]);
    expect(rolesForOrganizationType("NONNIS")).toEqual([ROLES.NONNIS_ADMIN, ROLES.NONNIS_OPERATIONS]);
    expect(rolesForOrganizationType("HOSPITAL")).toEqual([ROLES.DISCHARGE_PROFESSIONAL]);
    expect(rolesForOrganizationType("PARTNER")).toEqual([ROLES.DISCHARGE_PROFESSIONAL]);
  });

  it("explains the rejection with both the role and the types that would work", () => {
    const message = roleOrganizationTypeError(ROLES.PROVIDER_ADMIN, "HOSPITAL");
    expect(message).toContain("PROVIDER_ADMIN");
    expect(message).toContain("HOSPITAL");
    expect(message).toContain("PROVIDER");
    expect(roleOrganizationTypeError("NOPE", "HOSPITAL")).toContain("Unknown role");
  });

  it("leaves every organization type with at least one assignable role", () => {
    // A type with no valid role cannot have members at all.
    for (const type of ALL_TYPES) {
      expect(rolesForOrganizationType(type).length).toBeGreaterThan(0);
    }
  });

  describe("CARE_SEEKER", () => {
    it("is rejected in every organization type", () => {
      // A family member is scoped to a case, not an organization. The empty
      // rule set is what makes the organization invite path refuse the role.
      for (const type of ALL_TYPES) {
        expect(isRoleAllowedForOrganizationType(ROLES.CARE_SEEKER, type)).toBe(false);
      }
    });

    it("appears in no organization type's assignable list", () => {
      for (const type of ALL_TYPES) {
        expect(rolesForOrganizationType(type)).not.toContain(ROLES.CARE_SEEKER);
      }
    });

    it("still has an explicit rule rather than being missing", () => {
      // The distinction matters: "listed with no types" is a decision, while
      // "absent" would be an oversight that the coverage test above catches.
      expect(ROLE_ALLOWED_ORGANIZATION_TYPES[ROLES.CARE_SEEKER]).toEqual([]);
    });

    it("explains the rejection without claiming some other type would work", () => {
      const message = roleOrganizationTypeError(ROLES.CARE_SEEKER, "NONNIS");
      expect(message).toContain("CARE_SEEKER");
      expect(message).toContain("NONNIS");
    });

    it("does not disturb the roles every other organization type may assign", () => {
      // Regression guard for the four existing roles.
      expect(rolesForOrganizationType("PROVIDER")).toEqual([ROLES.PROVIDER_ADMIN, ROLES.PROVIDER_STAFF]);
      expect(rolesForOrganizationType("NONNIS")).toEqual([ROLES.NONNIS_ADMIN, ROLES.NONNIS_OPERATIONS]);
      expect(rolesForOrganizationType("HOSPITAL")).toEqual([ROLES.DISCHARGE_PROFESSIONAL]);
      expect(rolesForOrganizationType("REHABILITATION_CENTER")).toEqual([ROLES.DISCHARGE_PROFESSIONAL]);
      expect(rolesForOrganizationType("SKILLED_NURSING_FACILITY")).toEqual([ROLES.DISCHARGE_PROFESSIONAL]);
      expect(rolesForOrganizationType("PARTNER")).toEqual([ROLES.DISCHARGE_PROFESSIONAL]);
    });
  });
});
