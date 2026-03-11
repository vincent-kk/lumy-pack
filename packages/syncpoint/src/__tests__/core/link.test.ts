import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockLstat = vi.hoisted(() => vi.fn());
const mockRm = vi.hoisted(() => vi.fn());
const mockStat = vi.hoisted(() => vi.fn());
const mockSymlink = vi.hoisted(() => vi.fn());
const mockUnlink = vi.hoisted(() => vi.fn());

vi.mock('node:fs/promises', () => ({
  cp: vi.fn(),
  lstat: mockLstat,
  readlink: vi.fn(),
  rename: vi.fn(),
  rm: mockRm,
  stat: mockStat,
  symlink: mockSymlink,
  unlink: mockUnlink,
}));

vi.mock('../../constants.js', async () => {
  const actual =
    await vi.importActual<typeof import('../../constants.js')>(
      '../../constants.js',
    );
  return {
    ...actual,
    getAppDir: vi.fn(() => '/home/user/.syncpoint'),
  };
});

vi.mock('../../utils/paths.js', async () => {
  const actual = await vi.importActual<typeof import('../../utils/paths.js')>(
    '../../utils/paths.js',
  );
  return {
    ...actual,
    expandTilde: vi.fn((path: string) => path.replace(/^~/, '/home/user')),
  };
});

describe('core/linkSyncpointByRef', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('removes an existing directory before creating the symlink', async () => {
    const { linkSyncpointByRef } = await import('../../core/link.js');

    mockStat.mockResolvedValueOnce({
      isDirectory: () => true,
    });
    mockLstat.mockResolvedValueOnce({
      isSymbolicLink: () => false,
    });

    const result = await linkSyncpointByRef('~/Library/Mobile');

    expect(mockRm).toHaveBeenCalledWith('/home/user/.syncpoint', {
      recursive: true,
      force: true,
    });
    expect(mockUnlink).not.toHaveBeenCalled();
    expect(mockSymlink).toHaveBeenCalledWith(
      '/home/user/Library/Mobile/.syncpoint',
      '/home/user/.syncpoint',
    );
    expect(result.targetDir).toBe('/home/user/Library/Mobile/.syncpoint');
  });

  it('unlinks an existing symlink before creating the new one', async () => {
    const { linkSyncpointByRef } = await import('../../core/link.js');

    mockStat.mockResolvedValueOnce({
      isDirectory: () => true,
    });
    mockLstat.mockResolvedValueOnce({
      isSymbolicLink: () => true,
    });

    await linkSyncpointByRef('/tmp/reference');

    expect(mockUnlink).toHaveBeenCalledWith('/home/user/.syncpoint');
    expect(mockRm).not.toHaveBeenCalled();
    expect(mockSymlink).toHaveBeenCalledWith(
      '/tmp/reference/.syncpoint',
      '/home/user/.syncpoint',
    );
  });

  it('uses the path as-is when the reference already points to .syncpoint', async () => {
    const { linkSyncpointByRef } = await import('../../core/link.js');

    mockStat.mockResolvedValueOnce({
      isDirectory: () => true,
    });
    mockLstat.mockResolvedValueOnce({
      isSymbolicLink: () => false,
    });

    const result = await linkSyncpointByRef('/tmp/reference/.syncpoint');

    expect(mockSymlink).toHaveBeenCalledWith(
      '/tmp/reference/.syncpoint',
      '/home/user/.syncpoint',
    );
    expect(result.targetDir).toBe('/tmp/reference/.syncpoint');
  });
});
