import {
  allRequiredPlacementsStarted,
  completionEligibility,
  computeReadiness,
  type ReadinessInput,
  type ReadinessPlacement,
  type ReadinessServiceRequest,
} from "./readiness-domain";

const CREATED = new Date("2026-01-01T00:00:00.000Z");

function placement(over: Partial<ReadinessPlacement> = {}): ReadinessPlacement {
  return { status: "SCHEDULED", scheduledStartAt: new Date("2026-02-01T00:00:00.000Z"), actualStartAt: null, ...over };
}

function serviceRequest(over: Partial<ReadinessServiceRequest> = {}): ReadinessServiceRequest {
  return {
    id: "sr-1",
    category: "HOME_HEALTH",
    status: "REQUESTED",
    levelOfCare: "SKILLED",
    requestedStartDate: new Date("2026-02-01T00:00:00.000Z"),
    transportationRequired: false,
    equipmentNeeds: null,
    fundingSource: "Medicare",
    insurancePlan: null,
    placement: placement(),
    ...over,
  };
}

/** A fully-ready case; individual tests mutate one dimension. */
function readyInput(over: Partial<ReadinessInput> = {}): ReadinessInput {
  return {
    status: "ACCEPTED",
    blocked: false,
    assignedProfessionalId: "user-1",
    expectedDischargeDate: new Date("2026-02-05T00:00:00.000Z"),
    actualDischargeDate: null,
    currentCareSetting: "HOSPITAL",
    preferredServiceLocation: "Home - 123 Main St",
    patientContactPhone: "555-0100",
    representativeContact: null,
    createdAt: CREATED,
    requirements: [],
    serviceRequests: [serviceRequest()],
    ...over,
  };
}

const component = (r: ReturnType<typeof computeReadiness>, code: string) => r.components.find((c) => c.code === code)!;
const gate = (r: ReturnType<typeof computeReadiness>, code: string) => r.gates.find((g) => g.code === code)!;
const hasBlocker = (r: ReturnType<typeof computeReadiness>, code: string) => r.blockers.some((b) => b.code === code);

describe("computeReadiness — baseline", () => {
  it("a fully-satisfied case is ready at 100%", () => {
    const r = computeReadiness(readyInput());
    expect(r.ready).toBe(true);
    expect(r.percentage).toBe(100);
    expect(r.level).toBe("READY");
    expect(r.blockers).toHaveLength(0);
    expect(r.gates.every((g) => g.passed)).toBe(true);
  });

  it("is deterministic", () => {
    expect(computeReadiness(readyInput())).toEqual(computeReadiness(readyInput()));
  });
});

describe("case information", () => {
  it("incomplete case information fails the gate and lowers the percentage", () => {
    const r = computeReadiness(readyInput({ preferredServiceLocation: null, currentCareSetting: null }));
    expect(component(r, "case_information").status).toBe("INCOMPLETE");
    expect(gate(r, "case_information_complete").passed).toBe(false);
    expect(r.ready).toBe(false);
    expect(hasBlocker(r, "CASE_INFORMATION_INCOMPLETE")).toBe(true);
    expect(r.percentage).toBeLessThan(100);
  });
});

describe("requirements", () => {
  it("an incomplete required requirement blocks readiness", () => {
    const r = computeReadiness(readyInput({ requirements: [{ id: "req-1", category: "CLINICAL", status: "IN_PROGRESS", mandatory: true, label: "Labs" }] }));
    expect(component(r, "requirements").status).toBe("INCOMPLETE");
    expect(r.ready).toBe(false);
    expect(hasBlocker(r, "REQUIRED_REQUIREMENT_INCOMPLETE")).toBe(true);
  });

  it("a blocked required requirement is a critical blocker and sets level BLOCKED", () => {
    const r = computeReadiness(readyInput({ requirements: [{ id: "req-1", category: "CLINICAL", status: "BLOCKED", mandatory: true, label: "Auth" }] }));
    expect(component(r, "requirements").status).toBe("BLOCKED");
    expect(r.level).toBe("BLOCKED");
    expect(r.ready).toBe(false);
    expect(hasBlocker(r, "REQUIRED_REQUIREMENT_BLOCKED")).toBe(true);
    expect(hasBlocker(r, "REQUIRED_REQUIREMENT_INCOMPLETE")).toBe(false);
  });

  it("a NOT_REQUIRED requirement is excluded (still ready)", () => {
    const r = computeReadiness(readyInput({ requirements: [{ id: "req-1", category: "CLINICAL", status: "NOT_REQUIRED", mandatory: true, label: "Optional" }] }));
    expect(component(r, "requirements").status).toBe("COMPLETE");
    expect(r.ready).toBe(true);
  });

  it("a non-mandatory incomplete requirement does not block readiness", () => {
    const r = computeReadiness(readyInput({ requirements: [{ id: "req-1", category: "CLINICAL", status: "PENDING", mandatory: false, label: "Nice to have" }] }));
    expect(component(r, "requirements").status).toBe("COMPLETE");
    expect(r.ready).toBe(true);
  });
});

describe("service requests", () => {
  it("an incomplete service request blocks readiness", () => {
    const r = computeReadiness(readyInput({ serviceRequests: [serviceRequest({ levelOfCare: null })] }));
    expect(component(r, "service_requests").status).toBe("INCOMPLETE");
    expect(r.ready).toBe(false);
    expect(hasBlocker(r, "SERVICE_REQUEST_INCOMPLETE")).toBe(true);
  });

  it("a cancelled service request is excluded from readiness", () => {
    const r = computeReadiness(readyInput({ serviceRequests: [serviceRequest(), serviceRequest({ id: "sr-2", status: "CANCELLED", placement: null })] }));
    expect(r.ready).toBe(true);
  });
});

describe("provider placement", () => {
  it("an accepted, scheduled placement satisfies the placement gate", () => {
    const r = computeReadiness(readyInput());
    expect(component(r, "provider_placement").status).toBe("COMPLETE");
    expect(gate(r, "provider_placement").passed).toBe(true);
  });

  it("a conditional acceptance (no placement) does not satisfy placement", () => {
    const r = computeReadiness(readyInput({ serviceRequests: [serviceRequest({ placement: null })] }));
    expect(component(r, "provider_placement").status).toBe("INCOMPLETE");
    expect(r.ready).toBe(false);
    expect(hasBlocker(r, "NO_ACCEPTED_PROVIDER_PLACEMENT")).toBe(true);
  });

  it("a cancelled placement (modelled as null) does not satisfy placement", () => {
    const r = computeReadiness(readyInput({ serviceRequests: [serviceRequest({ placement: null })] }));
    expect(gate(r, "provider_placement").passed).toBe(false);
  });

  it("an unsuccessful placement is a critical blocker", () => {
    const r = computeReadiness(readyInput({ status: "DISCHARGED", serviceRequests: [serviceRequest({ placement: placement({ status: "UNSUCCESSFUL", actualStartAt: null }) })] }));
    expect(component(r, "provider_placement").status).toBe("BLOCKED");
    expect(r.level).toBe("BLOCKED");
    expect(hasBlocker(r, "SERVICE_START_UNSUCCESSFUL")).toBe(true);
  });

  it("with two required service requests, one placement is insufficient", () => {
    const r = computeReadiness(readyInput({ serviceRequests: [serviceRequest(), serviceRequest({ id: "sr-2", placement: null })] }));
    expect(component(r, "provider_placement").status).toBe("INCOMPLETE");
    expect(r.ready).toBe(false);
  });

  it("with two required service requests, both placed passes the placement gate", () => {
    const r = computeReadiness(readyInput({ serviceRequests: [serviceRequest(), serviceRequest({ id: "sr-2" })] }));
    expect(component(r, "provider_placement").status).toBe("COMPLETE");
    expect(r.ready).toBe(true);
  });
});

describe("service scheduling", () => {
  it("an accepted but unscheduled placement fails the scheduling gate", () => {
    const r = computeReadiness(readyInput({ serviceRequests: [serviceRequest({ placement: placement({ status: "ACCEPTED", scheduledStartAt: null }) })] }));
    expect(component(r, "service_scheduling").status).toBe("INCOMPLETE");
    expect(r.ready).toBe(false);
    expect(hasBlocker(r, "SERVICE_START_NOT_SCHEDULED")).toBe(true);
  });

  it("a scheduled placement passes; scheduled is distinct from started", () => {
    const r = computeReadiness(readyInput());
    expect(component(r, "service_scheduling").status).toBe("COMPLETE");
    expect(r.serviceStart.startedPlacements).toBe(0);
    expect(r.serviceStart.allStarted).toBe(false);
  });
});

describe("transportation / equipment / funding", () => {
  it("transportation not required is NOT_APPLICABLE and does not lower readiness", () => {
    const r = computeReadiness(readyInput());
    expect(component(r, "transportation").status).toBe("NOT_APPLICABLE");
    expect(r.ready).toBe(true);
  });

  it("required transportation without a completed requirement is a warning, not a hard gate", () => {
    const r = computeReadiness(readyInput({ serviceRequests: [serviceRequest({ transportationRequired: true })] }));
    expect(component(r, "transportation").status).toBe("INCOMPLETE");
    expect(hasBlocker(r, "TRANSPORTATION_UNRESOLVED")).toBe(true);
    expect(r.ready).toBe(true); // soft, non-gate
  });

  it("required transportation with a completed requirement is resolved", () => {
    const r = computeReadiness(readyInput({ serviceRequests: [serviceRequest({ transportationRequired: true })], requirements: [{ id: "rq", category: "TRANSPORTATION", status: "COMPLETE", mandatory: true, label: "Ride" }] }));
    expect(component(r, "transportation").status).toBe("COMPLETE");
  });

  it("equipment needs drive an applicable equipment component", () => {
    const r = computeReadiness(readyInput({ serviceRequests: [serviceRequest({ equipmentNeeds: "Hospital bed" })] }));
    expect(component(r, "equipment").status).toBe("INCOMPLETE");
    expect(hasBlocker(r, "EQUIPMENT_UNRESOLVED")).toBe(true);
  });

  it("missing funding is informational only", () => {
    const r = computeReadiness(readyInput({ serviceRequests: [serviceRequest({ fundingSource: null, insurancePlan: null })] }));
    expect(component(r, "funding_information").status).toBe("INCOMPLETE");
    expect(r.blockers.find((b) => b.code === "FUNDING_INFORMATION_MISSING")!.severity).toBe("INFO");
    // Funding is informational (non-gate): it lowers the percentage but does not block readiness.
    expect(r.ready).toBe(true);
    expect(r.percentage).toBeLessThan(100);
  });
});

describe("manual case block", () => {
  it("a manually blocked case is never ready and is BLOCKED", () => {
    const r = computeReadiness(readyInput({ blocked: true }));
    expect(component(r, "not_blocked").status).toBe("BLOCKED");
    expect(r.level).toBe("BLOCKED");
    expect(r.ready).toBe(false);
    expect(hasBlocker(r, "CASE_MANUALLY_BLOCKED")).toBe(true);
  });
});

describe("percentage & NOT_APPLICABLE", () => {
  it("excludes NOT_APPLICABLE components from the denominator", () => {
    const r = computeReadiness(readyInput());
    const applicable = r.components.filter((c) => c.status !== "NOT_APPLICABLE");
    expect(applicable.every((c) => c.status === "COMPLETE")).toBe(true);
    expect(r.percentage).toBe(100);
  });

  it("100% never bypasses a failed hard gate", () => {
    // All components complete, but discharge dates are inconsistent.
    const r = computeReadiness(readyInput({ actualDischargeDate: new Date("2025-12-01T00:00:00.000Z") }));
    expect(r.percentage).toBe(100);
    expect(gate(r, "valid_discharge_dates").passed).toBe(false);
    expect(r.ready).toBe(false);
    expect(hasBlocker(r, "INVALID_DISCHARGE_DATES")).toBe(true);
  });
});

describe("gates", () => {
  it("all gates pass -> ready true", () => {
    expect(computeReadiness(readyInput()).ready).toBe(true);
  });

  it("a single hard failure -> ready false with a transparent blocker", () => {
    const r = computeReadiness(readyInput({ assignedProfessionalId: null }));
    expect(r.ready).toBe(false);
    expect(hasBlocker(r, "NO_ASSIGNED_DISCHARGE_PROFESSIONAL")).toBe(true);
    expect(r.blockers.every((b) => b.explanation.length > 0)).toBe(true);
  });
});

describe("readiness regression", () => {
  it("a READY_FOR_DISCHARGE case that becomes blocked reports ready=false and statusMismatch", () => {
    const r = computeReadiness(readyInput({ status: "READY_FOR_DISCHARGE", blocked: true }));
    expect(r.ready).toBe(false);
    expect(r.statusMismatch).toBe(true);
  });

  it("a genuinely ready READY_FOR_DISCHARGE case has no status mismatch", () => {
    const r = computeReadiness(readyInput({ status: "READY_FOR_DISCHARGE" }));
    expect(r.ready).toBe(true);
    expect(r.statusMismatch).toBe(false);
  });
});

describe("service start & completion", () => {
  it("one of multiple placements started is not all-started", () => {
    const input = readyInput({
      status: "DISCHARGED",
      serviceRequests: [
        serviceRequest({ placement: placement({ status: "STARTED", actualStartAt: new Date() }) }),
        serviceRequest({ id: "sr-2", placement: placement({ status: "SCHEDULED" }) }),
      ],
    });
    expect(allRequiredPlacementsStarted(input)).toBe(false);
    expect(computeReadiness(input).serviceStart.allStarted).toBe(false);
  });

  it("all required placements started makes the case service-start eligible", () => {
    const input = readyInput({
      status: "DISCHARGED",
      serviceRequests: [
        serviceRequest({ placement: placement({ status: "STARTED", actualStartAt: new Date() }) }),
        serviceRequest({ id: "sr-2", placement: placement({ status: "STARTED", actualStartAt: new Date() }) }),
      ],
    });
    expect(allRequiredPlacementsStarted(input)).toBe(true);
    expect(computeReadiness(input).serviceStart.allStarted).toBe(true);
  });

  it("premature completion is rejected; discharged + all started is eligible", () => {
    const notDischarged = completionEligibility(readyInput());
    expect(notDischarged.eligible).toBe(false);
    expect(notDischarged.reasons.length).toBeGreaterThan(0);

    const started = readyInput({ status: "DISCHARGED", serviceRequests: [serviceRequest({ placement: placement({ status: "STARTED", actualStartAt: new Date() }) })] });
    expect(completionEligibility(started).eligible).toBe(true);
  });

  it("an unsuccessful required placement produces a completion blocker", () => {
    const bad = readyInput({ status: "DISCHARGED", serviceRequests: [serviceRequest({ placement: placement({ status: "UNSUCCESSFUL" }) })] });
    expect(completionEligibility(bad).eligible).toBe(false);
  });
});
