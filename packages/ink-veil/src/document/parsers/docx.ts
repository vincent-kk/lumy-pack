import JSZip from 'jszip';
import { XMLParser, XMLBuilder } from 'fast-xml-parser';
import type { FidelityTier } from '../../types.js';
import type { FormatParser, ParsedDocument, TextSegment } from '../types.js';

// XML files inside DOCX that contain text content
const TEXT_XML_FILES = [
  'word/document.xml',
  'word/header1.xml',
  'word/header2.xml',
  'word/header3.xml',
  'word/footer1.xml',
  'word/footer2.xml',
  'word/footer3.xml',
];

const xmlParserOptions = {
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  preserveOrder: true,
  parseTagValue: false,
  trimValues: false,
};

const xmlBuilderOptions = {
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  preserveOrder: true,
  format: false,
};

function collectWtSegments(
  node: unknown,
  filePath: string,
  nodeIndex: number[],
  segments: TextSegment[],
): void {
  if (!Array.isArray(node)) return;
  node.forEach((child, i) => {
    if (typeof child !== 'object' || child === null) return;
    const entry = child as Record<string, unknown>;
    for (const [key, value] of Object.entries(entry)) {
      if (key === ':@' || key === '#text') continue;
      if (key === 'w:t' && Array.isArray(value)) {
        // Extract text content from w:t node
        const textNode = (value as unknown[]).find(
          (n) => typeof n === 'object' && n !== null && '#text' in (n as Record<string, unknown>),
        ) as Record<string, unknown> | undefined;
        if (textNode && typeof textNode['#text'] === 'string') {
          const xpath = `${filePath}:${[...nodeIndex, i].join('/')}/${key}`;
          segments.push({
            text: textNode['#text'],
            position: { type: 'xmlpath', xpath },
            skippable: false,
          });
        }
      } else if (Array.isArray(value)) {
        collectWtSegments(value, filePath, [...nodeIndex, i], segments);
      }
    }
  });
}

function applyWtSegments(
  node: unknown,
  filePath: string,
  nodeIndex: number[],
  segmentMap: Map<string, string>,
): unknown {
  if (!Array.isArray(node)) return node;
  return node.map((child, i) => {
    if (typeof child !== 'object' || child === null) return child;
    const entry = child as Record<string, unknown>;
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(entry)) {
      if (key === ':@' || key === '#text') {
        result[key] = value;
        continue;
      }
      if (key === 'w:t' && Array.isArray(value)) {
        const xpath = `${filePath}:${[...nodeIndex, i].join('/')}/${key}`;
        const replacement = segmentMap.get(xpath);
        if (replacement !== undefined) {
          result[key] = (value as unknown[]).map((n) => {
            if (typeof n === 'object' && n !== null && '#text' in (n as Record<string, unknown>)) {
              return { ...(n as Record<string, unknown>), '#text': replacement };
            }
            return n;
          });
        } else {
          result[key] = value;
        }
      } else if (Array.isArray(value)) {
        result[key] = applyWtSegments(value, filePath, [...nodeIndex, i], segmentMap);
      } else {
        result[key] = value;
      }
    }
    return result;
  });
}

export class DocxParser implements FormatParser {
  readonly tier: FidelityTier = '2';

  async parse(buffer: Buffer, _encoding?: string): Promise<ParsedDocument> {
    const zip = await JSZip.loadAsync(buffer);
    const segments: TextSegment[] = [];
    const xmlContents: Record<string, string> = {};

    for (const filePath of TEXT_XML_FILES) {
      const file = zip.file(filePath);
      if (!file) continue;
      const xmlText = await file.async('string');
      xmlContents[filePath] = xmlText;

      const parser = new XMLParser(xmlParserOptions);
      const parsed = parser.parse(xmlText) as unknown;
      collectWtSegments(parsed, filePath, [], segments);
    }

    return {
      format: 'docx',
      tier: this.tier,
      encoding: 'utf-8',
      segments,
      metadata: { xmlContents, originalBuffer: buffer },
      originalBuffer: buffer,
    };
  }

  async reconstruct(parsedDoc: ParsedDocument): Promise<Buffer> {
    const segmentMap = new Map<string, string>();
    for (const seg of parsedDoc.segments) {
      if (seg.position.type === 'xmlpath') {
        segmentMap.set(seg.position.xpath, seg.text);
      }
    }

    const xmlContents = parsedDoc.metadata['xmlContents'] as Record<string, string>;
    const originalBuffer = parsedDoc.metadata['originalBuffer'] as Buffer;

    const zip = await JSZip.loadAsync(originalBuffer);
    const builder = new XMLBuilder(xmlBuilderOptions);

    for (const [filePath, xmlText] of Object.entries(xmlContents)) {
      const parser = new XMLParser(xmlParserOptions);
      const parsed = parser.parse(xmlText) as unknown;
      const updated = applyWtSegments(parsed, filePath, [], segmentMap);
      const newXml = builder.build(updated) as string;
      zip.file(filePath, newXml);
    }

    const resultBuffer = await zip.generateAsync({
      type: 'nodebuffer',
      compression: 'DEFLATE',
    });
    return resultBuffer;
  }
}
