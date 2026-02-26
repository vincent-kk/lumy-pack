import { homedir } from 'node:os';

import { describe, expect, it } from 'vitest';

import {
  deriveOutputPath,
  expandTilde,
  resolveAbsolute,
} from '../../utils/paths.js';

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

describe('expandTilde', () => {
  it('expands ~ to homedir', () => {
    const result = expandTilde('~');
    expect(result).toBe(homedir());
  });

  it('expands ~/ to homedir-prefixed path', () => {
    const result = expandTilde('~/Desktop/foo.gif');
    expect(result).toMatch(/Desktop\/foo\.gif$/);
    expect(result).not.toContain('~');
  });

  it('leaves absolute paths unchanged', () => {
    const abs = '/tmp/video.mp4';
    expect(expandTilde(abs)).toBe(abs);
  });

  it('leaves relative paths without ~ unchanged', () => {
    expect(expandTilde('Desktop/foo.gif')).toBe('Desktop/foo.gif');
  });
});

describe('resolveAbsolute', () => {
  it('resolves ~ path to absolute path under homedir', () => {
    const result = resolveAbsolute('~/Desktop/screenRecord2.gif');
    expect(result).not.toContain('~');
    expect(result).toMatch(/screenRecord2\.gif$/);
  });

  it('deriveOutputPath with resolveAbsolute(~ path) is cwd-independent', () => {
    const normalized = resolveAbsolute('~/Desktop/screenRecord2.gif');
    const outDir = deriveOutputPath(normalized);
    expect(outDir).toMatch(/screenRecord2_scenes$/);
    expect(outDir).not.toContain('~');
  });
});
