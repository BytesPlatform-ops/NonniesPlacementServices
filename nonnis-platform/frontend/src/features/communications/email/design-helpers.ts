import type { Block, EmailDesign, SimpleBlock } from "@/types/communications-email";

let counter = 0;
export function blockId(): string {
  counter += 1;
  return `b${Date.now().toString(36)}${counter}`;
}

export function defaultDesign(): EmailDesign {
  return {
    version: 1,
    settings: {
      backgroundColor: "#f2e8db",
      contentBackgroundColor: "#ffffff",
      contentWidth: 600,
      textColor: "#2b1b0e",
      linkColor: "#b56f28",
      fontFamily: "Arial, Helvetica, sans-serif",
    },
    blocks: [
      { id: blockId(), type: "heading", content: "Hello {{firstName}}", level: 1, align: "left" },
      { id: blockId(), type: "text", content: "Write your message here. Use **bold**, *italic*, and [links](https://nonnis.example).", align: "left" },
      { id: blockId(), type: "button", label: "Learn more", href: "https://nonnis.example", align: "left", backgroundColor: "#b56f28", textColor: "#ffffff", radius: 6 },
    ],
  };
}

export type BlockType = SimpleBlock["type"] | "columns";

export function newBlock(type: BlockType): Block {
  switch (type) {
    case "text":
      return { id: blockId(), type: "text", content: "New text block.", align: "left" };
    case "heading":
      return { id: blockId(), type: "heading", content: "Heading", level: 2, align: "left" };
    case "image":
      return { id: blockId(), type: "image", src: "", alt: "", align: "center", widthPct: 100 };
    case "button":
      return { id: blockId(), type: "button", label: "Button", href: "https://nonnis.example", align: "center", backgroundColor: "#b56f28", textColor: "#ffffff", radius: 6 };
    case "divider":
      return { id: blockId(), type: "divider" };
    case "spacer":
      return { id: blockId(), type: "spacer", height: 24 };
    case "columns":
      return {
        id: blockId(),
        type: "columns",
        columns: [
          [{ id: blockId(), type: "text", content: "Left column", align: "left" }],
          [{ id: blockId(), type: "text", content: "Right column", align: "left" }],
        ],
      };
  }
}

export const BLOCK_LABEL: Record<BlockType, string> = {
  text: "Text",
  heading: "Heading",
  image: "Image",
  button: "Button",
  divider: "Divider",
  spacer: "Spacer",
  columns: "Two columns",
};
