import { describe, expect, it } from "vitest";
import { jsonLdScript } from "./json-ld";

const LS = " ";
const PS = " ";

describe("jsonLdScript", () => {
  it("never emits a literal </script> from CMS-controlled values", () => {
    const out = jsonLdScript({ name: "Sunrise</script><script>alert(1)</script>" });
    expect(out).not.toContain("</script>");
    expect(out).not.toContain("<");
    expect(out).not.toContain(">");
  });

  it("escapes ampersands and JS line terminators", () => {
    const out = jsonLdScript({ name: "A & B", note: `a${LS}b${PS}c` });
    expect(out).not.toContain("&");
    expect(out).not.toContain(LS);
    expect(out).not.toContain(PS);
  });

  it("still parses back to the identical structured data", () => {
    const data = { "@type": "LocalBusiness", name: `A & B </script>${LS}`, url: "https://x.test/?a=1&b=2" };
    expect(JSON.parse(jsonLdScript(data))).toEqual(data);
  });
});
