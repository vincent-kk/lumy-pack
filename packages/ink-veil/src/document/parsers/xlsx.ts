import XLSX from 'xlsx';
import type { FidelityTier } from '../../types.js';
import type { FormatParser, ParsedDocument, TextSegment } from '../types.js';

export class XlsxParser implements FormatParser {
  readonly tier: FidelityTier = '2';

  async parse(buffer: Buffer, _encoding?: string): Promise<ParsedDocument> {
    const workbook = XLSX.read(buffer, { type: 'buffer', cellFormula: true, raw: true });
    const segments: TextSegment[] = [];

    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];
      if (!sheet) continue;

      for (const [cellAddr, cell] of Object.entries(sheet)) {
        if (cellAddr.startsWith('!')) continue;
        const c = cell as XLSX.CellObject;

        // Skip formula cells — only process string/text values
        if (c.f !== undefined) continue;
        if (c.t !== 's') continue;
        if (typeof c.v !== 'string' || c.v === '') continue;

        segments.push({
          text: c.v,
          position: {
            type: 'generic',
            info: { sheet: sheetName, cell: cellAddr },
          },
          skippable: false,
        });
      }
    }

    return {
      format: 'xlsx',
      tier: this.tier,
      encoding: 'binary',
      segments,
      metadata: { workbook: XLSX.write(workbook, { type: 'base64', bookType: 'xlsx' }) },
      originalBuffer: buffer,
    };
  }

  async reconstruct(parsedDoc: ParsedDocument): Promise<Buffer> {
    // Rebuild segment map: sheet+cell → new text
    const segmentMap = new Map<string, string>();
    for (const seg of parsedDoc.segments) {
      if (seg.position.type === 'generic') {
        const { sheet, cell } = seg.position.info as { sheet: string; cell: string };
        segmentMap.set(`${sheet}::${cell}`, seg.text);
      }
    }

    const base64 = parsedDoc.metadata['workbook'] as string;
    const workbook = XLSX.read(base64, { type: 'base64', cellFormula: true, raw: true });

    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];
      if (!sheet) continue;

      for (const [cellAddr, cell] of Object.entries(sheet)) {
        if (cellAddr.startsWith('!')) continue;
        const c = cell as XLSX.CellObject;
        if (c.f !== undefined) continue;
        if (c.t !== 's') continue;

        const key = `${sheetName}::${cellAddr}`;
        const replacement = segmentMap.get(key);
        if (replacement !== undefined) {
          c.v = replacement;
          if (c.w !== undefined) c.w = replacement;
        }
      }
    }

    const resultBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
    return resultBuffer;
  }
}
