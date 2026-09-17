import { expect, it } from 'vitest';
import { formatTileLabel } from '../../../core/utils/sheet/format-tile-label.js';

it.each([
  [22, 4200, '#22 00:04.2'],
  [1, 0, '#1 00:00.0'],
  [7, 6_001_234, '#7 100:01.2'],
  [2, 59999, '#2 00:59.9'],
])('formats frame %i at %i ms', (id, time, expected) => {
  expect(formatTileLabel(id, time)).toBe(expected);
});
