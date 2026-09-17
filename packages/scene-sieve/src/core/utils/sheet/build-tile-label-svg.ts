import { SHEET_LABEL_HEIGHT_RATIO } from '../../../constants/pipeline-defaults.js';

/**
 * Build a tile-sized SVG overlay with a translucent badge and an explicit text baseline.
 * @param text - A formatTileLabel result containing only digits, #, spaces, colons and periods.
 * @param tileWidth - Positive tile canvas width in pixels.
 * @param tileHeight - Positive tile canvas height in pixels.
 * @returns Encoded SVG bytes for a top-left sharp composite overlay.
 */
export function buildTileLabelSvg(text: string, tileWidth: number, tileHeight: number): Buffer {
  const fontSize = Math.max(8, Math.round(tileHeight * SHEET_LABEL_HEIGHT_RATIO));
  const padX = Math.round(fontSize * 0.4);
  const padY = Math.round(fontSize * 0.2);
  const badgeWidth = Math.min(tileWidth, Math.ceil(text.length * fontSize * 0.6) + 2 * padX);
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${tileWidth}" height="${tileHeight}"><rect x="0" y="0" width="${badgeWidth}" height="${fontSize + 2 * padY}" fill="black" fill-opacity="0.5"/><text x="${padX}" y="${padY + Math.round(fontSize * 0.8)}" font-family="sans-serif" font-size="${fontSize}" fill="white">${text}</text></svg>`);
}
