import { map } from '@winglet/common-utils';
import sharp from 'sharp';

import { SHEET_FILE_NAME, SHEET_TILE_GAP } from '../../../constants/pipeline-defaults.js';
import type { FrameNode, SheetMetadata, SheetOptions } from '../../../types/index.js';

import { buildTileLabelSvg } from './build-tile-label-svg.js';
import { formatTileLabel } from './format-tile-label.js';
import { sampleTileFrames } from './sample-tile-frames.js';

/**
 * Read selected frame images and render a row-major contact sheet.
 * @param input - Nonempty ordered selections, positive dimensions and validated sheet settings.
 * @returns JPEG bytes and the effective tile layout with one-based frame IDs.
 * @throws Propagates sharp image reading, compositing or encoding errors.
 */
export async function renderContactSheet(input: {
  selected: FrameNode[];
  resolution: { width: number; height: number };
  options: Required<SheetOptions>;
  quality: number;
}): Promise<{ buffer: Buffer; metadata: SheetMetadata }> {
  const { selected, resolution, options, quality } = input;
  const { items, sampled } = sampleTileFrames(selected, options.maxTiles);
  const columns = Math.min(options.columns, items.length);
  const rows = Math.ceil(items.length / columns);
  const tileWidth = options.tileWidth;
  const tileHeight = Math.max(1, Math.round(tileWidth * resolution.height / resolution.width));
  const gap = SHEET_TILE_GAP;
  const tiles = await Promise.all(map(items, async (frame, index) => {
    const tile = sharp(frame.extractPath).resize(tileWidth, tileHeight, { fit: 'fill' });
    if (options.label) {
      const text = formatTileLabel(frame.id + 1, Math.round(frame.timestamp * 1000));
      tile.composite([{ input: buildTileLabelSvg(text, tileWidth, tileHeight), top: 0, left: 0 }]);
    }
    return {
      input: await tile.png().toBuffer(),
      top: gap + Math.floor(index / columns) * (tileHeight + gap),
      left: gap + (index % columns) * (tileWidth + gap),
    };
  }));
  const buffer = await sharp({ create: {
    width: columns * tileWidth + (columns + 1) * gap,
    height: rows * tileHeight + (rows + 1) * gap,
    channels: 3, background: 'white',
  } }).composite(tiles).jpeg({ quality, mozjpeg: true }).toBuffer();
  return {
    buffer,
    metadata: {
      fileName: SHEET_FILE_NAME, columns, tileWidth, tileHeight,
      frameIds: map(items, (frame) => frame.id + 1), sampled,
    },
  };
}
