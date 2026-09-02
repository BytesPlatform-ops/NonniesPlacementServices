import { assertSmsMergeTokens, collectSmsTokens, renderSmsBody, SMS_MERGE_FIELDS, validateSmsBody } from "./sms-merge";

describe("SMS merge fields", () => {
  it("allows only the safe contact fields (never patient/clinical data)", () => {
    expect(SMS_MERGE_FIELDS).toEqual(["firstName", "lastName", "fullName", "email", "organizationName"]);
    for (const forbidden of ["patientName", "diagnosis", "caseId", "insurance", "medications"]) {
      expect(SMS_MERGE_FIELDS).not.toContain(forbidden);
      expect(() => assertSmsMergeTokens(`Hi {{${forbidden}}}`)).toThrow(/Unknown merge field/i);
    }
  });

  it("collects tokens in order without duplicates", () => {
    expect(collectSmsTokens("Hi {{firstName}}, {{firstName}} of {{organizationName}}")).toEqual(["firstName", "organizationName"]);
  });

  it("rejects an unknown merge field rather than shipping {{something}} to a handset", () => {
    expect(() => validateSmsBody("Hi {{nickname}}")).toThrow(/Unknown merge field/i);
  });

  it("rejects an empty body and one past the provider limit", () => {
    expect(() => validateSmsBody("   ")).toThrow(/required/i);
    expect(() => validateSmsBody("a".repeat(1601))).toThrow(/1600/);
  });

  it("renders allow-listed fields", () => {
    const out = renderSmsBody("Hi {{firstName}} {{lastName}} at {{organizationName}}", { firstName: "Ada", lastName: "Reyes", organizationName: "Demo Health" });
    expect(out).toBe("Hi Ada Reyes at Demo Health");
  });

  it("supports fullName and tidies whitespace when a value is missing", () => {
    expect(renderSmsBody("Hello {{fullName}}!", { firstName: "Ada", lastName: "Reyes" })).toBe("Hello Ada Reyes!");
    expect(renderSmsBody("Hi {{firstName}}, welcome", { firstName: null })).toBe("Hi, welcome");
  });
});
