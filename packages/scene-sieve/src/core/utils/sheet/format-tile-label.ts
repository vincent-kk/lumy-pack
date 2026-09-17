/**
 * Format a contact sheet label without rounding into the next tenth of a second.
 * @param frameId - One-based candidate frame ID.
 * @param timestampMs - Nonnegative candidate time in milliseconds.
 * @returns A label in the form "#<id> mm:ss.s", allowing minutes beyond two digits.
 */
export function formatTileLabel(frameId: number, timestampMs: number): string {
  const tenths = Math.floor(timestampMs / 100);
  const minutes = String(Math.floor(tenths / 600)).padStart(2, '0');
  const seconds = String(Math.floor(tenths / 10) % 60).padStart(2, '0');
  return `#${frameId} ${minutes}:${seconds}.${tenths % 10}`;
}
