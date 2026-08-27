import {
  attentionSummary,
  computeAttention,
  computeCompleteness,
  dischargeBucket,
  type AssessmentInput,
} from "./case-assessment";

const NOW = new Date("2026-03-15T12:00:00.000Z");

function input(over: Partial<AssessmentInput> = {}): AssessmentInput {
  return {
    status: "DRAFT",
    assignedProfessionalId: "u1",
    expectedDischargeDate: new Date("2026-03-20T00:00:00.000Z"),
    actualDischargeDate: null,
    currentCareSetting: "HOME",
    preferredServiceLocation: "Tacoma",
    blocked: false,
    patientContactPhone: "555",
    representativeContact: null,
    createdAt: new Date("2026-03-10T00:00:00.000Z"),
    requirements: [],
    serviceRequests: [{ id: "s1", levelOfCare: "SKILLED", requestedStartDate: new Date("2026-03-21") }],
    ...over,
  };
}

describe("dischargeBucket", () => {
  it("classifies dates into timezone-safe buckets", () => {
    expect(dischargeBucket(new Date("2026-03-14T23:00:00Z"), NOW)).toBe("OVERDUE");
    expect(dischargeBucket(new Date("2026-03-15T23:00:00Z"), NOW)).toBe("TODAY");
    expect(dischargeBucket(new Date("2026-03-16T01:00:00Z"), NOW)).toBe("NEXT_24H");
    expect(dischargeBucket(new Date("2026-03-18T00:00:00Z"), NOW)).toBe("NEXT_3_DAYS");
    expect(dischargeBucket(new Date("2026-03-21T00:00:00Z"), NOW)).toBe("NEXT_7_DAYS");
    expect(dischargeBucket(new Date("2026-04-30T00:00:00Z"), NOW)).toBe("LATER");
    expect(dischargeBucket(null, NOW)).toBe("NO_DATE");
  });
});

describe("computeCompleteness", () => {
  it("reports 100% with no blockers for a complete case", () => {
    const result = computeCompleteness(input());
    expect(result.percentage).toBe(100);
    expect(result.blockers).toEqual([]);
  });

  it("reports blockers for missing required data", () => {
    const result = computeCompleteness(input({ preferredServiceLocation: null, assignedProfessionalId: null, serviceRequests: [] }));
    expect(result.percentage).toBeLessThan(100);
    const codes = result.blockers.map((b) => b.code);
    expect(codes).toEqual(expect.arrayContaining(["destination", "assigned_professional", "service_request"]));
  });

  it("treats an unresolved mandatory requirement as a blocker", () => {
    const result = computeCompleteness(input({ requirements: [{ id: "r1", status: "PENDING", mandatory: true, label: "MAR" }] }));
    expect(result.blockers.map((b) => b.code)).toContain("requirements_resolved");
  });
});

describe("computeAttention", () => {
  it("has no attention for a complete, on-track case", () => {
    const reasons = computeAttention(input(), NOW);
    expect(reasons).toEqual([]);
  });

  it("flags overdue discharge as CRITICAL", () => {
    const reasons = computeAttention(input({ expectedDischargeDate: new Date("2026-03-10T00:00:00Z") }), NOW);
    expect(reasons.find((r) => r.code === "DISCHARGE_DATE_PASSED")?.severity).toBe("CRITICAL");
  });

  it("flags a blocked requirement and a blocked case", () => {
    const reasons = computeAttention(
      input({ blocked: true, requirements: [{ id: "r1", status: "BLOCKED", mandatory: true, label: "X" }] }),
      NOW,
    );
    expect(reasons.map((r) => r.code)).toEqual(expect.arrayContaining(["CASE_BLOCKED", "REQUIREMENT_BLOCKED"]));
  });

  it("flags missing assignment and destination", () => {
    const reasons = computeAttention(input({ assignedProfessionalId: null, preferredServiceLocation: null }), NOW);
    const codes = reasons.map((r) => r.code);
    expect(codes).toEqual(expect.arrayContaining(["NO_ASSIGNED_PROFESSIONAL", "MISSING_DESTINATION", "INCOMPLETE_ASSESSMENT"]));
  });

  it("suppresses attention for terminal cases", () => {
    const reasons = computeAttention(input({ status: "CANCELLED", assignedProfessionalId: null, preferredServiceLocation: null }), NOW);
    expect(reasons).toEqual([]);
  });
});

describe("attentionSummary", () => {
  it("surfaces the highest severity", () => {
    const summary = attentionSummary([
      { code: "A", severity: "INFO", label: "" },
      { code: "B", severity: "CRITICAL", label: "" },
      { code: "C", severity: "WARNING", label: "" },
    ]);
    expect(summary.level).toBe("CRITICAL");
    expect(summary.count).toBe(3);
  });

  it("returns NONE for no reasons", () => {
    expect(attentionSummary([]).level).toBe("NONE");
  });
});
