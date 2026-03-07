/**
 * Faker replacement mode.
 *
 * Generates realistic Korean fake values for PII entities.
 * Used when TokenMode === 'faker'.
 *
 * Design:
 * - Each (original, category) pair maps to a deterministic fake value via the dictionary.
 * - Fake values are collision-checked: if a generated name already exists as a DIFFERENT
 *   entity's fake value, regenerate up to MAX_RETRIES times.
 * - Reverse lookup uses the plain token ID stored in the dictionary.
 *
 * MUST NOT import from detection/, document/, node:fs, node:crypto, onnxruntime-node.
 */
import { faker } from '@faker-js/faker';
import type { Dictionary } from '../dictionary/dictionary.js';
import type { DictionaryEntry } from '../dictionary/entry.js';

const MAX_RETRIES = 10;

/**
 * Category → faker generator function.
 * Extend this map to add new categories.
 */
const FAKER_GENERATORS: Record<string, () => string> = {
  PER: () => faker.person.fullName(),
  ORG: () => faker.company.name(),
  LOC: () => faker.location.city(),
  DATE: () => faker.date.past({ years: 10 }).toISOString().slice(0, 10),
  EMAIL: () => faker.internet.email(),
  PHONE: () => `010-${faker.string.numeric(4)}-${faker.string.numeric(4)}`,
  NATIONAL_ID: () => {
    // YYMMDD-XXXXXXX format (fake, not real)
    const yy = faker.string.numeric(2);
    const mm = String(faker.number.int({ min: 1, max: 12 })).padStart(2, '0');
    const dd = String(faker.number.int({ min: 1, max: 28 })).padStart(2, '0');
    const suffix = faker.string.numeric(7);
    return `${yy}${mm}${dd}-${suffix}`;
  },
  RRN: () => {
    const yy = faker.string.numeric(2);
    const mm = String(faker.number.int({ min: 1, max: 12 })).padStart(2, '0');
    const dd = String(faker.number.int({ min: 1, max: 28 })).padStart(2, '0');
    const suffix = faker.string.numeric(7);
    return `${yy}${mm}${dd}-${suffix}`;
  },
  CARD: () =>
    `${faker.string.numeric(4)}-${faker.string.numeric(4)}-${faker.string.numeric(4)}-${faker.string.numeric(4)}`,
  ACCOUNT: () =>
    `${faker.string.numeric(3)}-${faker.string.numeric(6)}-${faker.string.numeric(2)}`,
  IP: () => faker.internet.ipv4(),
};

/** Fallback generator for unknown categories. */
function defaultGenerator(): string {
  return faker.string.alphanumeric(8).toUpperCase();
}

/**
 * Generate a fake replacement value for the given category.
 * Ensures no collision with existing fake values in the dictionary.
 *
 * @param category   Entity category (e.g. "PER").
 * @param dictionary Current dictionary — used for collision detection.
 * @returns          A fake string value unique within the dictionary's faker tokens.
 */
export function generateFakerToken(category: string, dictionary: Dictionary): string {
  const generator = FAKER_GENERATORS[category] ?? defaultGenerator;

  // Collect all existing faker tokens for collision check.
  const existingFakerTokens = new Set<string>();
  for (const entry of dictionary.entries()) {
    if (entry.token !== entry.tokenPlain) {
      // faker mode stores the fake value as `token`
      existingFakerTokens.add(entry.token);
    }
  }

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const candidate = generator();
    if (!existingFakerTokens.has(candidate)) {
      return candidate;
    }
  }

  // Last resort: append a unique suffix to avoid collision.
  return `${generator()}_${Date.now()}`;
}

/**
 * Apply faker-mode veil to `text` using the provided dictionary.
 *
 * Entries are processed longest-match-first to prevent partial replacements
 * (e.g. "삼성전자" before "삼성").
 *
 * @param text       Source text.
 * @param dictionary Dictionary with faker tokens populated.
 * @returns          Veiled text with fake values substituted.
 */
export function veilTextFaker(text: string, dictionary: Dictionary): string {
  const entries = Array.from(dictionary.entries()).sort(
    (a, b) => b.original.length - a.original.length,
  );

  let result = text;
  for (const entry of entries) {
    result = result.split(entry.original).join(entry.token);
  }
  return result;
}

/**
 * Apply faker-mode unveil: replace fake tokens back with original values.
 * Uses reverse lookup via entry.tokenPlain → entry.original.
 *
 * Since faker tokens are natural-language strings, exact string matching
 * is used (no fuzzy XML recovery needed).
 *
 * @param text       Veiled text containing fake values.
 * @param dictionary Dictionary with faker tokens.
 * @returns          Restored text with originals substituted back.
 */
export function unveilTextFaker(text: string, dictionary: Dictionary): string {
  const entries = Array.from(dictionary.entries()).sort(
    (a, b) => b.token.length - a.token.length,
  );

  let result = text;
  for (const entry of entries) {
    result = result.split(entry.token).join(entry.original);
  }
  return result;
}

/**
 * Add an entity to the dictionary in faker mode.
 * Generates a fake replacement and stores it as the `token` field.
 *
 * @param original   Original PII text.
 * @param category   Entity category.
 * @param method     Detection method.
 * @param confidence Confidence score.
 * @param dictionary Target dictionary.
 * @returns          The DictionaryEntry with faker token set.
 */
export function addFakerEntity(
  original: string,
  category: string,
  method: DictionaryEntry['method'],
  confidence: number,
  dictionary: Dictionary,
): DictionaryEntry {
  // Check if already in dictionary (idempotent).
  const existing = dictionary.lookup(original, category);
  if (existing) return existing;

  // Generate collision-free fake value.
  const fakeValue = generateFakerToken(category, dictionary);

  // Add to dictionary via standard path, then overwrite token with fake value.
  const entry = dictionary.addEntity(original, category, method, confidence);
  // Mutate token to store the fake value (tokenPlain remains the ID for reverse lookup).
  (entry as { token: string }).token = fakeValue;

  return entry;
}
