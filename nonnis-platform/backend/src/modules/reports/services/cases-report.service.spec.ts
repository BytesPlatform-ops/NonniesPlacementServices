import { PrismaService } from "../../../database/prisma.service";
import { ReportLookupService } from "../report-lookups.service";
import { MAX_EXPORT_ROWS } from "../csv";
import { CasesReportService } from "./cases-report.service";
import { CasesReportDto } from "../dto/report-filters.dto";

function makeService(prisma: Partial<Record<string, unknown>>) {
  const lookups = {
    organizationNames: async () => new Map(),
    facilityNames: async () => new Map(),
    userNames: async () => new Map(),
  } as unknown as ReportLookupService;
  return new CasesReportService(prisma as unknown as PrismaService, lookups);
}

describe("CasesReportService.export (row cap)", () => {
  const filters = Object.assign(new CasesReportDto(), { page: 1, pageSize: 20 });

  it("refuses to export when the filtered set exceeds the row cap", async () => {
    const findMany = jest.fn();
    const svc = makeService({ case: { count: jest.fn().mockResolvedValue(MAX_EXPORT_ROWS + 1), findMany } });
    const result = await svc.export(filters);
    expect(result).toEqual({ tooMany: MAX_EXPORT_ROWS + 1 });
    // Must NOT load rows when over the cap.
    expect(findMany).not.toHaveBeenCalled();
  });

  it("produces CSV with stable headers when within the cap", async () => {
    const svc = makeService({ case: { count: jest.fn().mockResolvedValue(0), findMany: jest.fn().mockResolvedValue([]) } });
    const result = await svc.export(filters);
    expect("csv" in result).toBe(true);
    if ("csv" in result) {
      expect(result.rowCount).toBe(0);
      expect(result.csv).toContain("Case Number");
      expect(result.csv).toContain("Readiness Level");
      // Minimum-necessary data: never leak internal/clinical columns.
      expect(result.csv).not.toContain("internalNotes");
      expect(result.csv).not.toContain("submittedData");
    }
  });
});
