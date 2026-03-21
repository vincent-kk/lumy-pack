import { isArray, isString } from "@winglet/common-utils";

import { XMLParser, XMLBuilder } from "fast-xml-parser";
import type { FidelityTier } from "../../types.js";
import type { FormatParser, ParsedDocument, TextSegment } from "../types.js";

const parserOptions = {
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  preserveOrder: true,
  parseTagValue: false,
  trimValues: false,
  cdataPropName: "__cdata",
};

const builderOptions = {
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  preserveOrder: true,
  cdataPropName: "__cdata",
  format: false,
};

function collectTextSegments(
  node: unknown,
  xpath: string,
  segments: TextSegment[],
): void {
  if (isArray(node)) {
    node.forEach((child, i) => {
      if (typeof child === "object" && child !== null) {
        for (const [key, value] of Object.entries(
          child as Record<string, unknown>,
        )) {
          if (key === "#text" && isString(value)) {
            segments.push({
              text: value,
              position: { type: "xmlpath", xpath: `${xpath}/#text[${i}]` },
              skippable: false,
            });
          } else if (key === ":@") {
            // attributes — skip
          } else if (isArray(value)) {
            collectTextSegments(value, `${xpath}/${key}`, segments);
          }
        }
      }
    });
  }
}

function applyTextSegments(
  node: unknown,
  xpath: string,
  segmentMap: Map<string, string>,
): unknown {
  if (isArray(node)) {
    return node.map((child, i) => {
      if (typeof child === "object" && child !== null) {
        const result: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(
          child as Record<string, unknown>,
        )) {
          if (key === "#text" && isString(value)) {
            const path = `${xpath}/#text[${i}]`;
            result[key] = segmentMap.get(path) ?? value;
          } else if (key === ":@") {
            result[key] = value;
          } else if (isArray(value)) {
            result[key] = applyTextSegments(
              value,
              `${xpath}/${key}`,
              segmentMap,
            );
          } else {
            result[key] = value;
          }
        }
        return result;
      }
      return child;
    });
  }
  return node;
}

export class XmlParser implements FormatParser {
  readonly tier: FidelityTier = "1b";

  async parse(buffer: Buffer, _encoding?: string): Promise<ParsedDocument> {
    const text = buffer.toString("utf-8");
    const parser = new XMLParser(parserOptions);
    const parsed = parser.parse(text) as unknown;

    const segments: TextSegment[] = [];
    collectTextSegments(parsed, "", segments);

    return {
      format: "xml",
      tier: this.tier,
      encoding: "utf-8",
      segments,
      metadata: { parsed },
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

    const original = parsedDoc.metadata["parsed"] as unknown;
    const updated = applyTextSegments(original, "", segmentMap);
    const builder = new XMLBuilder(builderOptions);
    const xml = builder.build(updated) as string;
    return Buffer.from(xml, "utf-8");
  }
}
