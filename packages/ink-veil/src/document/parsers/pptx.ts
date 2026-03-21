import { isArray, isString, filter } from "@winglet/common-utils";

import JSZip from "jszip";
import { XMLParser, XMLBuilder } from "fast-xml-parser";
import type { FidelityTier } from "../../types.js";
import type { FormatParser, ParsedDocument, TextSegment } from "../types.js";

// PPTX slide XML files follow the pattern ppt/slides/slide{N}.xml
const SLIDE_PATTERN = /^ppt\/slides\/slide\d+\.xml$/;

const xmlParserOptions = {
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  preserveOrder: true,
  parseTagValue: false,
  trimValues: false,
};

const xmlBuilderOptions = {
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  preserveOrder: true,
  format: false,
};

function collectAtSegments(
  node: unknown,
  filePath: string,
  path: string,
  segments: TextSegment[],
): void {
  if (!isArray(node)) return;
  node.forEach((child, i) => {
    if (typeof child !== "object" || child === null) return;
    const entry = child as Record<string, unknown>;
    for (const [key, value] of Object.entries(entry)) {
      if (key === ":@") continue;
      if (key === "a:t" && isArray(value)) {
        // a:t is the DrawingML text run element
        const textNode = (value as unknown[]).find(
          (n) =>
            typeof n === "object" &&
            n !== null &&
            "#text" in (n as Record<string, unknown>),
        ) as Record<string, unknown> | undefined;
        if (
          textNode &&
          isString(textNode["#text"]) &&
          textNode["#text"].trim()
        ) {
          const xpath = `${filePath}:${path}/${i}/${key}`;
          segments.push({
            text: textNode["#text"],
            position: { type: "xmlpath", xpath },
            skippable: false,
          });
        }
      } else if (isArray(value)) {
        collectAtSegments(value, filePath, `${path}/${key}/${i}`, segments);
      }
    }
  });
}

function applyAtSegments(
  node: unknown,
  filePath: string,
  path: string,
  segmentMap: Map<string, string>,
): unknown {
  if (!isArray(node)) return node;
  return node.map((child, i) => {
    if (typeof child !== "object" || child === null) return child;
    const entry = child as Record<string, unknown>;
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(entry)) {
      if (key === ":@") {
        result[key] = value;
        continue;
      }
      if (key === "a:t" && isArray(value)) {
        const xpath = `${filePath}:${path}/${i}/${key}`;
        const replacement = segmentMap.get(xpath);
        if (replacement !== undefined) {
          result[key] = (value as unknown[]).map((n) => {
            if (
              typeof n === "object" &&
              n !== null &&
              "#text" in (n as Record<string, unknown>)
            ) {
              return {
                ...(n as Record<string, unknown>),
                "#text": replacement,
              };
            }
            return n;
          });
        } else {
          result[key] = value;
        }
      } else if (isArray(value)) {
        result[key] = applyAtSegments(
          value,
          filePath,
          `${path}/${key}/${i}`,
          segmentMap,
        );
      } else {
        result[key] = value;
      }
    }
    return result;
  });
}

export class PptxParser implements FormatParser {
  readonly tier: FidelityTier = "3";

  async parse(buffer: Buffer, _encoding?: string): Promise<ParsedDocument> {
    const zip = await JSZip.loadAsync(buffer);
    const segments: TextSegment[] = [];
    const xmlContents: Record<string, string> = {};

    // Collect all slide XML files in order
    const slideFiles = filter(Object.keys(zip.files), (name) =>
      SLIDE_PATTERN.test(name),
    ).sort();

    for (const filePath of slideFiles) {
      const file = zip.file(filePath);
      if (!file) continue;
      const xmlText = await file.async("string");
      xmlContents[filePath] = xmlText;

      const parser = new XMLParser(xmlParserOptions);
      const parsed = parser.parse(xmlText) as unknown;
      collectAtSegments(parsed, filePath, "", segments);
    }

    return {
      format: "pptx",
      tier: this.tier,
      encoding: "utf-8",
      segments,
      metadata: { xmlContents, originalBuffer: buffer },
      originalBuffer: buffer,
    };
  }

  async reconstruct(parsedDoc: ParsedDocument): Promise<Buffer> {
    const segmentMap = new Map<string, string>();
    for (const seg of parsedDoc.segments) {
      if (seg.position.type === "xmlpath") {
        segmentMap.set(seg.position.xpath, seg.text);
      }
    }

    const xmlContents = parsedDoc.metadata["xmlContents"] as Record<
      string,
      string
    >;
    const originalBuffer = parsedDoc.metadata["originalBuffer"] as Buffer;

    const zip = await JSZip.loadAsync(originalBuffer);
    const builder = new XMLBuilder(xmlBuilderOptions);

    for (const [filePath, xmlText] of Object.entries(xmlContents)) {
      const parser = new XMLParser(xmlParserOptions);
      const parsed = parser.parse(xmlText) as unknown;
      const updated = applyAtSegments(parsed, filePath, "", segmentMap);
      const newXml = builder.build(updated) as string;
      zip.file(filePath, newXml);
    }

    return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
  }
}
