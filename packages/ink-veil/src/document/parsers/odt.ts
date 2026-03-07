import JSZip from 'jszip';
import { XMLParser } from 'fast-xml-parser';
import type { FidelityTier } from '../../types.js';
import type { FormatParser, ParsedDocument } from '../types.js';

/**
 * ODT/ODS Parser — Tier 4 (experimental).
 *
 * LIMITATIONS:
 * - ODT (OpenDocument Text) and ODS (OpenDocument Spreadsheet) are ZIP-based XML formats.
 * - Text extraction from content.xml is best-effort.
 * - Styles, images, embedded objects, and macros are ignored.
 * - No round-trip guarantee. Verification returns passed: null.
 */

const xmlParserOptions = {
  ignoreAttributes: true,
  parseTagValue: false,
  trimValues: true,
};

function collectTextContent(obj: unknown, texts: string[]): void {
  if (typeof obj === 'string') {
    if (obj.trim()) texts.push(obj.trim());
  } else if (Array.isArray(obj)) {
    obj.forEach(item => collectTextContent(item, texts));
  } else if (obj !== null && typeof obj === 'object') {
    for (const value of Object.values(obj as Record<string, unknown>)) {
      collectTextContent(value, texts);
    }
  }
}

export class OdtParser implements FormatParser {
  readonly tier: FidelityTier = '4';
  private readonly format: string;

  constructor(format: string = 'odt') {
    this.format = format;
  }

  async parse(buffer: Buffer, _encoding?: string): Promise<ParsedDocument> {
    process.stderr.write(
      `[ink-veil] Tier 4: ${this.format.toUpperCase()} parsing is experimental — no round-trip guarantee.\n`,
    );

    const segments: ParsedDocument['segments'] = [];

    try {
      const zip = await JSZip.loadAsync(buffer);
      const contentFile = zip.file('content.xml');
      if (!contentFile) {
        process.stderr.write(`[ink-veil] Tier 4: content.xml not found in ${this.format} archive.\n`);
      } else {
        const xmlText = await contentFile.async('string');
        const parser = new XMLParser(xmlParserOptions);
        const parsed = parser.parse(xmlText) as unknown;

        const texts: string[] = [];
        collectTextContent(parsed, texts);

        texts.forEach((text, i) => {
          segments.push({
            text,
            position: { type: 'generic', info: { index: i } },
            skippable: false,
          });
        });
      }
    } catch (e) {
      process.stderr.write(
        `[ink-veil] Tier 4: ${this.format.toUpperCase()} parse error: ${e instanceof Error ? e.message : String(e)}\n`,
      );
    }

    return {
      format: this.format,
      tier: this.tier,
      encoding: 'utf-8',
      segments,
      metadata: {
        guarantee: 'none',
        limitation: `${this.format.toUpperCase()} extraction is best-effort. Styles and embedded objects ignored.`,
      },
      originalBuffer: buffer,
    };
  }

  async reconstruct(parsedDoc: ParsedDocument): Promise<Buffer> {
    process.stderr.write(
      `[ink-veil] Tier 4: ${this.format.toUpperCase()} reconstruction not supported — returning original buffer.\n`,
    );
    return parsedDoc.originalBuffer ?? Buffer.alloc(0);
  }
}
