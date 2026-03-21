import type { FidelityTier } from "../../types.js";
import type { FormatParser, ParsedDocument } from "../types.js";

/**
 * HWP Parser — Tier 4 (experimental, best-effort).
 *
 * LIMITATIONS:
 * - HWP is a proprietary Korean document format by Hancom Office.
 * - No robust Node.js HWP library exists. Text extraction is best-effort only.
 * - HWP5 uses OLE Compound Document format; HWPx uses ZIP/XML.
 * - No round-trip guarantee. Verification returns passed: null.
 *
 * This implementation attempts HWPx (ZIP-based) extraction.
 * HWP5 (binary OLE) format is not supported.
 */
export class HwpParser implements FormatParser {
  readonly tier: FidelityTier = "4";

  async parse(buffer: Buffer, _encoding?: string): Promise<ParsedDocument> {
    process.stderr.write(
      "[ink-veil] Tier 4: HWP parsing is experimental — no round-trip guarantee.\n" +
        "[ink-veil] Tier 4: HWP5 (binary OLE) format is not supported; HWPx (ZIP) attempted.\n",
    );

    const segments: ParsedDocument["segments"] = [];

    try {
      // Attempt HWPx (ZIP-based) extraction
      const { default: JSZip } = await import("jszip");
      const zip = await JSZip.loadAsync(buffer);

      // HWPx stores content in Contents/section*.xml files
      const sectionFiles = Object.keys(zip.files)
        .filter((name) => /^Contents\/section\d+\.xml$/i.test(name))
        .sort();

      for (const filePath of sectionFiles) {
        const file = zip.file(filePath);
        if (!file) continue;
        const xmlText = await file.async("string");

        // Extract text from <hp:t> elements (HWPx text run elements)
        const textPattern = /<hp:t[^>]*>([^<]*)<\/hp:t>/g;
        let match: RegExpExecArray | null;
        let idx = 0;
        while ((match = textPattern.exec(xmlText)) !== null) {
          const text = match[1].trim();
          if (text) {
            segments.push({
              text,
              position: {
                type: "generic",
                info: { file: filePath, index: idx++ },
              },
              skippable: false,
            });
          }
        }
      }
    } catch {
      // Not a ZIP — likely HWP5 binary format, not supported
      process.stderr.write(
        "[ink-veil] Tier 4: HWP5 binary format detected — text extraction not supported.\n",
      );
    }

    return {
      format: "hwp",
      tier: this.tier,
      encoding: "utf-8",
      segments,
      metadata: {
        guarantee: "none",
        limitation:
          "HWP5 binary OLE not supported. HWPx ZIP extraction best-effort only.",
      },
      originalBuffer: buffer,
    };
  }

  async reconstruct(parsedDoc: ParsedDocument): Promise<Buffer> {
    process.stderr.write(
      "[ink-veil] Tier 4: HWP reconstruction not supported — returning original buffer.\n",
    );
    return parsedDoc.originalBuffer ?? Buffer.alloc(0);
  }
}
