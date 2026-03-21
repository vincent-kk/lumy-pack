/**
 * @lumy-pack/ink-veil/transform — subpath export entry.
 * Lightweight: no detection/, no document/, no node:fs
 */
export { Dictionary } from "../dictionary/dictionary.js";
export type { DictionaryEntry } from "../dictionary/entry.js";
export type { DictionaryJSON, DictionaryStats } from "../dictionary/types.js";
export { veilTextFromSpans } from "./veil-from-spans.js";
export type { Span } from "./veil-from-spans.js";
export { veilTextFromDictionary } from "./veil-from-dictionary.js";
export { unveilText } from "./unveil.js";
export {
  insertSignature,
  detectSignature,
  removeSignature,
} from "./signature.js";
export type { VeilResult, UnveilResult, TokenIntegrity } from "./types.js";
