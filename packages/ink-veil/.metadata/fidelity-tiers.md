# Fidelity Tiers & Parsers

## 1. The Fidelity Spectrum

File format determines the maximum achievable round-trip fidelity. A perfectly accurate veil/unveil cycle can still produce different bytes if the serializer doesn't preserve formatting details.

```
                    Guarantee Strength
  ◄────────────────────────────────────────────────►
  Byte-identical                          Best-effort

  Tier 1a          Tier 1b         Tier 2         Tier 3         Tier 4
  ┌─────┐         ┌─────┐        ┌─────┐        ┌─────┐        ┌─────┐
  │ TXT │         │ JSON│        │ DOCX│        │ PDF │        │ HWP │
  │ MD  │         │ XML │        │ XLSX│        │ PPTX│        │ RTF │
  │ CSV │         │ YAML│        │ HTML│        │ EPUB│        │ ODT │
  │ TSV │         │ TOML│        │     │        │     │        │ LaTeX│
  │     │         │ INI │        │     │        │     │        │     │
  └─────┘         └─────┘        └─────┘        └─────┘        └─────┘
  SHA-256 match    Semantic       Structure      Text-layer     Experimental
                   match          preserved      extraction
```

## 2. Tier Definitions

### Tier 1a — Byte-identical

**Guarantee**: `SHA-256(original) === SHA-256(unveil(veil(original)))`

The output is bit-for-bit identical to the input. Only possible with formats where the serializer preserves all formatting details.

| Format | Library | Implementation Notes |
|--------|---------|---------------------|
| TXT | Node.js `fs` | Encoding-aware via `chardet` + `iconv-lite`. BOM preserved. |
| MD | Node.js `fs` | Preserve markdown syntax. Skip code blocks (may contain PII-like patterns). |
| CSV | `papaparse` | Cell-level processing. Quoting style preserved. |
| TSV | `papaparse` (tab delimiter) | Same as CSV with tab separator. |

**Verification**: SHA-256 comparison of original and restored files.

### Tier 1b — Semantic-identical

**Guarantee**: Parsed content is identical; formatting may differ.

| Format | Library | Known Formatting Loss |
|--------|---------|----------------------|
| JSON | Built-in `JSON` | Whitespace, key order (integer keys), trailing commas |
| XML | `fast-xml-parser` | Whitespace between tags (configurable preservation) |
| YAML | `js-yaml` | **Comments dropped** on stringify |
| TOML | `@ltd/j-toml` | Minor whitespace differences |
| INI | `ini` (npm) | **Comments stripped entirely** |

**Verification**: Parse both files → deep-equal comparison of data structures.

**Critical caveat**: YAML and INI lose comments. Users must be warned before processing these formats.

### Tier 2 — Structure-preserved

**Guarantee**: Document structure and text content preserved; binary representation differs.

| Format | Library | Implementation Notes |
|--------|---------|---------------------|
| DOCX | `JSZip` + XML manipulation | Unzip → find XML text nodes → replace → rezip. **Do NOT use `docx` npm** (generation-only). JSZip recompression ≠ original binary. |
| XLSX | `SheetJS` (xlsx) | Cell-level processing. Formulas preserved (skip formula cells). |
| HTML | `cheerio` / `jsdom` | `jsdom` for strict fidelity. `cheerio` may lose whitespace. |

**Verification**: Extract all text nodes from both files → compare text arrays.

**DOCX implementation detail**:
```
DOCX is a ZIP containing XML files:
  word/document.xml  ← main content
  word/header1.xml   ← headers
  word/footer1.xml   ← footers

Strategy:
  1. Unzip with JSZip
  2. Parse XML text nodes (w:t elements)
  3. Replace PII in text nodes with tokens
  4. Rezip (compression may differ from original)
  → Binary differs, but content is identical
```

### Tier 3 — Text-layer

**Guarantee**: Text content extracted and replaced; layout preserved best-effort.

| Format | Library | Known Limitations |
|--------|---------|------------------|
| PDF | `@libpdf/core` | **Beta**. CJK font encoding issues. Korean text replacement challenging due to CID mapping and glyph positioning. Node 20+ required. |
| PPTX | `pptx` / `unzipper` | Text and slides OK. Animations and transitions may be lost. |
| EPUB | `epub2` / `node-epub` | Parse HTML chapters. Rebuild ZIP structure. |

**Verification**: Extract text from both files → compare extracted text.

**PDF reality check**: Korean PDF text replacement is the hardest problem in ink-veil. CJK fonts use CID (Character ID) mapping rather than Unicode codepoints, and text positioning uses absolute coordinates. `@libpdf/core` is the best available option but is in beta.

### Tier 4 — Experimental

**Guarantee**: None. Best-effort text comparison only.

| Format | Library | Status |
|--------|---------|--------|
| HWP | `hwp-parser` (forks) | Proprietary Korean format. Very limited Node.js ecosystem. |
| RTF | `rtf-parser` | Extraction only. No robust round-trip. |
| ODT | `mammoth` (experimental) | Text OK. Styles and images lose fidelity. |
| ODS | `xlsx` (partial) / `node-ods` | Limited. Falls back to ZIP/XML manipulation. |
| LaTeX | `latex-parser` / `textract` | Parse tokens only. Full reconstruction not possible. |

## 3. Parser Architecture

```typescript
// Format router — determines parser based on file extension
function getParser(format: string): FormatParser {
  switch (format) {
    case 'txt': case 'md':   return new TextParser();
    case 'csv': case 'tsv':  return new CsvParser();
    case 'json':             return new JsonParser();
    case 'xml':              return new XmlParser();
    case 'yaml': case 'yml': return new YamlParser();
    case 'docx':             return new DocxParser();
    case 'xlsx':             return new XlsxParser();
    case 'html':             return new HtmlParser();
    case 'pdf':              return new PdfParser();
    default:                 throw new UnsupportedFormatError(format);
  }
}

interface FormatParser {
  readonly tier: FidelityTier;

  // Extract text segments from document (preserving positions)
  parse(buffer: Buffer, encoding?: string): Promise<ParsedDocument>;

  // Reconstruct document with modified text segments
  reconstruct(parsed: ParsedDocument): Promise<Buffer>;
}

interface ParsedDocument {
  format: string;
  tier: FidelityTier;
  encoding: string;
  segments: TextSegment[];     // ordered text segments with positions
  metadata: Record<string, unknown>;  // format-specific metadata
  originalBuffer?: Buffer;     // kept for Tier 1a verification
}

interface TextSegment {
  text: string;
  position: SegmentPosition;   // format-specific location info
  skippable: boolean;          // true for code blocks, formulas, etc.
}
```

## 4. Implementation Priority

```
Phase 1 (MVP):
  Tier 1a: TXT, MD, CSV, TSV
  Tier 1b: JSON, XML, YAML
  → 7 formats covering most text-based documents

Phase 2 (Polish):
  Tier 1b: TOML, INI
  Tier 2:  DOCX, XLSX, HTML
  → 5 more formats covering office documents

Phase 3 (Advanced):
  Tier 3:  PDF, PPTX, EPUB
  → 3 complex formats requiring specialized handling

Phase 4 (Experimental):
  Tier 4:  HWP, RTF, ODT, ODS, LaTeX
  → Best-effort support for niche formats
```

## 5. Verification Strategy Per Tier

```typescript
async function verify(
  original: Buffer,
  restored: Buffer,
  tier: FidelityTier
): Promise<VerificationResult> {
  switch (tier) {
    case '1a': {
      const hashOrig = sha256(original);
      const hashRestored = sha256(restored);
      return {
        passed: hashOrig === hashRestored,
        method: 'sha256',
        detail: hashOrig === hashRestored ? 'Byte-identical' : 'Hash mismatch'
      };
    }
    case '1b': {
      const contentOrig = parse(original);
      const contentRestored = parse(restored);
      return {
        passed: deepEqual(contentOrig, contentRestored),
        method: 'semantic',
        detail: 'Parsed content comparison'
      };
    }
    case '2': {
      const nodesOrig = extractTextNodes(original);
      const nodesRestored = extractTextNodes(restored);
      return {
        passed: arraysEqual(nodesOrig, nodesRestored),
        method: 'structural',
        detail: 'Text node comparison'
      };
    }
    case '3': {
      const textOrig = extractText(original);
      const textRestored = extractText(restored);
      return {
        passed: textOrig === textRestored,
        method: 'text-layer',
        detail: 'Extracted text comparison'
      };
    }
    case '4':
      return { passed: null, method: 'none', detail: 'No verification for Tier 4' };
  }
}
```
