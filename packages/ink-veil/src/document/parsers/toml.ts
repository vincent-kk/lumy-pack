import TOML from '@ltd/j-toml';
import type { FidelityTier } from '../../types.js';
import type { FormatParser, ParsedDocument, TextSegment } from '../types.js';

function extractTomlSegments(obj: unknown, path: string, segments: TextSegment[]): void {
  if (typeof obj === 'string') {
    segments.push({
      text: obj,
      position: { type: 'jsonpath', path },
      skippable: false,
    });
  } else if (Array.isArray(obj)) {
    obj.forEach((item, i) => extractTomlSegments(item, `${path}[${i}]`, segments));
  } else if (obj !== null && typeof obj === 'object') {
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      extractTomlSegments(value, path ? `${path}.${key}` : key, segments);
    }
  }
}

function applyTomlSegments(
  obj: unknown,
  path: string,
  segmentMap: Map<string, string>,
): unknown {
  if (typeof obj === 'string') {
    return segmentMap.get(path) ?? obj;
  } else if (Array.isArray(obj)) {
    return obj.map((item, i) => applyTomlSegments(item, `${path}[${i}]`, segmentMap));
  } else if (obj !== null && typeof obj === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      result[key] = applyTomlSegments(value, path ? `${path}.${key}` : key, segmentMap);
    }
    return result;
  }
  return obj;
}

export class TomlParser implements FormatParser {
  readonly tier: FidelityTier = '1b';

  async parse(buffer: Buffer, _encoding?: string): Promise<ParsedDocument> {
    const text = buffer.toString('utf-8');
    const parsed = TOML.parse(text, { joiner: '\n', bigint: false }) as unknown;

    const segments: TextSegment[] = [];
    extractTomlSegments(parsed, '', segments);

    return {
      format: 'toml',
      tier: this.tier,
      encoding: 'utf-8',
      segments,
      metadata: { parsed },
      originalBuffer: buffer,
    };
  }

  async reconstruct(parsedDoc: ParsedDocument): Promise<Buffer> {
    const segmentMap = new Map<string, string>();
    for (const seg of parsedDoc.segments) {
      if (seg.position.type === 'jsonpath') {
        segmentMap.set(seg.position.path, seg.text);
      }
    }

    const original = parsedDoc.metadata['parsed'] as unknown;
    const updated = applyTomlSegments(original, '', segmentMap);
    const text = TOML.stringify(updated as Parameters<typeof TOML.stringify>[0], { newline: '\n' });
    return Buffer.from(text, 'utf-8');
  }
}
