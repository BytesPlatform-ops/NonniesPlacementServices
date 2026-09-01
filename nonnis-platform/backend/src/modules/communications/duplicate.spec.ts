import { classifyContactMatch } from "./duplicate";

const lookup = () => ({ emailToContactId: new Map([["a@x.com", "c1"]]), phoneToContactId: new Map([["+15550000002", "c2"]]) });

describe("classifyContactMatch", () => {
  it("NEW when neither email nor phone match", () => {
    expect(classifyContactMatch({ normalizedEmail: "new@x.com", normalizedPhoneE164: "+15550000009" }, lookup())).toEqual({ status: "NEW" });
  });
  it("DUPLICATE when email matches an existing contact", () => {
    expect(classifyContactMatch({ normalizedEmail: "a@x.com", normalizedPhoneE164: null }, lookup())).toEqual({ status: "DUPLICATE", existingContactId: "c1" });
  });
  it("DUPLICATE when phone matches an existing contact", () => {
    expect(classifyContactMatch({ normalizedEmail: null, normalizedPhoneE164: "+15550000002" }, lookup())).toEqual({ status: "DUPLICATE", existingContactId: "c2" });
  });
  it("DUPLICATE when both match the SAME contact", () => {
    const lk = { emailToContactId: new Map([["a@x.com", "c1"]]), phoneToContactId: new Map([["+15550000002", "c1"]]) };
    expect(classifyContactMatch({ normalizedEmail: "a@x.com", normalizedPhoneE164: "+15550000002" }, lk)).toEqual({ status: "DUPLICATE", existingContactId: "c1" });
  });
  it("CONFLICT when email matches A and phone matches a DIFFERENT contact B — never auto-merge", () => {
    expect(classifyContactMatch({ normalizedEmail: "a@x.com", normalizedPhoneE164: "+15550000002" }, lookup())).toEqual({
      status: "CONFLICT",
      emailContactId: "c1",
      phoneContactId: "c2",
    });
  });
});
