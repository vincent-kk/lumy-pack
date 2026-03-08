/**
 * Factory functions for Dictionary creation and deserialization.
 * Extracted from Dictionary class to reduce LCOM4.
 */
import type { TokenMode } from '../types.js';
import type { DictionaryJSON } from './types.js';
import { Dictionary } from './dictionary.js';

/** Create a new empty dictionary with the given token mode. */
export function createDictionary(tokenMode: TokenMode = 'tag'): Dictionary {
  return Dictionary.create(tokenMode);
}

/** Deserialize a dictionary from its JSON representation. */
export function fromJSON(data: DictionaryJSON): Dictionary {
  return Dictionary.fromJSON(data);
}
