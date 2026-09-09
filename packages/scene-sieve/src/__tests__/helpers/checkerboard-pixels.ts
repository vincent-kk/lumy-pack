/**
 * Build the translated grayscale texture shared by analyzer regression fixtures.
 * @param index - Frame position; each step translates the checkerboard by eight pixels.
 * @returns Raw 320 by 240 single-channel pixels.
 */
export function createCheckerboardPixels(index: number): Buffer {
  const pixels = Buffer.alloc(320 * 240);
  for (let y = 0; y < 240; y++) {
    for (let x = 0; x < 320; x++) {
      pixels[y * 320 + x] =
        ((Math.floor((x + index * 8) / 32) + Math.floor(y / 32)) % 2) * 255;
    }
  }
  return pixels;
}
