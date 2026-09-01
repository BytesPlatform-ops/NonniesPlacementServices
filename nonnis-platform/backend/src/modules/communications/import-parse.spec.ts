import { splitPasted, parseTxtLines, parseCsvContent } from "./import-parse";

describe("splitPasted", () => {
  it("splits on newlines, commas and semicolons and trims", () => {
    expect(splitPasted("john@x.com\njane@x.com")).toEqual(["john@x.com", "jane@x.com"]);
    expect(splitPasted("a@x.com, b@x.com ; c@x.com")).toEqual(["a@x.com", "b@x.com", "c@x.com"]);
    expect(splitPasted("  \n\n a@x.com \n ")).toEqual(["a@x.com"]);
  });
});

describe("parseTxtLines", () => {
  it("one value per non-empty line", () => {
    expect(parseTxtLines("a@x.com\n\n b@x.com \r\nc@x.com")).toEqual(["a@x.com", "b@x.com", "c@x.com"]);
  });
});

describe("parseCsvContent", () => {
  it("parses headers + rows and handles quoted commas and escaped quotes", () => {
    const csv = 'First,Last,Email,Company\n"Doe, Jr.",John,john@x.com,"Acme, Inc."\nJane,"O""Brien",jane@x.com,Globex';
    const { headers, rows } = parseCsvContent(csv);
    expect(headers).toEqual(["First", "Last", "Email", "Company"]);
    expect(rows[0]).toEqual(["Doe, Jr.", "John", "john@x.com", "Acme, Inc."]);
    expect(rows[1]).toEqual(["Jane", 'O"Brien', "jane@x.com", "Globex"]);
  });
  it("returns empty for empty input", () => {
    expect(parseCsvContent("")).toEqual({ headers: [], rows: [] });
  });
});
