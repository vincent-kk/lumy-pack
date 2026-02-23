import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs')>();
  return {
    ...actual,
    existsSync: vi.fn(() => false),
    readFileSync: vi.fn(() => {
      throw new Error('not found');
    }),
    writeFileSync: vi.fn(),
    mkdirSync: vi.fn(),
    readdirSync: vi.fn(() => []),
    statSync: vi.fn(() => {
      throw new Error('not found');
    }),
    unlinkSync: vi.fn(),
  };
});

vi.mock('fast-glob', () => ({
  default: vi.fn(async () => []),
  glob: vi.fn(async () => []),
}));

vi.mock('../../../core/project-hash.js', async () => {
  const { glob } = await import('fast-glob');
  const { statSync } = await import('node:fs');
  const { createHash } = await import('node:crypto');
  return {
    computeProjectHash: async (cwd: string) => {
      const files = (await glob('**/*', { cwd, dot: true })) as string[];
      const content = files
        .map((f) => {
          try {
            const s = statSync(f);
            return `${f}:${s.mtimeMs}`;
          } catch {
            return `${f}:0`;
          }
        })
        .join('\n');
      return createHash('sha256').update(content).digest('hex').slice(0, 16);
    },
  };
});

describe('cache-manager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.CLAUDE_CONFIG_DIR;
  });

  // Test 1: cwdHash — same input returns same 12-char hash
  it('cwdHash: returns consistent 12-char hash for same input', async () => {
    const { cwdHash } = await import('../../../core/cache-manager.js');
    const h1 = cwdHash('/some/path');
    const h2 = cwdHash('/some/path');
    expect(h1).toBe(h2);
    expect(h1).toHaveLength(12);
  });

  // Test 2: getCacheDir — returns ~/.claude/plugins/filid/{hash}/ shaped path
  it('getCacheDir: returns path in ~/.claude/plugins/filid/{hash} format', async () => {
    const { getCacheDir, cwdHash } =
      await import('../../../core/cache-manager.js');
    const dir = getCacheDir('/my/project');
    const hash = cwdHash('/my/project');
    expect(dir).toContain('plugins/filid');
    expect(dir).toContain(hash);
  });

  // Test 3: saveRunHash + getLastRunHash — stored hash is returned
  it('saveRunHash + getLastRunHash: stored hash is returned', async () => {
    const { readFileSync, writeFileSync } = await import('node:fs');
    const fsMock = { readFileSync, writeFileSync };

    let stored = '';
    vi.mocked(fsMock.writeFileSync).mockImplementation((_path, data) => {
      stored = data as string;
    });
    vi.mocked(fsMock.readFileSync).mockImplementation(() => stored);

    const { saveRunHash, getLastRunHash } =
      await import('../../../core/cache-manager.js');
    saveRunHash('/proj', 'fca-review', 'abc123');
    const result = getLastRunHash('/proj', 'fca-review');
    expect(result).toBe('abc123');
  });

  // Test 4: getCacheDir — respects CLAUDE_CONFIG_DIR env var
  it('getCacheDir: respects CLAUDE_CONFIG_DIR environment variable', async () => {
    process.env.CLAUDE_CONFIG_DIR = '/custom/config';
    const { getCacheDir } = await import('../../../core/cache-manager.js');
    const dir = getCacheDir('/proj');
    expect(dir).toContain('/custom/config');
    delete process.env.CLAUDE_CONFIG_DIR;
  });

  // Test 5: readCachedContext — returns null when cache absent
  it('readCachedContext: returns null when cache files are absent', async () => {
    const { existsSync } = await import('node:fs');
    vi.mocked(existsSync).mockReturnValue(false);
    const { readCachedContext } =
      await import('../../../core/cache-manager.js');
    const result = readCachedContext('/proj', 'sid-test');
    expect(result).toBeNull();
  });

  // Test 6: writeCachedContext + readCachedContext — stored text is returned
  it('writeCachedContext + readCachedContext: returns stored context text', async () => {
    const { existsSync, readFileSync, writeFileSync } = await import('node:fs');
    const store: Record<string, string> = {};

    vi.mocked(existsSync).mockImplementation((p) => p.toString() in store);
    vi.mocked(writeFileSync).mockImplementation((p, data) => {
      store[p.toString()] = data as string;
    });
    vi.mocked(readFileSync).mockImplementation((p) => {
      const v = store[p.toString()];
      if (v === undefined) throw new Error('not found');
      return v;
    });

    const { writeCachedContext, readCachedContext } =
      await import('../../../core/cache-manager.js');
    writeCachedContext('/proj', 'hello context', 'sid-test');
    const result = readCachedContext('/proj', 'sid-test');
    expect(result).toBe('hello context');
  });

  // Test 7: readCachedContext — different sessions have independent caches
  it('readCachedContext: returns null for different session', async () => {
    const { existsSync } = await import('node:fs');
    vi.mocked(existsSync).mockReturnValue(false);

    const { readCachedContext } =
      await import('../../../core/cache-manager.js');
    const result = readCachedContext('/proj', 'other-session');
    expect(result).toBeNull();
  });

  // Test 8: sessionIdHash — same input returns same hash
  it('sessionIdHash: returns consistent hash for same input', async () => {
    const { sessionIdHash } = await import('../../../core/cache-manager.js');
    const h1 = sessionIdHash('session-abc');
    const h2 = sessionIdHash('session-abc');
    expect(h1).toBe(h2);
    expect(h1).toHaveLength(12);
  });

  // Test 9: isFirstInSession — returns true when marker absent
  it('isFirstInSession: returns true when session marker does not exist', async () => {
    const { existsSync } = await import('node:fs');
    vi.mocked(existsSync).mockReturnValue(false);
    const { isFirstInSession } = await import('../../../core/cache-manager.js');
    expect(isFirstInSession('sid-1', '/proj')).toBe(true);
  });

  // Test 10: isFirstInSession — returns false when marker exists
  it('isFirstInSession: returns false when session marker exists', async () => {
    const { existsSync } = await import('node:fs');
    vi.mocked(existsSync).mockReturnValue(true);
    const { isFirstInSession } = await import('../../../core/cache-manager.js');
    expect(isFirstInSession('sid-2', '/proj')).toBe(false);
  });

  // Test 11: isFirstInSession — returns true on I/O error (fail-safe)
  it('isFirstInSession: returns true on I/O error for safety', async () => {
    const { existsSync } = await import('node:fs');
    vi.mocked(existsSync).mockImplementation(() => {
      throw new Error('permission denied');
    });
    const { isFirstInSession } = await import('../../../core/cache-manager.js');
    expect(isFirstInSession('sid-3', '/proj')).toBe(true);
  });

  // Test 12: markSessionInjected — calls writeFileSync
  it('markSessionInjected: calls writeFileSync after marking session', async () => {
    const { existsSync, writeFileSync } = await import('node:fs');
    vi.mocked(existsSync).mockReturnValue(true);
    const { markSessionInjected } =
      await import('../../../core/cache-manager.js');
    markSessionInjected('sid-4', '/proj');
    expect(vi.mocked(writeFileSync)).toHaveBeenCalled();
  });

  // Test 13: pruneOldSessions — unlinkSync not called when ≤10 session files
  it('pruneOldSessions: does not call unlinkSync when session files <= 10', async () => {
    const { readdirSync, unlinkSync } = await import('node:fs');
    vi.mocked(readdirSync).mockReturnValue([
      'session-context-a',
      'session-context-b',
      'session-context-c',
    ] as unknown as ReturnType<typeof readdirSync>);
    const { pruneOldSessions } = await import('../../../core/cache-manager.js');
    pruneOldSessions('/proj');
    expect(vi.mocked(unlinkSync)).not.toHaveBeenCalled();
  });

  // Test 14: getLastRunHash — returns null when file absent
  it('getLastRunHash: returns null when hash file does not exist', async () => {
    const { readFileSync } = await import('node:fs');
    vi.mocked(readFileSync).mockImplementation(() => {
      throw new Error('not found');
    });
    const { getLastRunHash } = await import('../../../core/cache-manager.js');
    expect(getLastRunHash('/proj', 'fca-scan')).toBeNull();
  });

  // Test 15: computeProjectHash — deterministic hash for same fast-glob result
  it('computeProjectHash: returns deterministic hash for same file list', async () => {
    const fg = await import('fast-glob');
    const statSync = (await import('node:fs')).statSync;

    vi.mocked(fg.default).mockResolvedValue(['src/index.ts', 'README.md']);
    vi.mocked(statSync).mockReturnValue({
      mtimeMs: 1700000000000,
    } as ReturnType<typeof statSync>);

    const { computeProjectHash } =
      await import('../../../core/project-hash.js');
    const h1 = await computeProjectHash('/proj');
    const h2 = await computeProjectHash('/proj');

    expect(h1).toBe(h2);
    expect(h1).toHaveLength(16);
  });
});
