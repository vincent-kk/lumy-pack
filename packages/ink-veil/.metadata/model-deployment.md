# GLiNER Model Deployment Strategy

## 1. Overview

GLiNER ONNX models (~150MB INT8 quantized) cannot ship via npm. ink-veil uses a **lazy download** strategy: models are downloaded on first use and cached locally.

## 2. Cache Location

```
~/.ink-veil/
├── models/
│   ├── gliner_multi-v2.1/
│   │   ├── model.onnx          (~150MB)
│   │   ├── tokenizer.json
│   │   ├── config.json
│   │   └── .checksum            (SHA-256 of model.onnx)
│   └── gliner_ko/               (Korean-optimized fallback)
│       └── ...
└── config.json                   (Phase 2)
```

## 3. Model Registry

```typescript
interface ModelInfo {
  name: string;
  version: string;
  url: string;                    // Hugging Face Hub URL
  sha256: string;                 // Expected SHA-256 of model.onnx
  sizeBytes: number;              // For progress display
  license: string;                // Apache 2.0
}

// Hardcoded in source — no remote registry fetch
const MODEL_REGISTRY: Record<string, ModelInfo> = {
  'gliner_multi-v2.1': {
    name: 'urchade/gliner_multi-v2.1',
    version: '2.1.0',
    url: 'https://huggingface.co/urchade/gliner_multi-v2.1/resolve/main/onnx/model_int8.onnx',
    sha256: '<hardcoded-hash>',    // Pinned at release time
    sizeBytes: 157_286_400,
    license: 'Apache-2.0',
  },
  'gliner_ko': {
    name: 'taeminlee/gliner_ko',
    version: '1.0.0',
    url: 'https://huggingface.co/taeminlee/gliner_ko/resolve/main/onnx/model_int8.onnx',
    sha256: '<hardcoded-hash>',
    sizeBytes: 157_286_400,
    license: 'Apache-2.0',
  },
};
```

## 4. Download Flow

```
User runs `ink-veil veil input.txt`:

1. ModelManager.ensureModel('gliner_multi-v2.1')
   ├── Check ~/.ink-veil/models/gliner_multi-v2.1/model.onnx exists
   │   ├── YES: verify .checksum matches MODEL_REGISTRY.sha256
   │   │   ├── MATCH: return model path (fast path, <1ms)
   │   │   └── MISMATCH: delete and re-download
   │   └── NO: proceed to download
   │
2. Download with progress (stderr):
   │   Downloading GLiNER model (150MB)... [████████░░] 80%
   │
3. Verify SHA-256:
   │   ├── MATCH: write .checksum file, return model path
   │   └── MISMATCH: delete downloaded file, emit NERModelError
   │       └── Fallback chain continues
   │
4. Fallback chain (on any failure):
   │   gliner_multi-v2.1 → gliner_ko → regex-only
   │
5. Regex-only fallback:
   │   ├── stderr: "⚠ NER model unavailable. Using regex-only detection."
   │   ├── JSON output: { "degraded": true, "reason": "NER model unavailable" }
   │   └── exit code: 6 (NER_MODEL_FAILED)
```

## 5. CLI Model Management

Available from Phase 1:

```bash
# Pre-download model (for CI/air-gapped environments)
ink-veil model download [--model gliner_multi-v2.1]

# Check model status
ink-veil model status
# Output:
# gliner_multi-v2.1: installed (150MB, checksum OK)
# gliner_ko: not installed
```

Available from Phase 3:

```bash
# List installed models
ink-veil model list

# Remove a model
ink-veil model remove gliner_ko
```

## 6. Security Considerations

### Supply Chain Protection

1. **SHA-256 pinning**: Model checksums are hardcoded in source code, not fetched from remote
2. **No arbitrary URL**: Download URLs are hardcoded in `MODEL_REGISTRY`
3. **Post-download verification**: SHA-256 computed on downloaded file before use
4. **Checksum mismatch = hard failure**: No bypass option. Must re-download or use regex-only fallback

### Air-Gapped Deployment

For environments without internet access:

```bash
# On a machine with internet:
ink-veil model download
# Copy ~/.ink-veil/models/ to target machine

# On air-gapped machine:
# Models loaded from ~/.ink-veil/models/ — no network call
```

### ONNX Runtime Sandboxing

The ONNX model runs in a **Worker Thread** — not the main thread. If the model produces unexpected behavior, the Worker Thread can be terminated without affecting the main process. This provides process-level isolation (not full sandboxing, but limits blast radius).

## 7. Offline-First Principle Reconciliation

The lazy download strategy creates a one-time exception to the "zero network calls" principle:

| Scenario | Network Call | Justification |
|----------|-------------|---------------|
| Model already cached | None | Fast path, fully offline |
| First run (auto-download) | Yes (once) | Unavoidable for ~150MB binary |
| `model download` (explicit) | Yes (once) | User-initiated, expected |
| After first download | None | Fully offline thereafter |
| `--no-ner` flag | None | Explicit opt-out of NER |
| Regex-only fallback | None | Graceful degradation |

**Key guarantee**: After the one-time download, ink-veil operates with **zero network calls** for all subsequent invocations, indefinitely.
