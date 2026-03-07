/**
 * Dictionary merge module.
 * Supports 4 strategies: keep-mine, keep-theirs, prompt (callback), rename (ID reassignment).
 */
import { Dictionary } from './dictionary.js';
import { compositeKey } from './entry.js';
import type { DictionaryEntry } from './entry.js';

export type MergeStrategy = 'keep-mine' | 'keep-theirs' | 'prompt' | 'rename';

export interface MergeConflict {
  key: string;
  mine: DictionaryEntry;
  theirs: DictionaryEntry;
}

export interface MergeResult {
  dictionary: Dictionary;
  conflicts: MergeConflict[];
  added: number;
  skipped: number;
  renamed: number;
}

/**
 * Callback invoked for each conflict in 'prompt' mode.
 * Return 'mine' to keep the existing entry, 'theirs' to replace with the incoming entry.
 */
export type ConflictResolver = (conflict: MergeConflict) => Promise<'mine' | 'theirs'> | 'mine' | 'theirs';

export interface MergeOptions {
  strategy: MergeStrategy;
  /** Required when strategy === 'prompt'. */
  resolver?: ConflictResolver;
}

/**
 * Merge `theirs` dictionary into `mine` dictionary using the specified strategy.
 *
 * - keep-mine:   On composite key conflict, keep mine. Skip their entry.
 * - keep-theirs: On composite key conflict, replace mine with theirs (token preserved).
 * - prompt:      Invoke resolver callback for each conflict.
 * - rename:      On token ID conflict, reassign new IDs to conflicting entries from theirs.
 *                No composite key conflict check — all entries from theirs are added.
 *
 * Returns a new merged Dictionary (does not mutate inputs).
 */
export async function mergeDictionaries(
  mine: Dictionary,
  theirs: Dictionary,
  options: MergeOptions,
): Promise<MergeResult> {
  const { strategy, resolver } = options;

  // Start from a clone of mine
  const merged = Dictionary.fromJSON(mine.toJSON());

  const conflicts: MergeConflict[] = [];
  let added = 0;
  let skipped = 0;
  let renamed = 0;

  for (const entry of theirs.entries()) {
    const key = compositeKey(entry.original, entry.category);
    const existing = merged.lookup(entry.original, entry.category);

    if (strategy === 'rename') {
      // rename: always add, but reassign a new ID if the token ID already exists
      const reverseHit = merged.reverseLookup(entry.tokenPlain);
      if (reverseHit && reverseHit.original !== entry.original) {
        // ID collision — add with a new ID (addEntity generates a fresh sequential ID)
        merged.addEntity(entry.original, entry.category, entry.method, entry.confidence, entry.addedFromDocument);
        renamed++;
      } else if (!existing) {
        merged.addEntity(entry.original, entry.category, entry.method, entry.confidence, entry.addedFromDocument);
        added++;
      } else {
        // Same composite key: skip (already present with same text+category)
        skipped++;
      }
      continue;
    }

    if (!existing) {
      // No conflict — add directly
      merged.addEntity(entry.original, entry.category, entry.method, entry.confidence, entry.addedFromDocument);
      added++;
      continue;
    }

    // Conflict exists
    const conflict: MergeConflict = { key, mine: existing, theirs: entry };
    conflicts.push(conflict);

    let resolution: 'mine' | 'theirs';

    if (strategy === 'keep-mine') {
      resolution = 'mine';
    } else if (strategy === 'keep-theirs') {
      resolution = 'theirs';
    } else {
      // prompt
      if (!resolver) {
        throw new Error("MergeStrategy 'prompt' requires a resolver callback.");
      }
      resolution = await resolver(conflict);
    }

    if (resolution === 'theirs') {
      // Replace: restore existing to theirs values by updating occurrenceCount and method
      existing.occurrenceCount = entry.occurrenceCount;
      existing.method = entry.method;
      existing.confidence = entry.confidence;
      existing.lastSeenAt = entry.lastSeenAt;
      added++;
    } else {
      skipped++;
    }
  }

  return { dictionary: merged, conflicts, added, skipped, renamed };
}
