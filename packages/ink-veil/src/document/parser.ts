import { UnsupportedFormatError } from '../errors/types.js';
import { ok, err } from '../errors/result.js';
import type { Result } from '../errors/result.js';
import type { FormatParser } from './types.js';

/**
 * Format-to-parser registry.
 * Each entry maps a normalized extension to a lazy factory that
 * dynamically imports the parser module (keeps startup fast).
 */
const PARSER_REGISTRY: Record<string, () => Promise<FormatParser>> = {
  txt: async () => { const { TextParser } = await import('./parsers/text.js'); return new TextParser('txt'); },
  md: async () => { const { TextParser } = await import('./parsers/text.js'); return new TextParser('md'); },
  csv: async () => { const { CsvParser } = await import('./parsers/csv.js'); return new CsvParser('csv'); },
  tsv: async () => { const { CsvParser } = await import('./parsers/csv.js'); return new CsvParser('tsv'); },
  json: async () => { const { JsonParser } = await import('./parsers/json.js'); return new JsonParser(); },
  xml: async () => { const { XmlParser } = await import('./parsers/xml.js'); return new XmlParser(); },
  yaml: async () => { const { YamlParser } = await import('./parsers/yaml.js'); return new YamlParser(); },
  yml: async () => { const { YamlParser } = await import('./parsers/yaml.js'); return new YamlParser(); },
  docx: async () => { const { DocxParser } = await import('./parsers/docx.js'); return new DocxParser(); },
  xlsx: async () => { const { XlsxParser } = await import('./parsers/xlsx.js'); return new XlsxParser(); },
  html: async () => { const { HtmlParser } = await import('./parsers/html.js'); return new HtmlParser(); },
  htm: async () => { const { HtmlParser } = await import('./parsers/html.js'); return new HtmlParser(); },
  pptx: async () => { const { PptxParser } = await import('./parsers/pptx.js'); return new PptxParser(); },
  epub: async () => { const { EpubParser } = await import('./parsers/epub.js'); return new EpubParser(); },
  pdf: async () => { const { PdfParser } = await import('./parsers/pdf.js'); return new PdfParser(); },
  hwp: async () => { const { HwpParser } = await import('./parsers/hwp.js'); return new HwpParser(); },
  hwpx: async () => { const { HwpParser } = await import('./parsers/hwp.js'); return new HwpParser(); },
  tex: async () => { const { LatexParser } = await import('./parsers/latex.js'); return new LatexParser(); },
  latex: async () => { const { LatexParser } = await import('./parsers/latex.js'); return new LatexParser(); },
  toml: async () => { const { TomlParser } = await import('./parsers/toml.js'); return new TomlParser(); },
  ini: async () => { const { IniParser } = await import('./parsers/ini.js'); return new IniParser(); },
};

export async function getParser(format: string): Promise<Result<FormatParser>> {
  const fmt = format.toLowerCase().replace(/^\./, '');
  const factory = PARSER_REGISTRY[fmt];
  if (!factory) {
    return err(new UnsupportedFormatError(format));
  }
  return ok(await factory());
}
