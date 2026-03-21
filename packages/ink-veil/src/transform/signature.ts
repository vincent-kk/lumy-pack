/**
 * Invisible signature insertion and detection for LLM-preservation.
 * Uses zero-width Unicode characters to embed a marker.
 * MUST NOT import from detection/, document/, node:fs, node:crypto
 */
import { map, filter } from "@winglet/common-utils";

// Zero-width non-joiner (U+200C) = 0 bit, Zero-width joiner (U+200D) = 1 bit
const ZWJ = "\u200D"; // 1
const ZWNJ = "\u200C"; // 0
const MARKER_START = "\u2060"; // Word joiner — marks start of signature

const SIGNATURE_PAYLOAD = "INK-VEIL";

function encodeSignature(payload: string): string {
  let bits = "";
  for (const char of payload) {
    const code = char.charCodeAt(0);
    bits += code.toString(2).padStart(8, "0");
  }
  return (
    MARKER_START + map(bits.split(""), (b) => (b === "1" ? ZWJ : ZWNJ)).join("")
  );
}

function decodeSignature(encoded: string): string | null {
  const start = encoded.indexOf(MARKER_START);
  if (start === -1) return null;

  const bits = map(
    filter(encoded.slice(start + 1).split(""), (c) => c === ZWJ || c === ZWNJ),
    (c) => (c === ZWJ ? "1" : "0"),
  ).join("");

  if (bits.length % 8 !== 0) return null;

  let result = "";
  for (let i = 0; i < bits.length; i += 8) {
    result += String.fromCharCode(parseInt(bits.slice(i, i + 8), 2));
  }
  return result;
}

/** Insert an invisible ink-veil signature into text (after first character). */
export function insertSignature(text: string): string {
  if (text.length === 0) return text;
  const sig = encodeSignature(SIGNATURE_PAYLOAD);
  return text[0] + sig + text.slice(1);
}

/** Detect whether text contains a valid ink-veil signature. */
export function detectSignature(text: string): boolean {
  const decoded = decodeSignature(text);
  return decoded === SIGNATURE_PAYLOAD;
}

/** Remove signature from text if present. */
export function removeSignature(text: string): string {
  return text.replace(new RegExp(`${MARKER_START}[${ZWJ}${ZWNJ}]+`, "g"), "");
}
