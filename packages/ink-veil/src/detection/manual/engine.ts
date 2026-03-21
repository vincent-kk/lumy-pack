import type { DetectionSpan } from "../types.js";

/** A manual detection rule — string literal or RegExp. */
export interface ManualRule {
  /** Literal string or RegExp pattern to match. */
  pattern: string | RegExp;
  /** Entity category to assign (e.g. "PROJECT", "INVOICE"). */
  category: string;
}

/**
 * Manual detection engine.
 *
 * Highest-priority engine — user-defined rules override automated detection.
 * Supports string literal rules (exact match, all occurrences) and RegExp rules.
 */
export class ManualEngine {
  /**
   * Detect all spans matching the given rules in `text`.
   *
   * @param text   Source text (should be NFC-normalized before calling).
   * @param rules  Array of manual rules to apply.
   * @returns      DetectionSpan[] sorted by start offset ascending.
   */
  detect(text: string, rules: ManualRule[]): DetectionSpan[] {
    const spans: DetectionSpan[] = [];

    for (const rule of rules) {
      if (typeof rule.pattern === "string") {
        this.detectString(text, rule.pattern, rule.category, spans);
      } else {
        this.detectRegex(text, rule.pattern, rule.category, spans);
      }
    }

    spans.sort((a, b) => a.start - b.start);
    return spans;
  }

  private detectString(
    text: string,
    pattern: string,
    category: string,
    out: DetectionSpan[],
  ): void {
    if (pattern.length === 0) return;

    let searchFrom = 0;
    while (searchFrom < text.length) {
      const idx = text.indexOf(pattern, searchFrom);
      if (idx === -1) break;
      out.push({
        start: idx,
        end: idx + pattern.length,
        text: pattern,
        category,
        method: "MANUAL",
        confidence: 1.0,
      });
      searchFrom = idx + pattern.length;
    }
  }

  private detectRegex(
    text: string,
    pattern: RegExp,
    category: string,
    out: DetectionSpan[],
  ): void {
    // Clone the regex with global flag to prevent infinite loops on stateful RegExp.
    const re = new RegExp(pattern.source, ensureGlobal(pattern.flags));
    let match: RegExpExecArray | null;
    while ((match = re.exec(text)) !== null) {
      const start = match.index;
      const matched = match[0];
      out.push({
        start,
        end: start + matched.length,
        text: matched,
        category,
        method: "MANUAL",
        confidence: 1.0,
      });
      // Guard against zero-width matches to prevent infinite loop.
      if (matched.length === 0) re.lastIndex++;
    }
  }
}

function ensureGlobal(flags: string): string {
  return flags.includes("g") ? flags : flags + "g";
}
