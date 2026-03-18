# @lumy-pack/ink-veil

Korean PII detection and masking with multi-format document support and round-trip verification.

## Features

- **3-stage detection pipeline**: Manual rules → Regex patterns → NER (Kiwi NLP) for comprehensive PII coverage
- **15+ document formats**: TXT, CSV, JSON, YAML, XML, HTML, TOML, INI, PDF, DOCX, XLSX, PPTX, EPUB, and more
- **Round-trip fidelity**: Veil and unveil with integrity verification across 4 fidelity tiers
- **Token modes**: Tag (`<iv-per>`), bracket (`{{PER_001}}`), or plain (`PER_001`) output formats
- **Dual deployment**: Use as CLI tool or import as a programmatic library
- **Dictionary management**: Persistent token-to-PII mapping with SHA-256 signed entries

## Installation

```bash
npm install @lumy-pack/ink-veil
# or
yarn add @lumy-pack/ink-veil
```

## Quick Start

### CLI Usage

```bash
# Veil PII in a text file
npx @lumy-pack/ink-veil veil input.txt -o output.txt

# Veil with bracket token mode
npx @lumy-pack/ink-veil veil input.txt -o output.txt --mode bracket

# Unveil (restore) a veiled file
npx @lumy-pack/ink-veil unveil veiled.txt -d dictionary.json -o restored.txt

# Detect PII without masking
npx @lumy-pack/ink-veil detect input.txt

# Verify round-trip fidelity
npx @lumy-pack/ink-veil verify original.txt restored.txt

# Manage dictionary
npx @lumy-pack/ink-veil dict show dictionary.json
npx @lumy-pack/ink-veil dict merge dict1.json dict2.json -o merged.json

# Manage NER model
npx @lumy-pack/ink-veil model download
npx @lumy-pack/ink-veil model status
```

### Programmatic API

```typescript
import { InkVeil } from '@lumy-pack/ink-veil';

// Create an InkVeil instance
const iv = await InkVeil.create({ tokenMode: 'tag' });

// Veil text
const veiled = await iv.veilText('홍길동의 전화번호는 010-1234-5678입니다.');
console.log(veiled.text);       // Masked output
console.log(veiled.dictionary); // Token-to-PII mapping

// Unveil text
const restored = iv.unveilText(veiled.text);
console.log(restored.text);          // Original text restored
console.log(restored.tokenIntegrity); // 1.0 = perfect round-trip

// Save dictionary for later use
await iv.saveDictionary('dictionary.json');

// Dispose NER engine resources
await iv.dispose();
```

## How It Works

@lumy-pack/ink-veil executes a 3-stage detection pipeline:

1. **MANUAL**: User-defined literal strings and regex patterns applied first with highest priority
2. **REGEX**: Built-in regex patterns for Korean PII (phone numbers, emails, SSN, addresses, etc.)
3. **NER**: Kiwi NLP-based named entity recognition for names, organizations, and locations

Detected spans are merged, deduplicated, and mapped to tokens via the dictionary. Each token is SHA-256 signed for integrity verification.

## Token Modes

| Mode | Format | Example | Best for |
|------|--------|---------|----------|
| `tag` | XML tag | `<iv-per id="001">PER_001</iv-per>` | LLM preservation (default) |
| `bracket` | Double-brace | `{{PER_001}}` | Template systems |
| `plain` | Plain token | `PER_001` | Minimal markup |

## Supported Formats

| Tier | Guarantee | Formats |
|------|-----------|---------|
| **1a** | Byte-identical | TXT, MD, CSV, TSV |
| **1b** | Semantic-identical | JSON, XML, YAML, TOML, INI |
| **2** | Structure-preserved | DOCX, XLSX, HTML |
| **3** | Text-layer extraction | PDF, PPTX, EPUB |
| **4** | Experimental / best-effort | HWP, LaTeX |

## API Reference

### `InkVeil.create(options?: InkVeilOptions): Promise<InkVeil>`

Create an InkVeil instance with optional configuration.

**Options:**
- `tokenMode?` (`'tag' | 'bracket' | 'plain'`): Token output mode (default: `'tag'`)
- `manualRules?` (`ManualRule[]`): User-defined detection rules
- `noNer?` (boolean): Disable NER engine (default: `false`)
- `dictionaryPath?` (string): Load existing dictionary from path

### `veilText(text: string, sourceDocument?: string): Promise<VeilResult>`

Detect and mask PII in text using the 3-stage pipeline.

### `unveilText(text: string): UnveilResult`

Restore veiled text to its original form using the dictionary.

### `detect(text: string): Promise<DetectionSpan[]>`

Detect PII spans without masking. Returns span positions, categories, and detection methods.

### `verify(original: Buffer, restored: Buffer, tier: FidelityTier, format?: string): VerificationResult`

Verify round-trip fidelity between original and restored documents.

### `saveDictionary(path: string): Promise<void>`

Save the current dictionary to a JSON file.

### `dispose(): Promise<void>`

Release NER engine resources. Call when done processing.

## CLI Reference

| Command | Purpose |
|---------|---------|
| `ink-veil veil <files...>` | Veil PII in files |
| `--mode <tag\|bracket\|plain>` | Token output mode |
| `--no-ner` | Disable NER engine |
| `--manual-rules <path>` | Load manual rules from JSON |
| `-o, --output <path>` | Output file path |
| `-d, --dictionary <path>` | Dictionary file path |
| `ink-veil unveil <files...>` | Unveil (restore) veiled files |
| `--strict` | Fail if token integrity < 1.0 |
| `ink-veil detect <files...>` | Detect PII without masking |
| `ink-veil verify <original> <restored>` | Verify round-trip fidelity |
| `ink-veil dict show <path>` | Display dictionary contents |
| `ink-veil dict merge <files...>` | Merge multiple dictionaries |
| `ink-veil model download` | Download NER model |
| `ink-veil model status` | Check NER model status |

## Error Handling

Errors are typed via `InkVeilError` with specific error codes:

```typescript
import { InkVeil, InkVeilError, ErrorCode } from '@lumy-pack/ink-veil';

try {
  const iv = await InkVeil.create();
  await iv.veilText('...');
} catch (error) {
  if (error instanceof InkVeilError) {
    console.error(error.code);    // ErrorCode enum value
    console.error(error.message);
    console.error(error.context); // additional metadata
  }
}
```

Error codes:
- `GENERAL_ERROR` (1) — unclassified error
- `INVALID_ARGUMENTS` (2) — invalid CLI arguments or options
- `FILE_NOT_FOUND` (3) — input file does not exist
- `UNSUPPORTED_FORMAT` (4) — document format not supported
- `DICTIONARY_ERROR` (5) — dictionary load/save failure
- `NER_MODEL_FAILED` (6) — NER model initialization or inference error
- `VERIFICATION_FAILED` (7) — round-trip verification failed
- `TOKEN_INTEGRITY_BELOW_THRESHOLD` (8) — token integrity below configured threshold

## Requirements

- Node.js >= 20

## License

MIT
