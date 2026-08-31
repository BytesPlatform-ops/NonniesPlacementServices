import { describe, expect, it } from "vitest";
import {
  clearFormatting,
  insertHorizontalRule,
  insertLink,
  setHeading,
  toggleBlockquote,
  toggleBold,
  toggleBulletList,
  toggleInlineCode,
  toggleItalic,
  toggleOrderedList,
} from "./markdown-commands";

describe("inline formatting operates on the selection", () => {
  it("bolds the selected text", () => {
    // select "hello" in "hello"
    expect(toggleBold("hello", 0, 5).value).toBe("**hello**");
  });

  it("un-bolds when already bold (selection inside markers)", () => {
    expect(toggleBold("**hello**", 0, 9).value).toBe("hello");
  });

  it("italicizes the selected text", () => {
    expect(toggleItalic("hello", 0, 5).value).toBe("*hello*");
  });

  it("wraps inline code", () => {
    expect(toggleInlineCode("code", 0, 4).value).toBe("`code`");
  });

  it("bolds only the selected portion", () => {
    const r = toggleBold("important care information", 0, 9); // "important"
    expect(r.value).toBe("**important** care information");
  });

  it("inserts empty markers with the caret between when nothing is selected", () => {
    const r = toggleBold("", 0, 0);
    expect(r.value).toBe("****");
    expect(r.selStart).toBe(2);
    expect(r.selEnd).toBe(2);
  });
});

describe("headings produce valid Markdown H1–H6", () => {
  it("H1", () => expect(setHeading("hello", 0, 5, 1).value).toBe("# hello"));
  it("H2", () => expect(setHeading("hello", 0, 5, 2).value).toBe("## hello"));
  it("H3", () => expect(setHeading("hello", 0, 5, 3).value).toBe("### hello"));
  it("H6", () => expect(setHeading("hello", 0, 5, 6).value).toBe("###### hello"));

  it("replaces an existing heading level", () => {
    expect(setHeading("## hello", 0, 8, 3).value).toBe("### hello");
  });

  it("toggles a heading off to a paragraph", () => {
    expect(setHeading("## hello", 0, 8, 2).value).toBe("hello");
  });

  it("sets the level across multiple selected lines", () => {
    const v = "one\ntwo";
    expect(setHeading(v, 0, v.length, 2).value).toBe("## one\n## two");
  });
});

describe("lists and quotes", () => {
  it("makes a bullet list from selected lines", () => {
    const v = "one\ntwo";
    expect(toggleBulletList(v, 0, v.length).value).toBe("- one\n- two");
  });

  it("makes an ordered list with incrementing numbers", () => {
    const v = "one\ntwo\nthree";
    expect(toggleOrderedList(v, 0, v.length).value).toBe("1. one\n2. two\n3. three");
  });

  it("makes a blockquote", () => {
    const v = "quote me";
    expect(toggleBlockquote(v, 0, v.length).value).toBe("> quote me");
  });

  it("toggles a bullet list off", () => {
    const v = "- one\n- two";
    expect(toggleBulletList(v, 0, v.length).value).toBe("one\ntwo");
  });
});

describe("links and rules", () => {
  it("uses the selected text as the link label", () => {
    expect(insertLink("Nonnis", 0, 6, "https://example.com").value).toBe("[Nonnis](https://example.com)");
  });

  it("inserts a horizontal rule", () => {
    expect(insertHorizontalRule("a", 1, 1).value).toBe("a\n\n---\n\n");
  });
});

describe("clear formatting", () => {
  it("strips inline and line-prefix markers from the selection", () => {
    const v = "## **Bold** and *italic* and `code`";
    expect(clearFormatting(v, 0, v.length).value).toBe("Bold and italic and code");
  });
});
