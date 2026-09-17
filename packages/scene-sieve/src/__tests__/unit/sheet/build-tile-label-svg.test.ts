import { expect, it } from 'vitest';
import { buildTileLabelSvg } from '../../../core/utils/sheet/build-tile-label-svg.js';

it('uses the tile canvas, fixed badge formula and explicit text baseline', () => {
  const svg = buildTileLabelSvg('#22 00:04.2', 80, 45).toString();
  expect(svg).toContain('width="80" height="45"');
  expect(svg).toContain('width="59" height="12"');
  expect(svg).toContain('fill-opacity="0.5"');
  expect(svg).toContain('x="3" y="8"');
  expect(svg).toContain('font-size="8"');
  expect(svg).toContain('>#22 00:04.2</text>');
  expect(svg).not.toContain('dominant-baseline');
});
