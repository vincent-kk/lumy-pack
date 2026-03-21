import { isArray, isString } from "@winglet/common-utils";

import yaml from "js-yaml";
import type { FidelityTier } from "../../types.js";
import type { FormatParser, ParsedDocument, TextSegment } from "../types.js";

function extractYamlSegments(
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
      extractYamlSegments(item, `${path}[${i}]`, segments),
    );
  } else if (obj !== null && typeof obj === "object") {
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      extractYamlSegments(value, path ? `${path}.${key}` : key, segments);
    }
  }
}

function applyYamlSegments(
  obj: unknown,
  path: string,
  segmentMap: Map<string, string>,
): unknown {
  if (isString(obj)) {
    return segmentMap.get(path) ?? obj;
  } else if (isArray(obj)) {
    return obj.map((item, i) =>
      applyYamlSegments(item, `${path}[${i}]`, segmentMap),
    );
  } else if (obj !== null && typeof obj === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      result[key] = applyYamlSegments(
        value,
        path ? `${path}.${key}` : key,
        segmentMap,
      );
    }
    return result;
  }
  return obj;
}

export class YamlParser implements FormatParser {
  readonly tier: FidelityTier = "1b";

  async parse(buffer: Buffer, _encoding?: string): Promise<ParsedDocument> {
    // Warn about comment loss
    process.stderr.write(
      "[ink-veil] Warning: YAML comments are not preserved during veil/unveil processing.\n",
    );

    const text = buffer.toString("utf-8");
    const parsed = yaml.load(text) as unknown;

    const segments: TextSegment[] = [];
    extractYamlSegments(parsed, "", segments);

    return {
      format: "yaml",
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
    const updated = applyYamlSegments(original, "", segmentMap);
    const text = yaml.dump(updated, { lineWidth: -1 });
    return Buffer.from(text, "utf-8");
  }
}
