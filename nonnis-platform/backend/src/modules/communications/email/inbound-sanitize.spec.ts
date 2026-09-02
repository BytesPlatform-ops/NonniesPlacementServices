import { buildPreviewText, htmlToPlainText, sanitizeInboundHtml } from "./inbound-sanitize";

describe("sanitizeInboundHtml", () => {
  it("removes script/iframe/style/form and event handlers", () => {
    const dirty = `<p onclick="steal()">Hi</p><script>evil()</script><iframe src="x"></iframe><style>b{}</style><form><input></form>`;
    const clean = sanitizeInboundHtml(dirty);
    expect(clean).toContain("<p>Hi</p>");
    expect(clean).not.toMatch(/script|iframe|onclick|<style|<form|<input/i);
  });

  it("drops javascript: and other unsafe link schemes but keeps safe links", () => {
    expect(sanitizeInboundHtml('<a href="javascript:alert(1)">x</a>')).not.toContain("javascript:");
    const safe = sanitizeInboundHtml('<a href="https://ok.com">x</a>');
    expect(safe).toContain('href="https://ok.com"');
    expect(safe).toContain('rel="noopener noreferrer nofollow"');
  });

  it("strips images entirely so remote tracking pixels never load", () => {
    const clean = sanitizeInboundHtml('<p>hi</p><img src="https://tracker.com/px.gif?u=1" width="1" height="1">');
    expect(clean).not.toMatch(/<img|tracker\.com/i);
  });

  it("neutralizes HTML injection wrappers", () => {
    const clean = sanitizeInboundHtml('<div><svg/onload=alert(1)></svg><object data="x"></object>ok</div>');
    expect(clean).not.toMatch(/svg|onload|object/i);
    expect(clean).toContain("ok");
  });
});

describe("htmlToPlainText + buildPreviewText", () => {
  it("extracts readable text from HTML", () => {
    expect(htmlToPlainText("<p>Hello <b>there</b></p>")).toBe("Hello there");
  });
  it("builds a bounded single-line preview", () => {
    const long = "word ".repeat(60);
    const preview = buildPreviewText(long);
    expect(preview.length).toBeLessThanOrEqual(160);
    expect(preview.endsWith("…")).toBe(true);
  });

  // Regression lock for the two published sanitize-html advisories that this
  // configuration is NOT exposed to (GHSA: javascript: URIs via
  // action/formaction/data/poster/background, and SVG SMIL scheme-policy
  // bypass). Our allowlist grants attributes to <a> only and never allows the
  // carrier tags at all, so the vectors cannot survive. These tests fail loudly
  // if the allowlist is ever widened.
  it("never lets advisory attribute vectors survive (action/formaction/poster/background/data)", () => {
    const attacks = [
      '<form action="javascript:alert(1)"><button formaction="javascript:alert(2)">x</button></form>',
      '<video poster="javascript:alert(3)"></video>',
      '<body background="javascript:alert(4)">x</body>',
      '<object data="javascript:alert(5)"></object>',
      '<td background="javascript:alert(6)">cell</td>',
    ];
    for (const attack of attacks) {
      const out = sanitizeInboundHtml(attack);
      expect(out.toLowerCase()).not.toContain("javascript:");
      expect(out.toLowerCase()).not.toMatch(/\b(action|formaction|poster|background|data)=/);
    }
  });

  it("never lets SVG or SMIL animation elements through", () => {
    const out = sanitizeInboundHtml(
      '<svg><animate attributeName="href" values="javascript:alert(1)" /><set attributeName="href" to="javascript:alert(2)" /></svg><p>kept</p>',
    );
    expect(out.toLowerCase()).not.toContain("svg");
    expect(out.toLowerCase()).not.toContain("animate");
    expect(out.toLowerCase()).not.toContain("javascript:");
    expect(out).toContain("kept");
  });
});
