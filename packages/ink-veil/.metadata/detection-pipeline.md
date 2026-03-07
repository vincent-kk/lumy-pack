# Detection Pipeline

## 1. Three Detection Engines

ink-veil uses a hybrid detection architecture that combines three engines, each optimized for different PII categories:

```
┌─────────────────────────────────────────────┐
│                 Detection Pipeline           │
│                                             │
│  ┌─────────┐  ┌─────────┐  ┌────────────┐  │
│  │ MANUAL  │  │  REGEX  │  │    NER     │  │
│  │         │  │         │  │ (GLiNER)   │  │
│  │ User-   │  │ Pattern │  │ Span-based │  │
│  │ defined │  │ matching│  │ extraction │  │
│  │ rules   │  │ 15+ PII │  │ zero-shot  │  │
│  └────┬────┘  └────┬────┘  └─────┬──────┘  │
│       │            │             │          │
│       └────────────┼─────────────┘          │
│                    ▼                        │
│            ┌──────────────┐                 │
│            │   MERGER     │                 │
│            │ longest match│                 │
│            │ priority sort│                 │
│            └──────┬───────┘                 │
│                   ▼                         │
│           Deduplicated Spans                │
└─────────────────────────────────────────────┘
```

### 1.1 MANUAL Engine

User-defined pattern rules for domain-specific entities that neither NER nor Regex can detect:

```typescript
// Examples:
{ pattern: "Project-Alpha", category: "PROJECT", method: "MANUAL" }
{ pattern: /INV-\d{8}/g, category: "INVOICE", method: "MANUAL" }
{ pattern: "특수코드-A1", category: "SERIAL", method: "MANUAL" }
```

Highest priority by default — user's explicit intent overrides automated detection.

### 1.2 REGEX Engine

15+ Korean PII patterns validated against PIPC guidelines:

| Category | Pattern Description | Confidence |
|----------|-------------------|------------|
| RRN | 주민등록번호 `YYMMDD-XXXXXXX` | High |
| ARN | 외국인등록번호 (7th digit 5-8) | Medium |
| DL | 운전면허번호 | Medium |
| PASSPORT | 여권번호 `[MHP]+alphanumeric` | Medium |
| BRN | 사업자등록번호 `XXX-XX-XXXXX` | High |
| CRN | 법인등록번호 (= RRN format) | Low |
| PHONE | 휴대폰 `01X-XXXX-XXXX` | High |
| TEL | 유선전화 (지역번호) | Medium |
| EMAIL | 이메일 주소 | High |
| CARD | 신용카드번호 (Visa/MC/Amex) | High |
| ACCOUNT | 계좌번호 (hyphen required) | Low |
| IP | IPv4 (0-255 validated) | Medium |
| SERIAL | 일련번호 (broad pattern) | Low |

#### RRN/CRN Disambiguation

RRN (주민등록번호) and CRN (법인등록번호) share identical regex patterns (`\d{6}-?\d{7}`). Resolution strategy:

```
Phase 1 (MVP):   Unified category "NATIONAL_ID" — treat as same type
Phase 2:         Check digit validation (Luhn-like algorithm for RRN)
Phase 3:         Context analysis ("법인" nearby → CRN; "생년" → RRN)
```

### 1.3 NER Engine (GLiNER)

Span-based zero-shot NER using ONNX inference:

```
Model: urchade/gliner_multi-v2.1 (~150MB INT8 quantized)
Fallback: taeminlee/gliner_ko (Korean-optimized)
Runtime: Transformers.js v3 / ONNX Runtime
Execution: Worker Thread (non-blocking)
License: Apache 2.0
```

**Zero-shot capability**: Entity types are defined at query time, not during training. This means ink-veil can detect any user-specified entity type without model retraining:

```typescript
const results = await ner.detect(text, {
  labels: ["PER", "ORG", "LOC", "DATE", "PRODUCT"],
  threshold: 0.5
});
// → [{ text: "홍길동", label: "PER", score: 0.95, start: 0, end: 3 }]
```

#### NER Lifecycle

```
InkVeil.create({ nerModel: 'gliner_multi-v2.1', workerThread: true })
  │
  ├→ Spawn Worker Thread
  │    └→ Load ONNX model into memory (~2-3s cold start)
  │        Model stays resident for all subsequent inferences
  │
  ├→ Fallback chain:
  │    1. Primary model (gliner_multi-v2.1)
  │    2. Korean fallback (gliner_ko)
  │    3. Regex-only mode (emit warning, no NER)
  │
  └→ InkVeil.dispose()
       └→ Terminate Worker Thread, release model memory

Worker Thread Architecture:
  Main Thread ←─IPC─→ NER Worker Thread
    send: text segments          receive: detection results
    receive: NER spans           send: text segments
    (UI stays responsive)        (model loaded once, reused)
```

## 2. Detection Merge Algorithm

### 2.1 Priority Configuration

```typescript
interface DetectionConfig {
  priorityOrder: ('MANUAL' | 'REGEX' | 'NER')[];
  // default: ['MANUAL', 'REGEX', 'NER']

  categoryPriority: Record<string, ('MANUAL' | 'REGEX' | 'NER')[]>;
  // override per category, e.g.:
  // { PER: ['MANUAL', 'NER', 'REGEX'], RRN: ['MANUAL', 'REGEX', 'NER'] }
}
```

Rationale:
- Structured PII (numbers/IDs) → **Regex first** (deterministic, higher precision)
- Entity names (PER/ORG/LOC) → **NER first** (contextual understanding)
- User rules → **MANUAL always first** (explicit intent)

### 2.2 Merge Procedure

```
Input: spans from MANUAL[], REGEX[], NER[]
Output: deduplicated, non-overlapping detection spans

1. Tag each span with its source engine and priority rank
2. Sort all spans by: (start ASC, length DESC, priority ASC)
3. Greedy accept with overlap check:

   accepted = []
   for span in sorted_spans:
     if span does not overlap with any span in accepted:
       accepted.push(span)
     elif span overlaps:
       existing = overlapping span in accepted
       if span.priority < existing.priority:  // lower = higher priority
         replace existing with span
       elif span.length > existing.length and span.priority == existing.priority:
         replace existing with span (longer match wins)
       else:
         skip span

4. For each accepted span:
     compositeKey = `${span.text}::${span.category}`
     if dictionary.forwardIndex.has(compositeKey):
       reuse existing token
     else:
       generate new sequential token ID
       add to dictionary

5. Return accepted spans with assigned tokens

Scaling note:
  - Current implementation uses sorted array with O(n²) worst case
  - Acceptable for typical documents (< 1,000 spans)
  - For > 10,000 spans: consider interval tree for O(n log n) overlap check
```

### 2.3 Overlap Resolution Examples

```
Text: "삼성전자 홍길동 과장의 주민등록번호는 901231-1234567입니다."

MANUAL: (none)
REGEX:  [{ text: "901231-1234567", start: 19, end: 32, cat: "RRN" }]
NER:    [{ text: "삼성전자", start: 0, end: 4, cat: "ORG" },
         { text: "홍길동", start: 5, end: 8, cat: "PER" },
         { text: "901231", start: 19, end: 25, cat: "DATE", score: 0.3 }]

Merge result:
  ORG: "삼성전자" (NER, no conflict)
  PER: "홍길동" (NER, no conflict)
  RRN: "901231-1234567" (REGEX wins over NER "DATE" — longer match + higher priority for numbers)
```

## 3. Veil Transform (Reverse Offset)

After detection, entities are replaced with tokens in **reverse offset order** to preserve character positions:

```
Original:  "홍길동은 삼성전자에 다닌다"
            ^^^      ^^^^

Detections (sorted by start):
  [0, 3, PER] [5, 9, ORG]

If we replace forward (left to right):
  "홍길동" → "<iv-per id="001">PER_001</iv-per>"  (3 chars → 37 chars)
  Position of "삼성전자" shifts! Index 5 is now wrong.

Reverse offset order (right to left):
  Replace "삼성전자" first (later position)
  Then replace "홍길동" (earlier position)
  → No position corruption
```

```typescript
// Sort detections by start position descending
detections.sort((a, b) => b.start - a.start);

for (const detection of detections) {
  text = text.slice(0, detection.start)
    + detection.token
    + text.slice(detection.end);
}
```

## 4. Korean-Specific Considerations

### 4.1 Agglutinative Morphology

Korean attaches particles directly to nouns, making entity boundary detection harder:

```
"홍길동은" → entity: "홍길동", particle: "은"
"삼성전자에서" → entity: "삼성전자", particle: "에서"
"서울에서부터" → entity: "서울", particle: "에서부터"
```

GLiNER's span-based approach handles this better than token-level NER, but edge cases remain. The detection pipeline should strip common Korean particles from span boundaries during post-processing.

#### Particle List (17 patterns, longest-match-first order)

```
에서부터, 에서, 까지, 부터, 으로, 에게, 한테, 와, 과, 은, 는, 이, 가, 을, 를, 의, 도, 만, 로
```

Implementation: custom regex suffix stripper. No external morphological analyzer (e.g., mecab, konlpy) required. The particle list is ordered by length descending to prevent partial matches (e.g., "에서부터" must match before "에서").

### 4.2 Unicode Normalization

All text is normalized to **NFC** before detection and comparison. This prevents mismatches between composed and decomposed Korean characters:

```
NFC: "홍" = U+D64D (single codepoint)
NFD: "홍" = U+1112 U+1169 U+11BC (three codepoints: ㅎ + ㅗ + ㅇ)

Without normalization: "홍" (NFC) ≠ "홍" (NFD) → detection misses
With NFC normalization: both become U+D64D → consistent detection
```

### 4.3 Encoding Detection

For non-UTF-8 files (legacy Korean documents often use EUC-KR/CP949):

```
1. Detect encoding with chardet
2. If confidence < 0.8: prompt user for confirmation
3. Convert to UTF-8 for processing
4. Convert back to original encoding on output
5. BOM preserved if present
```
