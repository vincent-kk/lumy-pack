export { Dictionary } from './dictionary.js';
export { createDictionary, fromJSON } from './dictionary-factory.js';
export { compositeKey } from './entry.js';
export type { DictionaryEntry } from './entry.js';
export { TokenGenerator } from './token-generator.js';
export type { DictionaryJSON, DictionaryStats, DocumentManifest } from './types.js';
// io.ts is NOT re-exported here to keep transform/ subpath clean.
// Import io.ts directly when file I/O is needed.
