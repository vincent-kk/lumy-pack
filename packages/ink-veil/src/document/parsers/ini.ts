import { isString } from "@winglet/common-utils";

import ini from "ini";
import type { FidelityTier } from "../../types.js";
import type { FormatParser, ParsedDocument, TextSegment } from "../types.js";

function extractIniSegments(
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
  } else if (obj !== null && typeof obj === "object") {
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      extractIniSegments(value, path ? `${path}.${key}` : key, segments);
    }
  }
}

function applyIniSegments(
  obj: unknown,
  path: string,
  segmentMap: Map<string, string>,
): unknown {
  if (isString(obj)) {
    return segmentMap.get(path) ?? obj;
  } else if (obj !== null && typeof obj === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      result[key] = applyIniSegments(
        value,
        path ? `${path}.${key}` : key,
        segmentMap,
      );
    }
    return result;
  }
  return obj;
}

export class IniParser implements FormatParser {
  readonly tier: FidelityTier = "1b";

  async parse(buffer: Buffer, _encoding?: string): Promise<ParsedDocument> {
    // INI comments are stripped entirely on stringify — warn unconditionally.
    process.stderr.write(
      "[ink-veil] Warning: INI comments are stripped during veil/unveil processing.\n",
    );

    const text = buffer.toString("utf-8");
    const parsed = ini.parse(text) as unknown;

    const segments: TextSegment[] = [];
    extractIniSegments(parsed, "", segments);

    return {
      format: "ini",
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
      if (seg.position.type === "jsonpath") {
        segmentMap.set(seg.position.path, seg.text);
      }
    }

    const original = parsedDoc.metadata["parsed"] as unknown;
    const updated = applyIniSegments(original, "", segmentMap);
    const text = ini.stringify(updated as Record<string, unknown>);
    return Buffer.from(text, "utf-8");
  }
}
