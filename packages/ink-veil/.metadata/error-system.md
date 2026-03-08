# Error System

## 1. Error Code Enum

```typescript
enum ErrorCode {
  SUCCESS = 0,
  GENERAL_ERROR = 1,
  INVALID_ARGUMENTS = 2,
  FILE_NOT_FOUND = 3,
  UNSUPPORTED_FORMAT = 4,
  DICTIONARY_ERROR = 5,
  NER_MODEL_FAILED = 6,
  VERIFICATION_FAILED = 7,
  TOKEN_INTEGRITY_BELOW_THRESHOLD = 8,
}
```

### CLI Exit Code Mapping

| Code | Name | Description | Example Trigger |
|------|------|-------------|-----------------|
| 0 | SUCCESS | Operation completed successfully | Normal veil/unveil |
| 1 | GENERAL_ERROR | Unhandled or unexpected error | Runtime exception |
| 2 | INVALID_ARGUMENTS | Missing required options or invalid flag | `--no-such-flag` |
| 3 | FILE_NOT_FOUND | Input file missing or permission denied | `veil nonexistent.txt` |
| 4 | UNSUPPORTED_FORMAT | File format not recognized or not implemented | `.xyz` extension |
| 5 | DICTIONARY_ERROR | Corrupt dictionary, decrypt failed, version mismatch | Wrong password |
| 6 | NER_MODEL_FAILED | NER model load or download failed, regex fallback active | Model checksum mismatch |
| 7 | VERIFICATION_FAILED | Round-trip verification did not pass | SHA-256 mismatch |
| 8 | TOKEN_INTEGRITY_BELOW_THRESHOLD | `--strict` mode and `tokenIntegrity < 1.0` | LLM dropped tokens |

## 2. Error Class Hierarchy

```typescript
class InkVeilError extends Error {
  readonly code: ErrorCode;
  readonly context?: Record<string, unknown>;

  constructor(code: ErrorCode, message: string, context?: Record<string, unknown>) {
    super(message);
    this.name = 'InkVeilError';
    this.code = code;
    this.context = context;
  }
}

// Specialized subclasses for type narrowing
class FileNotFoundError extends InkVeilError {
  constructor(path: string) {
    super(ErrorCode.FILE_NOT_FOUND, `File not found: ${path}`, { path });
  }
}

class UnsupportedFormatError extends InkVeilError {
  constructor(format: string) {
    super(ErrorCode.UNSUPPORTED_FORMAT, `Unsupported format: ${format}`, { format });
  }
}

class DictionaryError extends InkVeilError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(ErrorCode.DICTIONARY_ERROR, message, context);
  }
}

class NERModelError extends InkVeilError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(ErrorCode.NER_MODEL_FAILED, message, context);
  }
}

class VerificationError extends InkVeilError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(ErrorCode.VERIFICATION_FAILED, message, context);
  }
}
```

## 3. Result Pattern

Discriminated union for all public API return types. No thrown exceptions at the API boundary.

```typescript
type Result<T, E = InkVeilError> =
  | { ok: true; value: T }
  | { ok: false; error: E };

// Helper constructors
function ok<T>(value: T): Result<T, never> {
  return { ok: true, value };
}

function err<E>(error: E): Result<never, E> {
  return { ok: false, error };
}

// Usage pattern
const result = await veil.veil(document, dict);
if (result.ok) {
  console.log(result.value.entitiesFound);
} else {
  console.error(result.error.code, result.error.message);
  process.exit(result.error.code);
}
```

### Batch Result

```typescript
interface BatchResult<T> {
  results: Result<T>[];       // per-file results
  dictionary: Dictionary;     // updated dictionary (snapshot/restore on partial failure)
  succeeded: number;
  failed: number;
}
```

When any file in a batch fails:
1. Dictionary is restored to pre-batch snapshot for that file
2. Other successfully processed files retain their dictionary entries
3. `BatchResult.failed > 0` indicates partial failure
4. CLI outputs per-file status in JSON

## 4. Error Boundary Rules

- **Public API functions** (`veil`, `unveil`, `detect`, `verify`, `dict.*`) return `Result<T, E>`. Never throw.
- **Internal modules** may throw; caught at the API boundary and wrapped in `Result`.
- **CLI layer** maps `Result.error.code` to process exit code.
- **Programmatic consumers** pattern-match on `result.ok` to handle success/failure.
