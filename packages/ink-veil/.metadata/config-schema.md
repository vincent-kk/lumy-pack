# Configuration Schema

## 1. Phase Strategy

- **Phase 1 (MVP)**: No config file. All options via CLI flags and programmatic API parameters.
- **Phase 2+**: Optional `~/.ink-veil/config.json` with JSON Schema validation.

Rationale: Deferring config files avoids premature schema commitment. CLI flags are sufficient for Phase 1 users and fully discoverable via `--help`.

## 2. Config File Location

```
~/.ink-veil/config.json
```

Discovered via:
1. `--config <path>` CLI flag (explicit override)
2. `INK_VEIL_CONFIG` environment variable
3. Default: `~/.ink-veil/config.json`
4. If no config file found: use built-in defaults (silent, no error)

## 3. Priority Order

```
CLI flags > Environment variables > Config file > Built-in defaults
```

A CLI flag always wins. Config file values are only used when no flag is provided.

## 4. Schema (Phase 2)

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "tokenMode": {
      "type": "string",
      "enum": ["xml", "bracket", "plain"],
      "default": "xml",
      "description": "Token format for pseudonymized entities"
    },
    "signature": {
      "type": "boolean",
      "default": true,
      "description": "Inject invisible signature into veiled documents"
    },
    "ner": {
      "type": "object",
      "properties": {
        "model": {
          "type": "string",
          "default": "gliner_multi-v2.1",
          "description": "NER model name from model registry"
        },
        "threshold": {
          "type": "number",
          "minimum": 0,
          "maximum": 1,
          "default": 0.5,
          "description": "NER confidence threshold"
        },
        "enabled": {
          "type": "boolean",
          "default": true,
          "description": "Enable NER detection (false = regex-only)"
        }
      }
    },
    "detection": {
      "type": "object",
      "properties": {
        "priorityOrder": {
          "type": "array",
          "items": { "type": "string", "enum": ["MANUAL", "REGEX", "NER"] },
          "default": ["MANUAL", "REGEX", "NER"],
          "description": "Default detection engine priority"
        },
        "categories": {
          "type": "array",
          "items": { "type": "string" },
          "description": "Entity categories to detect (empty = all)"
        }
      }
    },
    "dictionary": {
      "type": "object",
      "properties": {
        "defaultPath": {
          "type": "string",
          "default": "./dictionary.json",
          "description": "Default dictionary file path"
        }
      }
    },
    "output": {
      "type": "object",
      "properties": {
        "directory": {
          "type": "string",
          "default": "./veiled/",
          "description": "Default output directory for veiled files"
        },
        "encoding": {
          "type": "string",
          "default": "utf-8",
          "description": "Default text encoding"
        }
      }
    },
    "manualRules": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "pattern": { "type": "string" },
          "category": { "type": "string" },
          "isRegex": { "type": "boolean", "default": false }
        },
        "required": ["pattern", "category"]
      },
      "default": [],
      "description": "User-defined manual detection rules"
    }
  }
}
```

## 5. Example Config

```json
{
  "tokenMode": "xml",
  "ner": {
    "model": "gliner_multi-v2.1",
    "threshold": 0.6
  },
  "detection": {
    "priorityOrder": ["MANUAL", "NER", "REGEX"],
    "categories": ["PER", "ORG", "LOC", "PHONE", "EMAIL", "RRN"]
  },
  "dictionary": {
    "defaultPath": "./project.dict.json"
  },
  "manualRules": [
    { "pattern": "Project-Alpha", "category": "PROJECT" },
    { "pattern": "INV-\\d{8}", "category": "INVOICE", "isRegex": true }
  ]
}
```

## 6. Validation

Config file validation uses AJV 8 (same as syncpoint):

```typescript
import Ajv from 'ajv';
const ajv = new Ajv({ allErrors: true, useDefaults: true });
const validate = ajv.compile(configSchema);

if (!validate(config)) {
  // Report errors to stderr, fall back to defaults
  // Do NOT exit — invalid config should not block operation
}
```

Invalid config prints a warning to stderr and falls back to built-in defaults. It never causes a fatal error.
