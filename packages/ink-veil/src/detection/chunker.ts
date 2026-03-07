/**
 * Text chunking utility for large document detection.
 *
 * IMPORTANT: NFC normalization must be applied to the full text BEFORE chunking.
 * This is handled by DetectionPipeline.detectChunked(), not here.
 * NFC is idempotent, so detect() calling normalizeNFC() again is harmless.
 */

export interface ChunkOptions {
  /** Target chunk size in characters. Default: 65536 (64KB). */
  chunkSize?: number;
  /** Overlap size in characters between adjacent chunks. Default: 2048 (2KB, ~670 Korean chars). */
  overlap?: number;
}

export interface TextChunk {
  /** The chunk text (may include overlap from previous chunk's end). */
  text: string;
  /** Start offset in the original text. */
  globalOffset: number;
}

const DEFAULT_CHUNK_SIZE = 65536;
const DEFAULT_OVERLAP = 2048;

/** Sentence-ending punctuation followed by whitespace. */
const SENTENCE_END_RE = /[.?!。]\s/g;

/**
 * Split text into overlapping chunks for detection.
 *
 * Boundary strategy (3-tier):
 * 1. Primary: split at last newline within chunkSize
 * 2. Secondary: split at last sentence-ending punctuation (.?!。) + whitespace
 * 3. Fallback: force split at chunkSize (2KB overlap covers the boundary)
 */
export function chunkText(text: string, options?: ChunkOptions): TextChunk[] {
  const chunkSize = options?.chunkSize ?? DEFAULT_CHUNK_SIZE;
  const overlap = options?.overlap ?? DEFAULT_OVERLAP;

  if (text.length <= chunkSize) {
    return [{ text, globalOffset: 0 }];
  }

  const chunks: TextChunk[] = [];
  let start = 0;

  while (start < text.length) {
    const remaining = text.length - start;

    if (remaining <= chunkSize) {
      chunks.push({ text: text.slice(start), globalOffset: start });
      break;
    }

    const window = text.slice(start, start + chunkSize);
    let splitAt = findSplitPoint(window, chunkSize);

    // Advance start for next chunk with overlap
    const chunkEnd = start + splitAt;
    chunks.push({ text: text.slice(start, chunkEnd), globalOffset: start });

    // Next chunk starts at (chunkEnd - overlap) to create overlap region
    const nextStart = chunkEnd - overlap;
    start = nextStart > start ? nextStart : chunkEnd;
  }

  return chunks;
}

/**
 * Find the best split point within a text window.
 * Returns the character offset within the window to split at.
 */
function findSplitPoint(window: string, chunkSize: number): number {
  // Tier 1: Find last newline
  const lastNewline = window.lastIndexOf('\n');
  if (lastNewline > chunkSize * 0.5) {
    return lastNewline + 1; // Include the newline in current chunk
  }

  // Tier 2: Find last sentence-ending punctuation + whitespace
  let lastSentenceEnd = -1;
  SENTENCE_END_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = SENTENCE_END_RE.exec(window)) !== null) {
    if (match.index > chunkSize * 0.5) {
      lastSentenceEnd = match.index + match[0].length;
    }
  }
  if (lastSentenceEnd > 0) {
    return lastSentenceEnd;
  }

  // Tier 3: Force split at chunkSize
  return chunkSize;
}
