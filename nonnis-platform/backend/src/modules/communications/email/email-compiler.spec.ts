import { BadRequestException } from "@nestjs/common";
import { assertMergeTokensAllowed, validateDesign } from "./template-design";
import { compileDesign, renderForRecipient } from "./email-compiler";

const baseDesign = (blocks: unknown[]) => ({
  version: 1,
  settings: { backgroundColor: "#f2e8db", contentBackgroundColor: "#ffffff", contentWidth: 600, textColor: "#2b1b0e", linkColor: "#b56f28", fontFamily: "Arial, Helvetica, sans-serif" },
  blocks,
});

describe("validateDesign", () => {
  it("accepts a valid design and normalizes settings", () => {
    const d = validateDesign(baseDesign([{ id: "a", type: "heading", content: "Hi", level: 1, align: "left" }]));
    expect(d.settings.contentWidth).toBe(600);
    expect(d.blocks).toHaveLength(1);
  });
  it("rejects an unknown block type", () => {
    expect(() => validateDesign(baseDesign([{ id: "a", type: "video" }]))).toThrow(BadRequestException);
  });
  it("rejects an invalid button URL", () => {
    expect(() => validateDesign(baseDesign([{ id: "a", type: "button", label: "Go", href: "javascript:alert(1)", align: "center", backgroundColor: "#000000", textColor: "#ffffff", radius: 6 }]))).toThrow(/valid http/i);
  });
  it("rejects a non-HTTPS/relative image URL at production media validation", () => {
    const design = baseDesign([{ id: "a", type: "image", src: "http://localhost/x.png", alt: "x", align: "center", widthPct: 100 }]);
    expect(() => validateDesign(design, true)).toThrow(/HTTPS/i);
    // relaxed at draft time
    expect(() => validateDesign(design, false)).not.toThrow();
  });
});

describe("merge field validation", () => {
  it("rejects unknown merge fields (e.g. a clinical field)", () => {
    const d = validateDesign(baseDesign([{ id: "a", type: "text", content: "Dx: {{patientDiagnosis}}", align: "left" }]));
    expect(() => assertMergeTokensAllowed(d)).toThrow(/patientDiagnosis/);
  });
  it("allows the approved contact fields", () => {
    const d = validateDesign(baseDesign([{ id: "a", type: "text", content: "Hi {{firstName}} at {{organizationName}}", align: "left" }]));
    expect(() => assertMergeTokensAllowed(d)).not.toThrow();
  });
});

describe("compileDesign + renderForRecipient", () => {
  const design = validateDesign(baseDesign([
    { id: "h", type: "heading", content: "Hello {{firstName}}", level: 1, align: "left" },
    { id: "t", type: "text", content: "Thanks **{{firstName}}** — [visit](https://x.com).", align: "left" },
    { id: "b", type: "button", label: "Open", href: "https://x.com", align: "center", backgroundColor: "#b56f28", textColor: "#ffffff", radius: 6 },
  ]));

  it("produces safe responsive HTML with an unsubscribe placeholder and a text fallback", () => {
    const c = compileDesign(design, { preheader: "Preview text" });
    expect(c.html).not.toMatch(/<script/i);
    expect(c.html).not.toMatch(/<iframe/i);
    expect(c.html).toContain("{{unsubscribeUrl}}");
    expect(c.text).toContain("{{unsubscribeUrl}}");
    expect(c.text.length).toBeGreaterThan(0);
  });

  it("HTML-escapes merge values (a contact name can never inject markup) and fills the unsubscribe URL", () => {
    const c = compileDesign(design);
    const r = renderForRecipient(c, { firstName: "<b>Ada</b>", email: "a@x.com" }, "https://site/unsub?token=abc");
    expect(r.html).toContain("&lt;b&gt;Ada&lt;/b&gt;");
    expect(r.html).not.toContain("<b>Ada</b>");
    expect(r.html).toContain("unsub?token=abc");
    expect(r.text).toContain("Unsubscribe: https://site/unsub?token=abc");
  });

  it("leaves no unresolved tokens after rendering", () => {
    const r = renderForRecipient(compileDesign(design), { firstName: "Ada" }, "https://site/u");
    expect(r.html).not.toMatch(/\{\{/);
    expect(r.text).not.toMatch(/\{\{/);
  });
});
