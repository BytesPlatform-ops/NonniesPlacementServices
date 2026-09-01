import { buildAttachmentPath, isAllowedAttachmentType, safeDisplayFilename, validateAttachment } from "./attachment-policy";

describe("attachment policy", () => {
  it("allows conservative document/image types", () => {
    expect(isAllowedAttachmentType("application/pdf")).toBe(true);
    expect(isAllowedAttachmentType("image/png")).toBe(true);
    expect(isAllowedAttachmentType("text/csv")).toBe(true);
  });

  it("rejects executables/scripts by MIME", () => {
    expect(isAllowedAttachmentType("application/x-msdownload")).toBe(false);
    expect(() => validateAttachment("evil.exe", "application/x-msdownload", 10)).toThrow();
  });

  it("rejects a blocked extension even under an allowed MIME", () => {
    expect(() => validateAttachment("payload.js", "text/plain", 10)).toThrow();
  });

  it("enforces the per-file size limit", () => {
    expect(() => validateAttachment("big.pdf", "application/pdf", 999 * 1024 * 1024)).toThrow();
  });

  it("generates a server-side path in the attachments/ folder (never from the filename)", () => {
    const path = buildAttachmentPath("application/pdf");
    expect(path).toMatch(/^attachments\/[0-9a-f-]{36}\.pdf$/);
  });

  it("sanitizes a display filename (no path separators)", () => {
    expect(safeDisplayFilename("../../etc/passwd")).not.toContain("/");
    expect(safeDisplayFilename("")).toBe("attachment");
  });
});
