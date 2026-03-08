# Dictionary Architecture

## 1. Core Data Model

The Dictionary is the central data structure of ink-veil. It serves as a shared entity registry across all documents in a project, providing bidirectional O(1) lookup between original text and pseudonymized tokens.

```typescript
interface Dictionary {
  version: string;              // semantic versioning
  created: string;              // ISO 8601
  updated: string;              // ISO 8601
  entries: DictionaryEntry[];

  // Indexes (rebuilt from entries on load, not serialized)
  forwardIndex: Map<string, DictionaryEntry>;    // key: "${original}::${category}"
  reverseIndex: Map<string, DictionaryEntry>;    // key: tokenPlain (e.g., "PER_001")
  categoryIndex: Map<string, DictionaryEntry[]>; // key: category

  statistics: { total: number; byCategory: Record<string, number> };
  sourceDocuments: DocumentManifest[];
  tokenMode: TokenMode;
}

interface DictionaryEntry {
  id: string;                   // "PER_001"
  original: string;             // "홍길동"
  token: string;                // "<iv-per id=\"001\">PER_001</iv-per>"
  tokenPlain: string;           // "PER_001"
  category: string;             // "PER"
  detectionMethod: 'NER' | 'REGEX' | 'MANUAL';
  confidence: number;           // 0~1
  addedAt: string;
  addedFromDocument: string;
  occurrenceCount: number;
  lastSeenAt: string;
}
```

## 2. Composite Key Index

### The Homograph Problem

Korean text frequently contains homographs — identical strings with different entity types:

```
"삼성" → ORG (삼성전자) or LOC (삼성동)
"이승만" → PER (대통령) or LOC (거리명)
"현대" → ORG (현대자동차) or CONCEPT (현대시대)
```

### Solution: `${original}::${category}` as Key

```
Forward Index:
  "삼성::ORG" → { id: "ORG_003", token: "<iv-org ...>ORG_003</iv-org>" }
  "삼성::LOC" → { id: "LOC_007", token: "<iv-loc ...>LOC_007</iv-loc>" }

Reverse Index:
  "ORG_003" → { original: "삼성", category: "ORG" }
  "LOC_007" → { original: "삼성", category: "LOC" }
```

Forward lookup during veil requires both the detected text AND the detected category. This is why NER/Regex detection must output category alongside the entity span.

## 3. Index Lifecycle

```
Dictionary.create()
  └→ empty entries[], empty indexes

Dictionary.fromJSON(serialized)
  └→ parse entries[] → rebuild forwardIndex, reverseIndex, categoryIndex

dictionary.addEntity(original, category, method, confidence)
  ├→ compositeKey = `${original}::${category}`
  ├→ if forwardIndex.has(compositeKey): return existing entry (reuse)
  └→ else: generate new ID → create entry → update all 3 indexes

dictionary.save(path)
  └→ serialize entries[] + metadata → JSON (indexes excluded, rebuilt on load)

dictionary.saveEncrypted(path, password)
  └→ serialize → AES-256-GCM encrypt → write binary
```

## 4. Incremental Dictionary Updates

When processing new documents with an existing Dictionary:

```
Document N+1 arrives with existing Dictionary:

For each detected entity in Document N+1:
  compositeKey = `${entity.text}::${entity.category}`

  if dictionary.forwardIndex.has(compositeKey):
    → Reuse existing token (increment occurrenceCount, update lastSeenAt)
  else:
    → Generate next sequential ID for category
    → Add new entry to Dictionary
    → Update all indexes

Result: Dictionary grows monotonically; existing tokens are never reassigned.
```

This ensures cross-document consistency: the same person mentioned in 10 different documents always gets the same token.

## 5. Snapshot & Restore

Batch operations may partially fail. The Dictionary supports transactional snapshots:

```typescript
const snapshot = dictionary.snapshot();  // deep copy of entries[]

try {
  const results = await veilBatch(documents, dictionary);
  if (allSucceeded(results)) {
    await dictionary.save(path);
  } else {
    dictionary.restore(snapshot);  // rollback
  }
} catch (error) {
  dictionary.restore(snapshot);    // rollback on crash
}
```

`snapshot()` captures the entries array. `restore()` replaces entries and rebuilds all indexes from scratch.

## 6. Dictionary Merge

When combining Dictionaries from different workspaces or users:

```
Dictionary A: { PER_001: "홍길동", ORG_001: "삼성전자" }
Dictionary B: { PER_001: "김철수", ORG_001: "삼성전자", LOC_001: "서울" }

Conflict: PER_001 maps to different originals!
No conflict: ORG_001 maps to same original, LOC_001 is new.

Merge strategies:
  'keep-mine'  → A's mapping wins for conflicts
  'keep-theirs'→ B's mapping wins for conflicts
  'prompt'     → callback invoked for each conflict, user decides
  'rename'     → reassign IDs in B to avoid collisions (PER_001 → PER_003)
```

```typescript
const conflicts = dictA.merge(dictB, {
  strategy: 'prompt',
  onConflict: (mine, theirs) => {
    // return 'mine' | 'theirs' | 'skip'
  }
});
```

## 7. Serialization Format

### JSON (default)

```json
{
  "version": "1.2.0",
  "created": "2026-03-07T00:00:00Z",
  "updated": "2026-03-07T12:00:00Z",
  "tokenMode": "xml",
  "entries": [
    {
      "id": "PER_001",
      "original": "홍길동",
      "token": "<iv-per id=\"001\">PER_001</iv-per>",
      "tokenPlain": "PER_001",
      "category": "PER",
      "detectionMethod": "NER",
      "confidence": 0.95,
      "addedAt": "2026-03-07T00:00:00Z",
      "addedFromDocument": "contract-v1.docx",
      "occurrenceCount": 7,
      "lastSeenAt": "2026-03-07T12:00:00Z"
    }
  ],
  "sourceDocuments": [
    {
      "documentId": "contract-v1",
      "fileName": "contract-v1.docx",
      "format": "docx",
      "fidelityTier": "2",
      "sha256Original": "abc123...",
      "sha256Veiled": "def456...",
      "processedAt": "2026-03-07T00:00:00Z",
      "dictionaryVersion": "1.0.0",
      "entitiesFound": 23,
      "newEntitiesAdded": 15
    }
  ]
}
```

### Encrypted (optional)

```
AES-256-GCM encryption with PBKDF2 key derivation:
  password → PBKDF2(100,000 iterations, SHA-512) → 256-bit key
  plaintext JSON → AES-256-GCM(key, random IV) → encrypted blob

File format: [4-byte magic "IVDK"] [16-byte salt] [12-byte IV] [encrypted data] [16-byte auth tag]
```

## 8. Memory & Performance Characteristics

```
Dictionary with 10,000 entries:
  Memory: ~5-10 MB (3 Map indexes + entries array)
  Forward lookup: O(1) average (Map.get)
  Reverse lookup: O(1) average (Map.get)
  Category query: O(1) to get list, O(k) to iterate k entries
  Serialization: ~1-2 MB JSON, <50ms serialize, <100ms deserialize
  Index rebuild: <10ms for 10,000 entries

Scaling limits:
  100,000+ entries: consider LRU eviction for rarely-used entries
  In practice, a typical project has 100-1,000 unique entities.
```
