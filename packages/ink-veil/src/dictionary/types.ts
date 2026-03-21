import type { DictionaryEntry } from "./entry.js";
import type { TokenMode } from "../types.js";

/** Serializable snapshot of the dictionary (indexes excluded). */
export interface DictionaryJSON {
  version: string;
  created: string;
  updated: string;
  tokenMode: TokenMode;
  entries: DictionaryEntry[];
  sourceDocuments: DocumentManifest[];
}

/** Statistics about the dictionary contents. */
export interface DictionaryStats {
  total: number;
  byCategory: Record<string, number>;
}

/** Metadata about a document that has been processed with this dictionary. */
export interface DocumentManifest {
  documentId: string;
  fileName: string;
  format: string;
  fidelityTier: string;
  sha256Original: string;
  sha256Veiled: string;
  processedAt: string;
  dictionaryVersion: string;
  entitiesFound: number;
  newEntitiesAdded: number;
}
