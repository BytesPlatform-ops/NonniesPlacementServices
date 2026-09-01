import { compileReply } from "./reply-format";

describe("compileReply", () => {
  it("compiles paragraphs, bold, italic and links to safe HTML + text", () => {
    const { html, text } = compileReply("Hello **world**\n\nVisit [our site](https://nonnis.com) or *email* us.");
    expect(html).toContain("<strong>world</strong>");
    expect(html).toContain('<a href="https://nonnis.com" target="_blank" rel="noopener noreferrer">our site</a>');
    expect(html).toContain("<em>email</em>");
    expect(text).toContain("Hello world");
    expect(text).toContain("our site (https://nonnis.com)");
  });

  it("renders bullet and numbered lists", () => {
    const { html } = compileReply("- one\n- two\n\n1. first\n2. second");
    expect(html).toContain("<ul><li>one</li><li>two</li></ul>");
    expect(html).toContain("<ol><li>first</li><li>second</li></ol>");
  });

  it("escapes raw HTML injection (never trusts author markup)", () => {
    const { html } = compileReply("<script>alert(1)</script> <b>x</b>");
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("&lt;b&gt;x&lt;/b&gt;");
  });

  it("drops an unsafe javascript: link but keeps the label", () => {
    const { html } = compileReply("[click](javascript:alert(1))");
    expect(html).not.toContain("javascript:");
    expect(html).toContain("click");
  });

  it("rejects an empty reply", () => {
    expect(() => compileReply("   ")).toThrow();
  });
});
