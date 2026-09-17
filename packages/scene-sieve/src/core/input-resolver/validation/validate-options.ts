import type { SieveOptions } from '../../../types/index.js';

/**
 * Reject invalid numeric options before defaults or pipeline effects are applied.
 * @param options - Supplied options; omitted numeric fields use pipeline defaults.
 * @returns Nothing when all supplied numeric fields satisfy their contracts.
 * @throws An input error naming the invalid option and its received value.
 */
export function validateOptions(options: SieveOptions): void {
  const rules = [
    ['count', 1, Infinity, true, false, 'an integer >= 1'],
    ['threshold', 0, 1, false, true, 'in range (0, 1] and finite'],
    ['fps', 0, Infinity, false, true, 'finite and > 0'],
    ['maxFrames', 2, Infinity, true, false, 'an integer >= 2'],
    ['scale', 16, Infinity, true, false, 'an integer >= 16'],
    ['quality', 1, 100, true, false, 'an integer in range [1, 100]'],
    ['iouThreshold', 0, 1, false, false, 'finite and in range [0, 1]'],
    ['animationThreshold', 1, Infinity, true, false, 'an integer >= 1'],
    ['maxSegmentDuration', 0, Infinity, false, true, 'finite and > 0'],
    ['concurrency', 1, Infinity, true, false, 'an integer >= 1'],
  ] as const;

  for (const [name, min, max, integer, exclusiveMin, requirement] of rules) {
    const value = options[name];
    if (value === undefined) continue;
    if (
      !Number.isFinite(value) ||
      (integer && !Number.isInteger(value)) ||
      (exclusiveMin ? value <= min : value < min) ||
      value > max
    ) {
      throw new Error(`${name} must be ${requirement}, received: ${value}`);
    }
  }

  const sheet = options.sheet;
  if (sheet === undefined || typeof sheet === 'boolean') return;
  if (sheet === null || typeof sheet !== 'object' || Array.isArray(sheet)) {
    const received = Array.isArray(sheet) ? 'array' : String(sheet);
    throw new Error(`sheet must be a boolean or an object, received: ${received}`);
  }
  const sheetRules = [['columns', 1], ['tileWidth', 16], ['maxTiles', 2]] as const;
  for (const [name, min] of sheetRules) {
    const value = sheet[name];
    if (value === undefined) continue;
    if (!Number.isInteger(value) || value < min) {
      throw new Error(`sheet.${name} must be an integer >= ${min}, received: ${value}`);
    }
  }
  if (sheet.label !== undefined && typeof sheet.label !== 'boolean') {
    throw new Error(`sheet.label must be a boolean, received: ${sheet.label}`);
  }
}
