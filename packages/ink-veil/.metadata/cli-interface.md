# CLI & Programmatic Interface

## 1. Design Principles for LLM-Agent Compatibility

ink-veil's CLI is designed to be operated by both humans and AI agents (Claude Code, Codex, etc.). This requires:

1. **Structured output**: JSON output mode for machine parsing
2. **Deterministic behavior**: same input → same output (no interactive prompts in non-TTY)
3. **Exit codes**: semantic exit codes beyond 0/1
4. **Streaming progress**: progress to stderr, results to stdout
5. **Composable**: each subcommand does one thing; pipe-friendly

### The Agent-CLI Contract

```
A well-designed agent CLI:
  ✅ Returns structured data (JSON) on stdout
  ✅ Sends progress/logs to stderr (doesn't pollute output)
  ✅ Uses semantic exit codes (agent can branch on failure type)
  ✅ Accepts all parameters as flags (no interactive prompts)
  ✅ Supports stdin piping for text input
  ✅ Has --help that fully documents each option
  ❌ Never requires interactive confirmation in CI/pipe mode
  ❌ Never outputs ANSI colors when stdout is not a TTY
```

## 2. CLI Structure

```
npx @lumy-pack/ink-veil <command> [options]

Commands:
  veil      Detect and replace PII in documents
  unveil    Restore original PII from veiled documents
  detect    Detect PII without transformation (dry-run)
  verify    Verify round-trip fidelity
  dict      Dictionary management (create, inspect, merge, export)
  version   Print version information
```

## 3. Command Reference

### 3.1 `veil` — Detect & Transform

```bash
# Single file
npx @lumy-pack/ink-veil veil input.docx -o output/ -d project.dict.json

# Multiple files (shared dictionary)
npx @lumy-pack/ink-veil veil doc1.txt doc2.csv doc3.json \
  -o veiled/ \
  -d project.dict.json \
  --token-mode xml

# Stdin text (pipe-friendly)
echo "홍길동의 전화번호는 010-1234-5678입니다" | \
  npx @lumy-pack/ink-veil veil --stdin -d project.dict.json

# JSON output for agents
npx @lumy-pack/ink-veil veil input.txt -d dict.json --json
```

**Options:**

| Flag | Short | Default | Description |
|------|-------|---------|-------------|
| `--output <dir>` | `-o` | `./veiled/` | Output directory for veiled files |
| `--dictionary <path>` | `-d` | `./dictionary.json` | Dictionary file (created if absent) |
| `--token-mode <mode>` | `-t` | `xml` | Token format: `xml`, `bracket`, `plain` |
| `--categories <list>` | `-c` | all | Entity categories to detect (comma-separated) |
| `--signature` | | `true` | Inject invisible signature |
| `--ner-model <name>` | | `gliner_multi-v2.1` | NER model name |
| `--ner-threshold <n>` | | `0.5` | NER confidence threshold (0-1) |
| `--no-ner` | | `false` | Disable NER, use regex-only |
| `--encrypt <password>` | | | Encrypt dictionary with password |
| `--stdin` | | `false` | Read text from stdin |
| `--json` | | `false` | Output structured JSON to stdout |
| `--verbose` | `-v` | `false` | Detailed logging to stderr |

**JSON Output Structure:**

```json
{
  "success": true,
  "command": "veil",
  "results": [
    {
      "input": "input.txt",
      "output": "veiled/input.txt",
      "format": "txt",
      "tier": "1a",
      "entitiesFound": 5,
      "newEntities": 3,
      "reusedEntities": 2,
      "categories": { "PER": 2, "PHONE": 1, "EMAIL": 1, "RRN": 1 }
    }
  ],
  "dictionary": {
    "path": "project.dict.json",
    "totalEntries": 15,
    "newEntries": 3,
    "version": "1.1.0"
  },
  "timing": {
    "totalMs": 2340,
    "parseMs": 120,
    "detectMs": 1800,
    "transformMs": 420
  }
}
```

### 3.2 `unveil` — Restore Original

```bash
# Single file
npx @lumy-pack/ink-veil unveil veiled/output.txt -d project.dict.json -o restored/

# Stdin (pipe LLM output directly)
curl -s https://api.openai.com/... | \
  npx @lumy-pack/ink-veil unveil --stdin -d project.dict.json

# With integrity report
npx @lumy-pack/ink-veil unveil llm-result.txt -d dict.json --json
```

**Options:**

| Flag | Short | Default | Description |
|------|-------|---------|-------------|
| `--output <dir>` | `-o` | `./restored/` | Output directory |
| `--dictionary <path>` | `-d` | `./dictionary.json` | Dictionary file |
| `--decrypt <password>` | | | Decrypt dictionary |
| `--stdin` | | `false` | Read from stdin |
| `--json` | | `false` | JSON output with integrity report |
| `--strict` | | `false` | Fail if tokenIntegrity < 1.0 |

**JSON Output Structure:**

```json
{
  "success": true,
  "command": "unveil",
  "results": [
    {
      "input": "llm-result.txt",
      "output": "restored/llm-result.txt",
      "tokenIntegrity": 0.95,
      "matchedTokens": ["PER_001", "ORG_001", "PHONE_001"],
      "modifiedTokens": ["PER_002"],
      "unmatchedTokens": ["PER_099"],
      "stages": { "strict": 3, "loose": 1, "plain": 0 }
    }
  ],
  "timing": { "totalMs": 45 }
}
```

### 3.3 `detect` — Dry-run Detection

```bash
# See what would be detected without transforming
npx @lumy-pack/ink-veil detect input.txt --json

# Detect from stdin
echo "홍길동 010-1234-5678" | npx @lumy-pack/ink-veil detect --stdin --json
```

**JSON Output:**

```json
{
  "success": true,
  "command": "detect",
  "results": [
    {
      "input": "input.txt",
      "entities": [
        {
          "text": "홍길동",
          "category": "PER",
          "method": "NER",
          "confidence": 0.95,
          "start": 0,
          "end": 3
        },
        {
          "text": "010-1234-5678",
          "category": "PHONE",
          "method": "REGEX",
          "confidence": 1.0,
          "start": 4,
          "end": 17
        }
      ],
      "summary": { "PER": 1, "PHONE": 1, "total": 2 }
    }
  ]
}
```

### 3.4 `verify` — Round-trip Check

```bash
npx @lumy-pack/ink-veil verify original.txt restored.txt --tier 1a --json
```

**JSON Output:**

```json
{
  "success": true,
  "command": "verify",
  "passed": true,
  "method": "sha256",
  "tier": "1a",
  "hashOriginal": "abc123...",
  "hashRestored": "abc123...",
  "detail": "Byte-identical"
}
```

### 3.5 `dict` — Dictionary Management

```bash
# Inspect dictionary contents
npx @lumy-pack/ink-veil dict inspect project.dict.json --json

# Merge two dictionaries
npx @lumy-pack/ink-veil dict merge dict-a.json dict-b.json -o merged.json --strategy keep-mine

# Export for Chrome Extension (plain JSON, no encryption)
npx @lumy-pack/ink-veil dict export project.dict.json -o extension-dict.json --decrypt mypassword

# Add manual entry
npx @lumy-pack/ink-veil dict add project.dict.json --original "특수코드" --category "SERIAL"

# List entries filtered by category
npx @lumy-pack/ink-veil dict list project.dict.json --category PER --json
```

## 4. Exit Codes

```
0   Success
1   General error
2   Invalid arguments / missing required options
3   File not found / permission denied
4   Unsupported file format
5   Dictionary error (corrupt, decrypt failed, version mismatch)
6   NER model load failed (fallback to regex)
7   Round-trip verification failed
8   Token integrity below threshold (--strict mode)
```

Agents can branch on exit codes:
```bash
npx @lumy-pack/ink-veil veil input.txt -d dict.json --json 2>/dev/null
case $? in
  0) echo "Success" ;;
  6) echo "NER failed, regex-only results" ;;
  7) echo "Round-trip verification failed" ;;
  *) echo "Error" ;;
esac
```

## 5. Programmatic API

### 5.1 Full API (Inkognito / Node.js consumers)

```typescript
import { InkVeil, Dictionary } from '@lumy-pack/ink-veil';

// Create engine with NER
const veil = await InkVeil.create({
  nerModel: 'gliner_multi-v2.1',
  nerThreshold: 0.5,
  tokenMode: 'xml',
  signatureEnabled: true,
  workerThread: true,
  detectionPriority: {
    default: ['MANUAL', 'REGEX', 'NER'],
    categoryOverride: {
      PER: ['MANUAL', 'NER', 'REGEX'],
      ORG: ['MANUAL', 'NER', 'REGEX'],
    }
  },
});

// Create or load dictionary
const dict = Dictionary.create();
// or: const dict = await Dictionary.load('project.dict.json');

// Single document
const result = await veil.veil(document, dict);

// Batch with progress
const batchResult = await veil.veilBatch(documents, dict, {
  onProgress: (event) => {
    // event.phase, event.current, event.total, event.percent
  },
  signal: abortController.signal,
});

// Unveil
const unveiled = await veil.unveil(llmDocument, dict);
// unveiled.tokenIntegrity, unveiled.matchedTokens, etc.

// Verify
const verified = await veil.verify(originalDoc, restoredDoc, { tier: '1a' });

// Save dictionary
await dict.save('project.dict.json');

// Cleanup
await veil.dispose();
```

### 5.2 Transform-only API (Chrome Extension / lightweight consumers)

```typescript
import { Dictionary, veilText, unveilText } from '@lumy-pack/ink-veil/transform';

// Load dictionary exported from Inkognito
const dict = Dictionary.fromJSON(jsonData);

// Text-level veil (no file parsing, no NER)
const veiled = veilText("홍길동의 계약서를 검토해주세요.", dict);
// → "<iv-per id=\"001\">PER_001</iv-per>의 계약서를 검토해주세요."

// Text-level unveil (3-stage fuzzy)
const result = unveilText(llmResponse, dict);
// → { text: "홍길동의 계약서를...", integrity: 0.95, ... }

// Dictionary queries
dict.entries();                      // all entries
dict.lookup('홍길동', 'PER');         // forward lookup
dict.reverseLookup('PER_001');       // reverse lookup
dict.stats();                        // { total, byCategory }
```

## 6. MCP Tool Integration

ink-veil can be exposed as an MCP (Model Context Protocol) tool server, allowing AI agents to call it directly without shell execution:

```json
{
  "tools": [
    {
      "name": "ink_veil_veil",
      "description": "De-identify PII in text. Returns veiled text and updated dictionary.",
      "inputSchema": {
        "type": "object",
        "properties": {
          "text": { "type": "string", "description": "Text to de-identify" },
          "dictionary_path": { "type": "string" },
          "token_mode": { "enum": ["xml", "bracket", "plain"], "default": "xml" },
          "categories": { "type": "array", "items": { "type": "string" } }
        },
        "required": ["text", "dictionary_path"]
      }
    },
    {
      "name": "ink_veil_unveil",
      "description": "Restore original PII from veiled text using dictionary.",
      "inputSchema": {
        "type": "object",
        "properties": {
          "text": { "type": "string", "description": "Veiled text to restore" },
          "dictionary_path": { "type": "string" }
        },
        "required": ["text", "dictionary_path"]
      }
    },
    {
      "name": "ink_veil_detect",
      "description": "Detect PII entities in text without transformation.",
      "inputSchema": {
        "type": "object",
        "properties": {
          "text": { "type": "string" },
          "categories": { "type": "array", "items": { "type": "string" } }
        },
        "required": ["text"]
      }
    }
  ]
}
```

This allows workflows like:
```
User: "이 계약서를 검토해줘" (with PII)
  → Agent calls ink_veil_veil (de-identify)
  → Agent sends veiled text to LLM for review
  → Agent calls ink_veil_unveil (restore)
  → User receives reviewed document with original PII
```

## 7. Pipe Composition Examples

```bash
# Detect → Veil → Send to LLM → Unveil (full pipeline)
cat contract.txt | \
  npx @lumy-pack/ink-veil veil --stdin -d dict.json | \
  curl -s -X POST https://api.openai.com/v1/chat/completions \
    -H "Authorization: Bearer $OPENAI_KEY" \
    -d @- | \
  jq -r '.choices[0].message.content' | \
  npx @lumy-pack/ink-veil unveil --stdin -d dict.json

# Batch detect → count PII by category
find ./docs -name "*.txt" -exec \
  npx @lumy-pack/ink-veil detect {} --json \; | \
  jq -s '[.[].results[].summary] | add'

# Export dictionary entries as CSV
npx @lumy-pack/ink-veil dict list dict.json --json | \
  jq -r '.entries[] | [.id, .original, .category] | @csv'
```
