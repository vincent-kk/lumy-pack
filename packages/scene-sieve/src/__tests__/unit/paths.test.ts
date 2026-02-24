import { describe, expect, it } from 'vitest';

import { deriveOutputPath, isSupportedFile } from '../../utils/paths.js';

describe('deriveOutputPath', () => {
  it('appends _scenes to the basename without extension', () => {
    const result = deriveOutputPath('/tmp/video.mp4');
    expect(result).toMatch(/video_scenes$/);
  });

  it('preserves the directory of the input file', () => {
    const result = deriveOutputPath('/home/user/clips/movie.mov');
    expect(result).toMatch(/\/home\/user\/clips\/movie_scenes$/);
  });

  it('handles files with multiple dots in name', () => {
    const result = deriveOutputPath('/tmp/my.video.file.mp4');
    expect(result).toMatch(/my\.video\.file_scenes$/);
  });

  it('handles files with no extension', () => {
    const result = deriveOutputPath('/tmp/videofile');
    expect(result).toMatch(/videofile_scenes$/);
  });
});

describe('isSupportedFile', () => {
  const videoExts = ['.mp4', '.mov', '.avi', '.mkv', '.webm'];
  const gifExts = ['.gif'];

  it('returns true for supported video extensions', () => {
    expect(isSupportedFile('video.mp4', videoExts)).toBe(true);
    expect(isSupportedFile('clip.mov', videoExts)).toBe(true);
    expect(isSupportedFile('movie.avi', videoExts)).toBe(true);
    expect(isSupportedFile('film.mkv', videoExts)).toBe(true);
    expect(isSupportedFile('stream.webm', videoExts)).toBe(true);
  });

  it('returns true for GIF extension', () => {
    expect(isSupportedFile('animation.gif', gifExts)).toBe(true);
  });

  it('returns false for unsupported extensions', () => {
    expect(isSupportedFile('document.pdf', videoExts)).toBe(false);
    expect(isSupportedFile('image.png', videoExts)).toBe(false);
    expect(isSupportedFile('audio.mp3', videoExts)).toBe(false);
  });

  it('is case-insensitive', () => {
    expect(isSupportedFile('VIDEO.MP4', videoExts)).toBe(true);
    expect(isSupportedFile('Clip.MOV', videoExts)).toBe(true);
    expect(isSupportedFile('Animation.GIF', gifExts)).toBe(true);
  });

  it('returns false for files with no extension', () => {
    expect(isSupportedFile('videofile', videoExts)).toBe(false);
  });

  it('returns false when extension list is empty', () => {
    expect(isSupportedFile('video.mp4', [])).toBe(false);
  });
});
