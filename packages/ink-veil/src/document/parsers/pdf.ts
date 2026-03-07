import type { FidelityTier } from '../../types.js';
import type { FormatParser, ParsedDocument } from '../types.js';

/**
 * PDF Parser — Tier 3 (text-layer extraction).
 *
 * LIMITATIONS:
 * - @libpdf/core (beta) is not bundled. PDF text extraction requires this optional dependency.
 * - Korean CID font mapping: CJK fonts in PDFs use CID (Character ID) rather than Unicode
 *   codepoints, making text extraction unreliable for Korean PDFs. Glyph positioning uses
 *   absolute coordinates, so text replacement may not preserve layout.
 * - Binary PDF output will differ from input (expected for Tier 3).
 *
 * INSTALL: yarn workspace @lumy-pack/ink-veil add @libpdf/core
 */
export class PdfParser implements FormatParser {
  readonly tier: FidelityTier = '3';

  async parse(buffer: Buffer, _encoding?: string): Promise<ParsedDocument> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let libpdf: any = null;
    try {
      // @ts-ignore — @libpdf/core is an optional dependency
      libpdf = await import('@libpdf/core');
    } catch {
      // @libpdf/core not installed — return empty segments with limitation warning
      process.stderr.write(
        '[ink-veil] Warning: PDF text extraction requires @libpdf/core (beta). ' +
        'Install with: yarn workspace @lumy-pack/ink-veil add @libpdf/core\n' +
        '[ink-veil] Warning: Korean CID font mapping may cause incorrect text extraction.\n',
      );
      return {
        format: 'pdf',
        tier: this.tier,
        encoding: 'binary',
        segments: [],
        metadata: {
          limitation: 'PDF text extraction requires @libpdf/core. Korean CID fonts may not extract correctly.',
          cidWarning: true,
        },
        originalBuffer: buffer,
      };
    }

    // @libpdf/core is available — perform text extraction
    process.stderr.write(
      '[ink-veil] Warning: Korean CID font mapping may cause incorrect text extraction for Korean PDFs.\n',
    );

    try {
      const doc = await libpdf.getDocument({ data: buffer }).promise;
      const segments: ParsedDocument['segments'] = [];

      for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
        const page = await doc.getPage(pageNum);
        const textContent = await page.getTextContent();

        for (let i = 0; i < textContent.items.length; i++) {
          const item = textContent.items[i] as { str?: string };
          if (typeof item.str === 'string' && item.str.trim()) {
            segments.push({
              text: item.str,
              position: {
                type: 'generic',
                info: { page: pageNum, itemIndex: i },
              },
              skippable: false,
            });
          }
        }
      }

      return {
        format: 'pdf',
        tier: this.tier,
        encoding: 'binary',
        segments,
        metadata: {
          pageCount: doc.numPages,
          cidWarning: true,
          limitation: 'Binary PDF output differs from input. Korean CID fonts may not extract correctly.',
          originalBuffer: buffer,
        },
        originalBuffer: buffer,
      };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      process.stderr.write(`[ink-veil] PDF parse error: ${msg}\n`);
      return {
        format: 'pdf',
        tier: this.tier,
        encoding: 'binary',
        segments: [],
        metadata: {
          error: msg,
          cidWarning: true,
          limitation: 'PDF parsing failed. Korean CID fonts may not extract correctly.',
        },
        originalBuffer: buffer,
      };
    }
  }

  async reconstruct(parsedDoc: ParsedDocument): Promise<Buffer> {
    // PDF reconstruction is not supported at Tier 3.
    // Return the original buffer — text-layer verification uses extracted text, not binary comparison.
    process.stderr.write(
      '[ink-veil] Warning: PDF binary reconstruction not supported (Tier 3). Returning original buffer.\n',
    );
    return parsedDoc.originalBuffer ?? Buffer.alloc(0);
  }
}
