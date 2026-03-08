import type { DetectionSpan, DetectionConfig, DetectionEngine } from '../types.js';
import { PATTERNS, applyPattern } from './patterns.js';

export class RegexEngine implements DetectionEngine {
  detect(text: string, config?: DetectionConfig): DetectionSpan[] {
    const allowedCategories = config?.categories;
    const spans: DetectionSpan[] = [];

    for (const pattern of PATTERNS) {
      if (allowedCategories && !allowedCategories.includes(pattern.category)) {
        continue;
      }
      const found = applyPattern(text, pattern);
      spans.push(...found);
    }

    return spans;
  }
}
