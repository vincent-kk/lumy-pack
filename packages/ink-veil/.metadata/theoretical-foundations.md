# Theoretical Foundations

## 1. The Problem: PII Leakage in LLM Workflows

Documents sent to LLMs for summarization, translation, review, or analysis inevitably contain Personally Identifiable Information (PII). Once transmitted, this data enters model context windows, logging pipelines, and potentially training datasets — creating an irreversible privacy violation.

The fundamental challenge is:

```
Utility vs Privacy Trade-off:
  High utility  (send real data)  → High privacy risk
  High privacy  (remove all PII)  → Low utility (LLM can't reason about entities)

ink-veil's solution: Pseudonymization with round-trip fidelity
  → Full utility (LLM reasons about entities as tokens)
  → Full privacy (no real PII leaves the device)
  → Full reversibility (original data restored after LLM processing)
```

## 2. De-identification Taxonomy

### 2.1 Anonymization vs Pseudonymization

| Property | Anonymization | Pseudonymization |
|----------|--------------|------------------|
| Reversibility | Irreversible | Reversible (with key/dictionary) |
| Utility loss | High (entities removed or generalized) | Low (entities replaced with consistent tokens) |
| GDPR status | Not personal data | Still personal data (dictionary = key) |
| ink-veil approach | ❌ | ✅ |

ink-veil performs **pseudonymization**: real entities are replaced with deterministic tokens, and a Dictionary acts as the reversal key. The Dictionary itself becomes the sensitive asset.

### 2.2 Pseudonymization Strategies

| Strategy | Example | LLM Compatibility | Round-trip |
|----------|---------|-------------------|------------|
| Suppression | `홍길동` → `[REDACTED]` | Poor (loses entity relationships) | One-way |
| Generalization | `홍길동` → `한국인 남성` | Poor (loses identity) | One-way |
| Token replacement | `홍길동` → `PER_001` | Good (preserves relationships) | ✅ Bidirectional |
| Faker replacement | `홍길동` → `김철수` | Best (natural text) | Risky (collision) |
| XML token | `홍길동` → `<iv-per id="001">PER_001</iv-per>` | Best (structural) | ✅ Bidirectional |

ink-veil uses **structured XML tokens** as the default, with plain and bracket modes available.

### 2.3 The Confused Deputy Problem in LLM Pseudonymization

LLMs are "confused deputies" — they receive pseudonymized input but may:
1. **Interpret tokens semantically** ("PER_001 sounds like a person")
2. **Modify tokens** (whitespace changes, attribute reordering)
3. **Hallucinate new tokens** (invent PER_099 that doesn't exist)
4. **Drop tokens** (omit in summary/translation)

This is structurally similar to the Clinejection attack pattern: untrusted output from an LLM must be treated with defensive parsing. ink-veil's three-stage fuzzy matching is the defense layer.

## 3. Named Entity Recognition (NER) Theory

### 3.1 NER Approaches

| Approach | Mechanism | Pros | Cons |
|----------|-----------|------|------|
| Rule-based | Regex, gazetteers | Predictable, fast | Brittle, no context |
| Statistical (CRF) | Conditional Random Fields | Good for structured text | Requires training data |
| Neural (BiLSTM-CRF) | Sequence labeling | Context-aware | Slow, large models |
| Transformer (BERT-based) | Token classification | State-of-art accuracy | GPU-heavy |
| **Span-based (GLiNER)** | Span extraction | **Zero-shot, multilingual** | Moderate model size |

### 3.2 Why GLiNER for ink-veil

GLiNER (Generalist and Lightweight model for NER) uses a span-based architecture rather than token-level BIO tagging:

```
Traditional NER (token-level):
  "홍길동은 삼성에 다닌다"
   B-PER I-PER O B-ORG O O    ← each token gets a label

GLiNER (span-level):
  "홍길동은 삼성에 다닌다"
   [홍길동] → PER (score: 0.95)
   [삼성]   → ORG (score: 0.88)  ← spans extracted directly
```

Span-based advantages for Korean:
- Korean agglutinative morphology makes token boundaries ambiguous
- Span extraction naturally handles multi-character entity names
- Zero-shot: entity types defined at query time, no retraining needed

### 3.3 The Hybrid Detection Rationale

```
NER alone:    ✅ "홍길동" (PER)     ❌ "901231-1234567" (low confidence on numbers)
Regex alone:  ❌ "홍길동" (no rule)  ✅ "901231-1234567" (RRN pattern match)
Hybrid:       ✅ "홍길동" (NER)     ✅ "901231-1234567" (Regex)
```

Structured PII (numbers, IDs, emails) → Regex excels (deterministic patterns)
Unstructured PII (names, organizations, locations) → NER excels (contextual understanding)

ink-veil combines both with configurable priority per entity category.

## 4. Dictionary-Centric Architecture Rationale

### 4.1 Per-file vs Shared Dictionary

| Approach | Multi-document consistency | Incremental | Storage |
|----------|--------------------------|-------------|---------|
| Per-file mapping | ❌ Same person gets different tokens | ❌ | N files |
| **Shared Dictionary** | ✅ Same person = same token always | ✅ | 1 file |

When processing multiple documents about the same project/case, entity consistency is critical. A shared Dictionary ensures `홍길동` always maps to `PER_001` regardless of which document mentions them.

### 4.2 The Composite Key Problem

```
"삼성" appears in two contexts:
  - "삼성전자" (ORG) → should map to ORG_003
  - "삼성동"   (LOC) → should map to LOC_007

Simple key "삼성":
  forward["삼성"] = ???  ← collision!

Composite key "삼성::ORG" and "삼성::LOC":
  forward["삼성::ORG"] = ORG_003  ✅
  forward["삼성::LOC"] = LOC_007  ✅
```

The composite key `${original}::${category}` resolves the homograph ambiguity inherent in Korean entity names.

## 5. Round-trip Fidelity Theory

### 5.1 The Fidelity Spectrum

```
Byte-identical                                              Best-effort
     |                                                           |
     ▼                                                           ▼
  [Tier 1a]  ──→  [Tier 1b]  ──→  [Tier 2]  ──→  [Tier 3]  ──→  [Tier 4]
   TXT/CSV        JSON/YAML       DOCX/XLSX       PDF/PPTX       HWP/RTF
   SHA256 match   semantic match  structure match  text-layer     experimental
```

The key insight: **file format determines the maximum achievable fidelity**, not the de-identification algorithm. A perfectly accurate veil/unveil cycle can still produce different bytes if the serializer doesn't preserve whitespace (JSON), comments (YAML/INI), or compression (DOCX ZIP).

### 5.2 Verification as a First-Class Concern

Round-trip verification is not an afterthought — it's a core guarantee:

```
verify(original, unveil(veil(original, dict), dict)):
  Tier 1a → SHA-256 byte comparison
  Tier 1b → Parsed content equality (ignoring formatting)
  Tier 2  → Text node equality + structure integrity
  Tier 3  → Extracted text equality
  Tier 4  → Best-effort text comparison
```

Each tier has an explicit verification contract that the user can rely on.

## 6. Offline-First Security Model

### 6.1 Threat Model

```
Trusted:     User's device, ink-veil process, local filesystem
Untrusted:   LLM APIs, cloud services, network transit
Sensitive:   Dictionary (= reversal key), original documents

Attacker goals:
  1. Extract PII from veiled documents        → Mitigated: tokens carry no semantic info
  2. Reconstruct mapping from token patterns  → Mitigated: random ID assignment
  3. Steal Dictionary                         → Mitigated: AES-256-GCM encryption, local-only
  4. Manipulate tokens in LLM output          → Detected: token integrity report
```

### 6.2 Zero Network Calls

ink-veil makes **zero network calls** by design:
- NER model: ONNX file loaded from local disk
- All processing: CPU-only (no GPU API calls)
- Dictionary: local JSON file (optionally encrypted)
- No telemetry, no update checks, no cloud dependencies

The only network activity occurs when the user manually sends veiled documents to an LLM — and at that point, no PII is present in the transmitted data.

## References

- GDPR Article 4(5): Definition of pseudonymization
- PIPC (개인정보보호위원회): Korean PII classification guidelines
- GLiNER: Generalist and Lightweight Model for Named Entity Recognition (Zaratiana et al., 2023)
- LOPSIDED: Semantic pseudonymization for LLM pipelines (arXiv:2510.27016)
- NIST SP 800-188: De-Identifying Government Datasets
