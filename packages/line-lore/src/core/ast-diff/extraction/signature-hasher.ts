import { createHash } from 'node:crypto';

import type { ContentHash } from '../../../types/index.js';

export function computeExactHash(bodyText: string): string {
  const normalized = stripWhitespaceAndComments(bodyText);
  return sha256(normalized);
}

export function computeStructuralHash(bodyText: string): string {
  const stripped = stripWhitespaceAndComments(bodyText);
  const normalized = normalizeIdentifiers(stripped);
  return sha256(normalized);
}

export function computeContentHash(bodyText: string): ContentHash {
  return {
    exact: computeExactHash(bodyText),
    structural: computeStructuralHash(bodyText),
  };
}

function stripWhitespaceAndComments(text: string): string {
  let result = text;

  // Remove single-line comments
  result = result.replace(/\/\/.*$/gm, '');

  // Remove multi-line comments
  result = result.replace(/\/\*[\s\S]*?\*\//g, '');

  // Remove Python-style comments
  result = result.replace(/#.*$/gm, '');

  // Remove string literals (replace with empty placeholder to preserve structure)
  result = result.replace(/"(?:[^"\\]|\\.)*"/g, '""');
  result = result.replace(/'(?:[^'\\]|\\.)*'/g, "''");
  result = result.replace(/`(?:[^`\\]|\\.)*`/g, '``');

  // Remove all whitespace
  result = result.replace(/\s+/g, '');

  return result;
}

function normalizeIdentifiers(text: string): string {
  const identifiers = new Map<string, string>();
  let counter = 0;

  // Match identifiers (word characters that aren't purely numeric)
  return text.replace(/[a-zA-Z_]\w*/g, (match) => {
    // Skip language keywords
    if (KEYWORDS.has(match)) return match;

    let normalized = identifiers.get(match);
    if (!normalized) {
      normalized = `$${counter++}`;
      identifiers.set(match, normalized);
    }
    return normalized;
  });
}

function sha256(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

const KEYWORDS = new Set([
  // JavaScript/TypeScript
  'async', 'await', 'break', 'case', 'catch', 'class', 'const', 'continue',
  'debugger', 'default', 'delete', 'do', 'else', 'export', 'extends',
  'false', 'finally', 'for', 'function', 'if', 'import', 'in', 'instanceof',
  'let', 'new', 'null', 'of', 'return', 'static', 'super', 'switch', 'this',
  'throw', 'true', 'try', 'typeof', 'undefined', 'var', 'void', 'while',
  'with', 'yield', 'type', 'interface', 'enum', 'implements', 'public',
  'private', 'protected', 'abstract', 'readonly',
  // Python
  'def', 'lambda', 'pass', 'raise', 'and', 'or', 'not', 'is', 'None',
  'True', 'False', 'nonlocal', 'global', 'assert', 'elif', 'except',
  'from', 'as', 'with',
  // Go
  'func', 'package', 'range', 'struct', 'map', 'chan', 'go', 'select',
  'defer', 'fallthrough', 'goto',
]);
