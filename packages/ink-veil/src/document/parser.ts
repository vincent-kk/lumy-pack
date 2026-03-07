import { UnsupportedFormatError } from '../errors/types.js';
import { ok, err } from '../errors/result.js';
import type { Result } from '../errors/result.js';
import type { FormatParser } from './types.js';

export async function getParser(format: string): Promise<Result<FormatParser>> {
  const fmt = format.toLowerCase().replace(/^\./, '');
  switch (fmt) {
    case 'txt':
    case 'md': {
      const { TextParser } = await import('./parsers/text.js');
      return ok(new TextParser(fmt));
    }
    case 'csv':
    case 'tsv': {
      const { CsvParser } = await import('./parsers/csv.js');
      return ok(new CsvParser(fmt));
    }
    case 'json': {
      const { JsonParser } = await import('./parsers/json.js');
      return ok(new JsonParser());
    }
    case 'xml': {
      const { XmlParser } = await import('./parsers/xml.js');
      return ok(new XmlParser());
    }
    case 'yaml':
    case 'yml': {
      const { YamlParser } = await import('./parsers/yaml.js');
      return ok(new YamlParser());
    }
    case 'docx': {
      const { DocxParser } = await import('./parsers/docx.js');
      return ok(new DocxParser());
    }
    case 'xlsx': {
      const { XlsxParser } = await import('./parsers/xlsx.js');
      return ok(new XlsxParser());
    }
    case 'html':
    case 'htm': {
      const { HtmlParser } = await import('./parsers/html.js');
      return ok(new HtmlParser());
    }
    case 'pptx': {
      const { PptxParser } = await import('./parsers/pptx.js');
      return ok(new PptxParser());
    }
    case 'epub': {
      const { EpubParser } = await import('./parsers/epub.js');
      return ok(new EpubParser());
    }
    case 'pdf': {
      const { PdfParser } = await import('./parsers/pdf.js');
      return ok(new PdfParser());
    }
    case 'hwp':
    case 'hwpx': {
      const { HwpParser } = await import('./parsers/hwp.js');
      return ok(new HwpParser());
    }
    case 'rtf': {
      const { RtfParser } = await import('./parsers/rtf.js');
      return ok(new RtfParser());
    }
    case 'odt':
    case 'ods': {
      const { OdtParser } = await import('./parsers/odt.js');
      return ok(new OdtParser(fmt));
    }
    case 'tex':
    case 'latex': {
      const { LatexParser } = await import('./parsers/latex.js');
      return ok(new LatexParser());
    }
    default:
      return err(new UnsupportedFormatError(format));
  }
}
