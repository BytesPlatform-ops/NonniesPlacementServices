import { BadRequestException } from "@nestjs/common";
import { designWithAttachments, designWithoutAttachments, readTemplateAttachments, validateTemplateAttachments } from "./template-attachments";

const pdf = { path: "attachments/0b8f1c1e-1d2a-4c55-9b7e-3f2a1c9d8e7f.pdf", fileName: "Brochure.pdf", mimeType: "application/pdf", sizeBytes: 1024 };

describe("template attachments", () => {
  it("stores the list on the design and reads it back", () => {
    const design = designWithAttachments({ version: 1, blocks: [] }, [pdf]);
    expect(readTemplateAttachments(design)).toEqual([pdf]);
    expect(designWithoutAttachments(design)).toEqual({ version: 1, blocks: [] });
  });

  it("drops the key when the list is emptied, and replaces a stale list", () => {
    expect(designWithAttachments({ blocks: [], attachments: [pdf] }, [])).toEqual({ blocks: [] });
    expect(readTemplateAttachments(designWithAttachments({ attachments: [{ junk: true }] }, [pdf]))).toEqual([pdf]);
  });

  it("ignores malformed stored entries", () => {
    expect(readTemplateAttachments({ attachments: [{ path: 1 }, pdf] })).toEqual([pdf]);
    expect(readTemplateAttachments(null)).toEqual([]);
  });

  it("accepts only server-generated paths and allowed types", () => {
    expect(validateTemplateAttachments([pdf])).toEqual([pdf]);
    expect(() => validateTemplateAttachments([{ ...pdf, path: "../secrets.pdf" }])).toThrow(BadRequestException);
    expect(() => validateTemplateAttachments([{ ...pdf, mimeType: "application/x-msdownload", fileName: "a.exe" }])).toThrow(BadRequestException);
    expect(() => validateTemplateAttachments([pdf, pdf])).toThrow(BadRequestException);
  });

  it("enforces the total size limit", () => {
    const big = (i: number) => ({ ...pdf, path: `attachments/0b8f1c1e-1d2a-4c55-9b7e-3f2a1c9d8e7${i}.pdf`, sizeBytes: 9 * 1024 * 1024 });
    expect(() => validateTemplateAttachments([big(0), big(1), big(2)])).toThrow(BadRequestException);
  });
});
