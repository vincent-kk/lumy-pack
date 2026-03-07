import type { FidelityTier } from '../../types.js';
import type { FormatParser, ParsedDocument } from '../types.js';

/**
 * RTF Parser — Tier 4 (experimental, extraction only).
 *
 * LIMITATIONS:
 * - RTF is a complex format with nested control words and groups.
 * - This implementation uses regex-based text extraction — not a full RTF parser.
 * - Formatting, images, tables, and embedded objects are ignored.
 * - No round-trip guarantee. Verification returns passed: null.
 */

// Strip RTF control words and extract plain text (best-effort)
function extractRtfText(rtf: string): string {
  // Remove RTF header and info group
  let text = rtf
    .replace(/\{\\info[^}]*\}/gs, '')
    .replace(/\{\\fonttbl[^}]*\}/gs, '')
    .replace(/\{\\colortbl[^}]*\}/gs, '')
    .replace(/\{\\stylesheet[^}]*\}/gs, '');

  // Decode \uN? Unicode escapes
  text = text.replace(/\\u(-?\d+)\?/g, (_, code) => {
    const n = parseInt(code, 10);
    return String.fromCharCode(n < 0 ? n + 65536 : n);
  });

  // Remove remaining control words and groups
  text = text
    .replace(/\\[a-z*]+(-?\d+)?[ ]?/gi, '')
    .replace(/[{}\\]/g, '');

  // Normalize whitespace
  return text.replace(/\s+/g, ' ').trim();
}

export class RtfParser implements FormatParser {
  readonly tier: FidelityTier = '4';

  async parse(buffer: Buffer, _encoding?: string): Promise<ParsedDocument> {
    process.stderr.write(
      '[ink-veil] Tier 4: RTF parsing is experimental — no round-trip guarantee.\n',
    );

    const rtf = buffer.toString('latin1');
    const segments: ParsedDocument['segments'] = [];

    if (rtf.startsWith('{\\rtf')) {
      const extracted = extractRtfText(rtf);
      if (extracted.trim()) {
        // Split into sentences/paragraphs for segment granularity
        const parts = extracted.split(/\r?\n+/).filter(p => p.trim());
        parts.forEach((part, i) => {
          if (part.trim()) {
            segments.push({
              text: part.trim(),
              position: { type: 'generic', info: { index: i } },
              skippable: false,
            });
          }
        });
        // If no newlines, treat as single segment
        if (segments.length === 0 && extracted.trim()) {
          segments.push({
            text: extracted.trim(),
            position: { type: 'generic', info: { index: 0 } },
            skippable: false,
          });
        }
      }
    } else {
      process.stderr.write('[ink-veil] Tier 4: File does not appear to be valid RTF.\n');
    }

    return {
      format: 'rtf',
      tier: this.tier,
      encoding: 'latin1',
      segments,
      metadata: {
        guarantee: 'none',
        limitation: 'RTF extraction is regex-based best-effort. Formatting and embedded objects ignored.',
      },
      originalBuffer: buffer,
    };
  }

  async reconstruct(parsedDoc: ParsedDocument): Promise<Buffer> {
    process.stderr.write(
      '[ink-veil] Tier 4: RTF reconstruction not supported — returning original buffer.\n',
    );
    return parsedDoc.originalBuffer ?? Buffer.alloc(0);
  }
}
