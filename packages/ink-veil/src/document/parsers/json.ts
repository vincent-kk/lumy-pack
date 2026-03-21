import { isArray, isString } from "@winglet/common-utils";

import type { FidelityTier } from "../../types.js";
import type { FormatParser, ParsedDocument, TextSegment } from "../types.js";

function extractJsonSegments(
  obj: unknown,
  path: string,
  segments: TextSegment[],
): void {
  if (isString(obj)) {
    segments.push({
      text: obj,
      position: { type: "jsonpath", path },
      skippable: false,
    });
  } else if (isArray(obj)) {
    obj.forEach((item, i) =>
      extractJsonSegments(item, `${path}[${i}]`, segments),
    );
  } else if (obj !== null && typeof obj === "object") {
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      extractJsonSegments(value, path ? `${path}.${key}` : key, segments);
    }
  }
}

function applyJsonSegments(
  obj: unknown,
  path: string,
  segmentMap: Map<string, string>,
): unknown {
  if (isString(obj)) {
    return segmentMap.get(path) ?? obj;
  } else if (isArray(obj)) {
    return obj.map((item, i) =>
      applyJsonSegments(item, `${path}[${i}]`, segmentMap),
    );
  } else if (obj !== null && typeof obj === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      result[key] = applyJsonSegments(
        value,
        path ? `${path}.${key}` : key,
        segmentMap,
      );
    }
    return result;
  }
  return obj;
}

export class JsonParser implements FormatParser {
  readonly tier: FidelityTier = "1b";

  async parse(buffer: Buffer, _encoding?: string): Promise<ParsedDocument> {
    const text = buffer.toString("utf-8");
    const parsed = JSON.parse(text) as unknown;

    const segments: TextSegment[] = [];
    extractJsonSegments(parsed, "", segments);

    return {
      format: "json",
      tier: this.tier,
      encoding: "utf-8",
      segments,
      metadata: { parsed },
      originalBuffer: buffer,
    };
  }

  async reconstruct(parsed: ParsedDocument): Promise<Buffer> {
    const segmentMap = new Map<string, string>();
    for (const seg of parsed.segments) {
      if (seg.position.type === "jsonpath") {
        segmentMap.set(seg.position.path, seg.text);
      }
    }

    const original = parsed.metadata["parsed"] as unknown;
    const updated = applyJsonSegments(original, "", segmentMap);
    return Buffer.from(JSON.stringify(updated, null, 2), "utf-8");
  }
}
