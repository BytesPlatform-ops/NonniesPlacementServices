import "reflect-metadata";
import { ValidationPipe } from "@nestjs/common";
import { ListSeekerMessagesDto } from "./care-seeker.dto";

/**
 * Guards the defect that made the family Messages page fail with "Invalid
 * database query".
 *
 * The route used to be typed `ListMessagesDto & SeekerCaseQueryDto`. TypeScript
 * emits `Object` as the design type of an intersection, and Nest's ValidationPipe
 * skips anything typed `Object` — so validation and transformation both silently
 * did nothing: `page` never received its default and `pageSize` arrived as the
 * string it was in the URL. Prisma then rejected `skip: NaN` / `take: "100"`.
 *
 * These assertions are about the pipe actually running, which is exactly what an
 * intersection type would take away again.
 */
describe("ListSeekerMessagesDto through the real ValidationPipe", () => {
  const pipe = new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true });
  const meta = { type: "query" as const, metatype: ListSeekerMessagesDto, data: "" };

  it("applies the page default when the query omits it", async () => {
    const out = (await pipe.transform({ pageSize: "100" }, meta)) as ListSeekerMessagesDto;
    expect(out.page).toBe(1);
  });

  it("coerces pageSize from its string form in the URL to a number", async () => {
    const out = (await pipe.transform({ caseId: "case-1", pageSize: "100" }, meta)) as ListSeekerMessagesDto;
    expect(out.pageSize).toBe(100);
    expect(typeof out.pageSize).toBe("number");
  });

  it("produces arithmetic Prisma accepts rather than NaN", async () => {
    const out = (await pipe.transform({ pageSize: "100" }, meta)) as ListSeekerMessagesDto;
    const skip = (out.page - 1) * out.pageSize;
    expect(Number.isNaN(skip)).toBe(false);
    expect(skip).toBe(0);
  });

  it("keeps the optional case selector", async () => {
    const out = (await pipe.transform({ caseId: "case-1" }, meta)) as ListSeekerMessagesDto;
    expect(out.caseId).toBe("case-1");
    expect(out.pageSize).toBe(50);
  });

  it("still rejects values outside the allowed range", async () => {
    await expect(pipe.transform({ pageSize: "5000" }, meta)).rejects.toThrow();
    await expect(pipe.transform({ page: "0" }, meta)).rejects.toThrow();
  });

  it("still refuses unknown query parameters", async () => {
    await expect(pipe.transform({ scope: "CASE_TEAM" }, meta)).rejects.toThrow();
  });
});

describe("the Messages route keeps a validatable query type", () => {
  it("declares a DTO class, not an intersection that the pipe would skip", async () => {
    // This is the assertion that actually catches the original defect coming
    // back: an intersection type emits `Object` here, and the ValidationPipe
    // ignores `Object`, which is how the route lost its defaults silently.
    const { SeekerController } = await import("./seeker.controller");
    const types = Reflect.getMetadata("design:paramtypes", SeekerController.prototype, "listMessages") as unknown[];
    // Position 1 is the @Query parameter. (Position 0 is @CurrentUser, an
    // interface, which legitimately emits Object.)
    expect(types[1]).toBe(ListSeekerMessagesDto);
  });
});
