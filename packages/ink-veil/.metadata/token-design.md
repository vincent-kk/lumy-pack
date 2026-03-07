# Token Design & LLM Resilience

## 1. The Token Preservation Problem

When pseudonymized documents pass through an LLM, the tokens must survive intact for round-trip restoration. LLMs are not designed to preserve arbitrary markers — they are designed to understand and transform text.

```
Failure modes:
  PER_001           → "Person 1"        (semantic interpretation)
  PER_001           → PER 001           (whitespace insertion)
  <iv-per id="001"> → <iv-per id='001'> (quote style change)
  PER_001           → (omitted)         (dropped in summary)
  (none)            → PER_099           (hallucinated new token)
```

## 2. Token Format Comparison

| Format | Example | Preservation Rate | Parse Ease | Chosen |
|--------|---------|------------------|------------|--------|
| Plain | `PER_001` | Low — LLM treats as natural text | Easy | Mode option |
| Bracket | `{{PER_001}}` | Medium — template syntax recognized | Easy | Mode option |
| XML self-closing | `<iv-per id="001"/>` | High | High | No |
| **XML with content** | `<iv-per id="001">PER_001</iv-per>` | **Highest** | High | **Default** |
| Faker name | `김철수` | Highest (natural) | Low (collision) | Future |

### Why XML with Content Wins

1. **Structural integrity**: LLMs are trained on HTML/XML and preserve tag structure
2. **Redundant encoding**: the token ID appears in both the `id` attribute AND the content — dual recovery paths
3. **Namespace prefix**: `iv-` (ink-veil) acts as a distinctive marker unlikely to collide with real markup
4. **Category encoding**: tag name `iv-per`, `iv-org` encodes category — useful for LLM context
5. **Regex parseable**: clean regex extraction for all three fallback stages

```
Token anatomy:
  <iv-per id="001">PER_001</iv-per>
   ├── iv-per    → category = PER
   ├── id="001"  → sequential ID within category
   ├── PER_001   → human-readable content (also parseable)
   └── </iv-per> → closing tag for structural integrity
```

## 3. Token Generation

```typescript
class TokenGenerator {
  private counters: Map<string, number> = new Map();

  generate(category: string, mode: TokenMode): { token: string; plain: string } {
    const count = (this.counters.get(category) || 0) + 1;
    this.counters.set(category, count);

    const id = String(count).padStart(3, '0');
    const plain = `${category}_${id}`;

    switch (mode) {
      case 'xml':
        const tag = `iv-${category.toLowerCase()}`;
        return {
          token: `<${tag} id="${id}">${plain}</${tag}>`,
          plain
        };
      case 'bracket':
        return { token: `{{${plain}}}`, plain };
      case 'plain':
        return { token: plain, plain };
    }
  }
}
```

Token IDs are sequential within each category, zero-padded with dynamic width:
```
PER_001, PER_002, ..., PER_999, PER_1000, PER_1001, ...
ORG_001, ORG_002, ...
LOC_001, LOC_002, ...

Width rule:
  count <= 999  → 3 digits (PER_001)
  count > 999   → 4+ digits (PER_1000)
  Stage 3 regex \d{3,} matches both widths
```

**Counter initialization**: When loading an existing Dictionary via `Dictionary.fromJSON()`, the `TokenGenerator` must initialize its counters from the max existing ID per category. For example, if the dictionary contains `PER_042`, the PER counter starts at 43.

## 4. Three-Stage Fuzzy Unveil

The core defense against LLM token mutation. Applied sequentially — strict first, then increasingly permissive:

### Stage 1: Strict Match

```regex
/<iv-(\w+)\s+id="(\d+)">(.*?)<\/iv-\1>/g
```

Matches exact XML format. Captures:
- Group 1: category (per, org, loc...)
- Group 2: ID (001, 002...)
- Group 3: content (PER_001)

### Stage 2: Loose Match

```regex
/<iv-(\w+)[^>]*>([A-Z]+_\d+)<\/iv-\w+>/g
```

Tolerates:
- Attribute reordering
- Extra whitespace in attributes
- Quote style changes (`"` → `'`)
- Additional attributes added by LLM

### Stage 3: Plain Token Scan (Dynamic)

```typescript
// Stage 3 regex is dynamically generated from dictionary categories at unveil time.
// This ensures user-defined categories (PROJECT, INVOICE, etc.) are matched.

function buildStage3Regex(dictionary: Dictionary): RegExp {
  const categories = dictionary.getCategories(); // e.g., ['PER', 'ORG', 'LOC', 'PROJECT', ...]
  const pattern = `\\b(${categories.join('|')})_(\\d{3,})\\b`;
  return new RegExp(pattern, 'g');
}
```

Last resort — finds bare token IDs even if all XML structure was stripped. The regex is built from dictionary categories rather than hardcoded, supporting user-defined entity types.

### Stage Flow

```
Input: LLM response text

Stage 1 (strict):
  Find all exact XML matches → replace from reverseIndex
  Track: matchedTokens[]

Remaining unmatched text → Stage 2 (loose):
  Find relaxed XML matches → replace from reverseIndex
  Track: modifiedTokens[]

Remaining unmatched text → Stage 3 (plain):
  Find bare token IDs → replace from reverseIndex
  Track: modifiedTokens[]

After all stages:
  Scan for any remaining token-like patterns → unmatchedTokens[]
  Calculate: tokenIntegrity = matchedTokens / totalTokens
```

### Result Structure

```typescript
interface UnveilResult {
  document: ParsedDocument;
  matchedTokens: string[];      // restored via Stage 1 (perfect)
  modifiedTokens: string[];     // restored via Stage 2/3 (LLM altered format)
  unmatchedTokens: string[];    // tokens LLM hallucinated (not in dictionary)
  tokenIntegrity: number;       // matched / total (0.0 ~ 1.0)
}
```

`tokenIntegrity < 1.0` triggers a warning to the user with details about which tokens were modified or unmatched.

## 5. Invisible Signature

An optional instruction block injected into veiled documents to guide LLM behavior:

```
<!-- [ink-veil:signature:v1]
This document contains anonymized identifiers in <iv-*> XML tags.
RULES:
1. Preserve all <iv-*> tags exactly as they appear
2. Do not interpret, translate, or modify tag contents
3. Use tags consistently — same tag = same entity
4. Tags carry no semantic meaning beyond identification
5. When referencing entities, reuse the exact same tags
[/ink-veil:signature] -->
```

### Format-Specific Insertion

| Format | Insertion Method |
|--------|-----------------|
| TXT/MD | HTML comment `<!-- -->` at top |
| JSON | `"_inkveil_meta"` field |
| XML | XML comment node |
| HTML | `<meta>` tag or comment |
| DOCX | Custom XML part in ZIP |
| CSV | Comment row (prefixed with `#`) |

### Effectiveness Caveat

Signature effectiveness is **unverified**:
- Some LLMs may ignore document-embedded instructions
- Safety-tuned models may treat it as prompt injection
- Primary protection is the XML tag format itself, not the signature
- Benchmark needed: measure preservation ±signature across GPT-4, Claude, Gemini

The signature is a best-effort defense layer — a "please be careful" note to the LLM, not a guarantee.

## 6. Veil Dual Mode

`transform/` exposes two distinct veil functions to serve different consumers:

### 6.1 `veilTextFromSpans(text, spans, dictionary)` — Full Pipeline Mode

Used by the full `InkVeil` API after the detection pipeline produces `DetectionSpan[]`:

```
Full Pipeline Veil:
  1. Receive pre-computed DetectionSpan[] from detection pipeline
  2. Sort spans by start position DESCENDING (reverse offset order)
  3. Replace each span with its token from dictionary
  → Used by: InkVeil.veil(), CLI veil command
  → Requires: detection/ module (NER + Regex + Manual)
```

### 6.2 `veilTextFromDictionary(text, dictionary)` — Extension Mode (Lightweight)

For the Chrome Extension, veil operates without NER detection — pure dictionary lookup:

```
Extension Veil:
  1. Sort dictionary entries by original.length DESC (longest match first)
  2. For each entry: find all occurrences of entry.original in text
  3. Replace with entry.token
  → No NER, no regex detection, no new entity discovery
  → Used by: Chrome Extension (ink-veil-ext)
  → Import: @lumy-pack/ink-veil/transform
```

### 6.3 Shared Unveil

Both modes share the same `unveilText()` function with 3-stage fuzzy matching. The unveil path is identical regardless of how the document was veiled.

Longest-match-first ordering prevents partial replacement conflicts:
```
Dictionary: { "삼성전자": ORG_001, "삼성": ORG_002 }
Text: "삼성전자에서 발표"

Correct (longest first): "삼성전자" → ORG_001 first
Wrong (shortest first):  "삼성" → ORG_002, then "ORG_002전자" is corrupted
```
