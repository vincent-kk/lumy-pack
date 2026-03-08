/**
 * Unveil (restore) veiled text using a dictionary.
 * 3-stage fuzzy matching:
 *   Stage 1: Strict XML tag match  <iv-cat id="NNN">CAT_NNN</iv-cat>
 *   Stage 2: Loose XML (quote style change, extra whitespace)
 *   Stage 3: Dynamic plain token scan  CAT_NNN or {{CAT_NNN}}
 * MUST NOT import from detection/, document/, node:fs, node:crypto
 */
import type { Dictionary } from '../dictionary/dictionary.js';
import type { UnveilResult } from './types.js';

// Stage 1: strict XML tag — `<iv-cat id="NNN">CAT_NNN</iv-cat>`
const STAGE1_REGEX = /<iv-([a-z]+)\s+id="(\d+)">([A-Z]+_\d+)<\/iv-\1>/g;

// Stage 2: loose XML — handles single quotes and extra whitespace
const STAGE2_REGEX = /<iv-([a-z]+)\s+id=['"](\d+)['"]>\s*([A-Z]+_\d+)\s*<\/iv-\1>/g;

// Stage 3 bracket: {{CAT_NNN}}
const STAGE3_BRACKET_REGEX = /\{\{([A-Z]+_\d+)\}\}/g;

// Stage 3 plain: bare CAT_NNN token (must be a known category prefix)
function buildStage3PlainRegex(categories: string[]): RegExp | null {
  if (categories.length === 0) return null;
  const alt = categories.map((c) => c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
  return new RegExp(`\\b((?:${alt})_\\d+)\\b`, 'g');
}

export function unveilText(text: string, dictionary: Dictionary): UnveilResult {
  const matchedTokens: string[] = [];
  const modifiedTokens: string[] = [];
  const unmatchedTokens: string[] = [];

  let result = text;

  // Stage 1: strict XML
  result = result.replace(STAGE1_REGEX, (_match, _tag, _numId, plainId) => {
    const entry = dictionary.reverseLookup(plainId);
    if (entry) {
      matchedTokens.push(plainId);
      return entry.original;
    }
    unmatchedTokens.push(plainId);
    return _match;
  });

  // Stage 2: loose XML (quote change, extra whitespace)
  result = result.replace(STAGE2_REGEX, (_match, _tag, _numId, plainId) => {
    const trimmed = plainId.trim();
    const entry = dictionary.reverseLookup(trimmed);
    if (entry) {
      modifiedTokens.push(trimmed);
      return entry.original;
    }
    unmatchedTokens.push(trimmed);
    return _match;
  });

  // Stage 3a: bracket format {{CAT_NNN}}
  result = result.replace(STAGE3_BRACKET_REGEX, (_match, plainId) => {
    const entry = dictionary.reverseLookup(plainId);
    if (entry) {
      modifiedTokens.push(plainId);
      return entry.original;
    }
    unmatchedTokens.push(plainId);
    return _match;
  });

  // Stage 3b: plain bare token — dynamic regex from dictionary categories
  const categories = dictionary.getCategories();
  const stage3Regex = buildStage3PlainRegex(categories);
  if (stage3Regex) {
    result = result.replace(stage3Regex, (_match, plainId) => {
      const entry = dictionary.reverseLookup(plainId);
      if (entry) {
        modifiedTokens.push(plainId);
        return entry.original;
      }
      unmatchedTokens.push(plainId);
      return _match;
    });
  }

  // Deduplicate token lists
  const dedupe = (arr: string[]) => [...new Set(arr)];
  const matchedDeduped = dedupe(matchedTokens);
  const modifiedDeduped = dedupe(modifiedTokens);
  const unmatchedDeduped = dedupe(unmatchedTokens);

  const totalFound = matchedDeduped.length + modifiedDeduped.length + unmatchedDeduped.length;
  const tokenIntegrity = totalFound === 0 ? 1.0 : matchedDeduped.length / totalFound;

  return {
    text: result,
    matchedTokens: matchedDeduped,
    modifiedTokens: modifiedDeduped,
    unmatchedTokens: unmatchedDeduped,
    tokenIntegrity,
  };
}
