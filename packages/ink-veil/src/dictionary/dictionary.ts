/**
 * Pure in-memory Dictionary class.
 * MUST NOT import node:fs or node:crypto.
 * I/O is handled separately in io.ts.
 */
import type { DetectionMethod, TokenMode } from '../types.js';
import { compositeKey, type DictionaryEntry } from './entry.js';
import { TokenGenerator } from './token-generator.js';
import type { DictionaryJSON, DictionaryStats, DocumentManifest } from './types.js';

const CURRENT_VERSION = '1.0.0';

function buildToken(category: string, id: string, mode: TokenMode): string {
  const tag = category.toLowerCase();
  const numericId = id.split('_')[1];
  switch (mode) {
    case 'tag':
      return `<iv-${tag} id="${numericId}">${id}</iv-${tag}>`;
    case 'bracket':
      return `{{${id}}}`;
    case 'plain':
    default:
      return id;
  }
}

export class Dictionary {
  private forwardIndex: Map<string, DictionaryEntry> = new Map();
  private reverseIndex: Map<string, DictionaryEntry> = new Map();
  private categoryIndex: Map<string, DictionaryEntry[]> = new Map();
  private entriesList: DictionaryEntry[] = [];
  private tokenGen: TokenGenerator = new TokenGenerator();
  private manifests: DocumentManifest[] = [];

  readonly created: string;
  private updated: string;
  readonly tokenMode: TokenMode;

  private constructor(tokenMode: TokenMode, created: string) {
    this.tokenMode = tokenMode;
    this.created = created;
    this.updated = created;
  }

  /** Create a new empty dictionary. */
  static create(tokenMode: TokenMode = 'tag'): Dictionary {
    return new Dictionary(tokenMode, new Date().toISOString());
  }

  /** Deserialize a dictionary from its JSON representation, rebuilding all indexes. */
  static fromJSON(data: DictionaryJSON): Dictionary {
    const dict = new Dictionary(data.tokenMode, data.created);
    dict.updated = data.updated;
    dict.manifests = data.sourceDocuments ? [...data.sourceDocuments] : [];

    for (const entry of data.entries) {
      dict.entriesList.push(entry);
      dict.forwardIndex.set(compositeKey(entry.original, entry.category), entry);
      dict.reverseIndex.set(entry.tokenPlain, entry);

      const catList = dict.categoryIndex.get(entry.category) ?? [];
      catList.push(entry);
      dict.categoryIndex.set(entry.category, catList);

      // Init counter from max numeric ID to prevent collisions
      const numericPart = parseInt(entry.id.split('_').pop() ?? '0', 10);
      if (!isNaN(numericPart)) {
        dict.tokenGen.initFromExisting(entry.category, numericPart);
      }
    }

    return dict;
  }

  /** Serialize dictionary to JSON (indexes excluded — they are rebuilt on load). */
  toJSON(): DictionaryJSON {
    this.updated = new Date().toISOString();
    return {
      version: CURRENT_VERSION,
      created: this.created,
      updated: this.updated,
      tokenMode: this.tokenMode,
      entries: [...this.entriesList],
      sourceDocuments: [...this.manifests],
    };
  }

  /**
   * Add an entity to the dictionary.
   * Idempotent: if the composite key already exists, returns the existing entry
   * and increments occurrenceCount.
   */
  addEntity(
    original: string,
    category: string,
    method: DetectionMethod,
    confidence: number,
    sourceDocument = 'unknown',
  ): DictionaryEntry {
    const key = compositeKey(original, category);
    const existing = this.forwardIndex.get(key);

    if (existing) {
      existing.occurrenceCount += 1;
      existing.lastSeenAt = new Date().toISOString();
      return existing;
    }

    const id = this.tokenGen.next(category);
    const token = buildToken(category, id, this.tokenMode);
    const now = new Date().toISOString();

    const entry: DictionaryEntry = {
      id,
      original,
      category,
      token,
      tokenPlain: id,
      method,
      confidence,
      addedAt: now,
      addedFromDocument: sourceDocument,
      occurrenceCount: 1,
      lastSeenAt: now,
    };

    this.entriesList.push(entry);
    this.forwardIndex.set(key, entry);
    this.reverseIndex.set(id, entry);

    const catList = this.categoryIndex.get(category) ?? [];
    catList.push(entry);
    this.categoryIndex.set(category, catList);

    return entry;
  }

  /** Forward lookup: original text + category → DictionaryEntry. */
  lookup(original: string, category: string): DictionaryEntry | undefined {
    return this.forwardIndex.get(compositeKey(original, category));
  }

  /** Reverse lookup: plain token ID → DictionaryEntry. */
  reverseLookup(tokenPlain: string): DictionaryEntry | undefined {
    return this.reverseIndex.get(tokenPlain);
  }

  /** Get all entries for a category. */
  getCategories(): string[] {
    return Array.from(this.categoryIndex.keys());
  }

  /** Get all entries for a specific category. */
  getByCategory(category: string): DictionaryEntry[] {
    return this.categoryIndex.get(category) ?? [];
  }

  /** Dictionary statistics. */
  stats(): DictionaryStats {
    const byCategory: Record<string, number> = {};
    for (const [cat, entries] of this.categoryIndex) {
      byCategory[cat] = entries.length;
    }
    return { total: this.entriesList.length, byCategory };
  }

  /** Create a deep snapshot for rollback. */
  snapshot(): DictionaryEntry[] {
    return this.entriesList.map((e) => ({ ...e }));
  }

  /**
   * Restore dictionary to a prior snapshot state.
   * Rebuilds all indexes from the snapshot.
   */
  restore(snapshot: DictionaryEntry[]): void {
    this.forwardIndex.clear();
    this.reverseIndex.clear();
    this.categoryIndex.clear();
    this.entriesList = snapshot.map((e) => ({ ...e }));

    const newGen = new TokenGenerator();

    for (const entry of this.entriesList) {
      this.forwardIndex.set(compositeKey(entry.original, entry.category), entry);
      this.reverseIndex.set(entry.tokenPlain, entry);

      const catList = this.categoryIndex.get(entry.category) ?? [];
      catList.push(entry);
      this.categoryIndex.set(entry.category, catList);

      const numericPart = parseInt(entry.id.split('_').pop() ?? '0', 10);
      if (!isNaN(numericPart)) {
        newGen.initFromExisting(entry.category, numericPart);
      }
    }

    this.tokenGen = newGen;
  }

  /** Iterate all entries. */
  entries(): IterableIterator<DictionaryEntry> {
    return this.entriesList.values();
  }

  /** Total number of entries. */
  get size(): number {
    return this.entriesList.length;
  }

  /** Add a document manifest. */
  addManifest(manifest: DocumentManifest): void {
    this.manifests.push(manifest);
  }
}
