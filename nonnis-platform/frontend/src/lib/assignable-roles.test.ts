import { describe, expect, it } from "vitest";
import { rolesAssignableIn } from "./assignable-roles";
import type { RoleOption } from "@/types/admin";

/** What an API deployment BEFORE the role/organization-type work returns. */
const OLD_BACKEND = [
  { code: "NONNIS_ADMIN", name: "Nonnis Administrator" },
  { code: "NONNIS_OPERATIONS", name: "Nonnis Operations" },
  { code: "DISCHARGE_PROFESSIONAL", name: "Discharge Professional" },
  { code: "PROVIDER_ADMIN", name: "Provider Administrator" },
  { code: "PROVIDER_STAFF", name: "Provider Staff" },
] as RoleOption[];

/** What the current API returns. */
const NEW_BACKEND: RoleOption[] = [
  { code: "NONNIS_ADMIN", name: "Nonnis Administrator", allowedOrganizationTypes: ["NONNIS"] },
  { code: "NONNIS_OPERATIONS", name: "Nonnis Operations", allowedOrganizationTypes: ["NONNIS"] },
  {
    code: "DISCHARGE_PROFESSIONAL",
    name: "Discharge Professional",
    allowedOrganizationTypes: ["HOSPITAL", "REHABILITATION_CENTER", "SKILLED_NURSING_FACILITY", "PARTNER"],
  },
  { code: "PROVIDER_ADMIN", name: "Provider Administrator", allowedOrganizationTypes: ["PROVIDER"] },
  { code: "PROVIDER_STAFF", name: "Provider Staff", allowedOrganizationTypes: ["PROVIDER"] },
];

const codes = (roles: RoleOption[]): string[] => roles.map((r) => r.code);

describe("rolesAssignableIn — compatibility with an older API", () => {
  // The production crash: `/admin/users` went blank because the CRM read
  // `.length` off a field the deployed API did not send, and a throw in a client
  // component takes the whole route down.
  it("does not throw when the API omits allowedOrganizationTypes", () => {
    expect(() => rolesAssignableIn(OLD_BACKEND, "NONNIS")).not.toThrow();
  });

  it("offers every role when the API records no restrictions", () => {
    // Degrades to the pre-feature behaviour rather than to an empty dropdown:
    // the server still refuses an incompatible pairing with a 400.
    expect(codes(rolesAssignableIn(OLD_BACKEND, "NONNIS"))).toEqual(codes(OLD_BACKEND));
    expect(codes(rolesAssignableIn(OLD_BACKEND, "PROVIDER"))).toEqual(codes(OLD_BACKEND));
    expect(codes(rolesAssignableIn(OLD_BACKEND, "HOSPITAL"))).toEqual(codes(OLD_BACKEND));
  });

  it("tolerates a single role missing the field among well-formed ones", () => {
    const mixed = [...NEW_BACKEND, { code: "FUTURE_ROLE", name: "Future Role" } as RoleOption];
    expect(() => rolesAssignableIn(mixed, "NONNIS")).not.toThrow();
    expect(codes(rolesAssignableIn(mixed, "NONNIS"))).toEqual([
      "NONNIS_ADMIN",
      "NONNIS_OPERATIONS",
      "FUTURE_ROLE",
    ]);
  });

  it("tolerates a null or undefined role list", () => {
    expect(rolesAssignableIn(null, "NONNIS")).toEqual([]);
    expect(rolesAssignableIn(undefined, "NONNIS")).toEqual([]);
    expect(rolesAssignableIn([], "NONNIS")).toEqual([]);
  });
});

describe("rolesAssignableIn — filtering with the current API", () => {
  it("offers only the Nonnis roles inside a NONNIS organization", () => {
    expect(codes(rolesAssignableIn(NEW_BACKEND, "NONNIS"))).toEqual(["NONNIS_ADMIN", "NONNIS_OPERATIONS"]);
  });

  it("offers only the provider roles inside a PROVIDER organization", () => {
    expect(codes(rolesAssignableIn(NEW_BACKEND, "PROVIDER"))).toEqual(["PROVIDER_ADMIN", "PROVIDER_STAFF"]);
  });

  it("offers only the discharge role inside a referring organization", () => {
    for (const type of ["HOSPITAL", "REHABILITATION_CENTER", "SKILLED_NURSING_FACILITY", "PARTNER"]) {
      expect(codes(rolesAssignableIn(NEW_BACKEND, type))).toEqual(["DISCHARGE_PROFESSIONAL"]);
    }
  });

  it("never offers a provider role in a Nonnis organization, or the reverse", () => {
    expect(codes(rolesAssignableIn(NEW_BACKEND, "NONNIS"))).not.toContain("PROVIDER_ADMIN");
    expect(codes(rolesAssignableIn(NEW_BACKEND, "NONNIS"))).not.toContain("PROVIDER_STAFF");
    expect(codes(rolesAssignableIn(NEW_BACKEND, "PROVIDER"))).not.toContain("NONNIS_ADMIN");
  });

  it("offers everything when there is no active organization to filter by", () => {
    // A multi-organization user who has not chosen one yet.
    expect(codes(rolesAssignableIn(NEW_BACKEND, null))).toEqual(codes(NEW_BACKEND));
  });

  it("treats an explicitly empty list as unrestricted, matching the server", () => {
    // The server sends `[]` for a role valid in no organization type at all.
    // Such a role is never assignable through the organization invite path, so
    // it cannot reach this list — but if it did, hiding it silently would be
    // worse than letting the server explain the 400.
    const unrestricted: RoleOption[] = [{ code: "ODD", name: "Odd", allowedOrganizationTypes: [] }];
    expect(codes(rolesAssignableIn(unrestricted, "NONNIS"))).toEqual(["ODD"]);
  });
});
