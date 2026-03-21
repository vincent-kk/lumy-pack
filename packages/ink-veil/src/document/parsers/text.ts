import chardet from "chardet";
import iconv from "iconv-lite";
import type { FidelityTier } from "../../types.js";
import type { FormatParser, ParsedDocument, TextSegment } from "../types.js";

const UTF8_BOM = Buffer.from([0xef, 0xbb, 0xbf]);
const UTF16LE_BOM = Buffer.from([0xff, 0xfe]);
const UTF16BE_BOM = Buffer.from([0xfe, 0xff]);

function detectBom(buffer: Buffer): string | null {
  if (buffer.slice(0, 3).equals(UTF8_BOM)) return "utf-8-bom";
  if (buffer.slice(0, 2).equals(UTF16LE_BOM)) return "utf-16le";
  if (buffer.slice(0, 2).equals(UTF16BE_BOM)) return "utf-16be";
  return null;
}

export class TextParser implements FormatParser {
  readonly tier: FidelityTier = "1a";
  private readonly format: string;

  constructor(format: string = "txt") {
    this.format = format;
  }

  async parse(buffer: Buffer, encoding?: string): Promise<ParsedDocument> {
    const bom = detectBom(buffer);
    const detectedEncoding =
      encoding ?? (bom ? bom : (chardet.detect(buffer) ?? "utf-8"));
    const normalizedEncoding = detectedEncoding
      .toLowerCase()
      .replace("utf-8-bom", "utf-8");

    let textBuffer = buffer;
    let hasBom = false;
    if (bom === "utf-8-bom") {
      hasBom = true;
      textBuffer = buffer.slice(3);
    } else if (bom === "utf-16le" || bom === "utf-16be") {
      hasBom = true;
    }

    const text = iconv.decode(textBuffer, normalizedEncoding);

    const segments: TextSegment[] = [];
    if (this.format === "md") {
      // Split markdown into code blocks (skippable) and regular text
      const codeBlockRegex = /```[\s\S]*?```|`[^`]+`/g;
      let lastIndex = 0;
      let match: RegExpExecArray | null;

      while ((match = codeBlockRegex.exec(text)) !== null) {
        if (match.index > lastIndex) {
          const chunk = text.slice(lastIndex, match.index);
          segments.push({
            text: chunk,
            position: { type: "offset", start: lastIndex, end: match.index },
            skippable: false,
          });
        }
        segments.push({
          text: match[0],
          position: {
            type: "offset",
            start: match.index,
            end: match.index + match[0].length,
          },
          skippable: true,
        });
        lastIndex = match.index + match[0].length;
      }
      if (lastIndex < text.length) {
        segments.push({
          text: text.slice(lastIndex),
          position: { type: "offset", start: lastIndex, end: text.length },
          skippable: false,
        });
      }
    } else {
      segments.push({
        text,
        position: { type: "offset", start: 0, end: text.length },
        skippable: false,
      });
    }

    return {
      format: this.format,
      tier: this.tier,
      encoding: detectedEncoding,
      segments,
      metadata: { hasBom, bomType: bom },
      originalBuffer: buffer,
    };
  }

  async reconstruct(parsed: ParsedDocument): Promise<Buffer> {
    const fullText = parsed.segments.map((s) => s.text).join("");
    const normalizedEncoding = parsed.encoding
      .toLowerCase()
      .replace("utf-8-bom", "utf-8");
    const encoded = iconv.encode(fullText, normalizedEncoding);

    if (parsed.metadata["hasBom"]) {
      const bomType = parsed.metadata["bomType"] as string | null;
      if (bomType === "utf-8-bom") {
        return Buffer.concat([UTF8_BOM, encoded]);
      } else if (bomType === "utf-16le") {
        return Buffer.concat([UTF16LE_BOM, encoded]);
      } else if (bomType === "utf-16be") {
        return Buffer.concat([UTF16BE_BOM, encoded]);
      }
    }

    return Buffer.from(encoded);
  }
}
