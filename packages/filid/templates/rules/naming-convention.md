# Rule: naming-convention

**ID**: `naming-convention`
**Category**: naming
**Severity**: warning
**Enabled by default**: yes

## Description

Directory and file names must follow either **kebab-case** or **camelCase** naming conventions.
Mixed or non-standard naming (PascalCase, SCREAMING_SNAKE_CASE, spaces, dots as separators, etc.) triggers a warning.

## Valid Patterns

| Convention | Pattern | Examples |
|---|---|---|
| kebab-case | Lowercase letters, digits, hyphens only. Must start with a lowercase letter. | `my-module`, `auth-service`, `rule-engine` |
| camelCase | Starts with lowercase letter, may include uppercase letters and digits. | `myModule`, `authService`, `ruleEngine` |

### Regex Reference

```
kebab-case: /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/
camelCase:  /^[a-z][a-zA-Z0-9]*$/
```

## Violation Example

```
VIOLATION: Directory name "MyModule" does not follow kebab-case or camelCase.
Path: src/MyModule
Suggestion: Rename to "my-module" (kebab-case) or "myModule" (camelCase).
```

## Fix

Rename the offending directory or file:

```bash
# Rename PascalCase to kebab-case
mv src/MyModule src/my-module

# Rename SCREAMING_SNAKE to camelCase
mv src/AUTH_SERVICE src/authService
```

## Scope

This rule is applied to every node in the FractalTree (both directories and files scanned as nodes).
It does not apply to file extensions or to special files like `CLAUDE.md`, `SPEC.md`, or `README.md`,
which follow their own conventions.

## Notes

- kebab-case is preferred for directory names in most FCA-AI projects (consistent with npm package naming)
- camelCase is accepted for compatibility with legacy codebases or framework-generated directories
- If your project requires PascalCase (e.g., React component directories), disable this rule in `.filid/config.json`
