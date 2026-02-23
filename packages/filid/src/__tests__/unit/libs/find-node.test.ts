import {
  type SpawnSyncReturns,
  execFileSync,
  spawnSync,
} from 'node:child_process';
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const SCRIPT = join(__dirname, '..', '..', '..', '..', 'libs', 'find-node.sh');

let tmpHome: string;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Create a fake node binary that prints a version string. */
function createFakeNode(binDir: string, version: string): string {
  mkdirSync(binDir, { recursive: true });
  const nodePath = join(binDir, 'node');
  writeFileSync(nodePath, `#!/bin/sh\necho "v${version}"\n`);
  chmodSync(nodePath, 0o755);
  return nodePath;
}

/** Set up an nvm directory tree under tmpHome. */
function setupNvm(
  versions: string[],
  defaultAlias?: string,
  ltsAliases?: Record<string, string>,
): void {
  const versionsDir = join(tmpHome, '.nvm', 'versions', 'node');
  for (const v of versions) {
    createFakeNode(join(versionsDir, `v${v}`, 'bin'), v);
  }
  if (defaultAlias !== undefined) {
    const aliasDir = join(tmpHome, '.nvm', 'alias');
    mkdirSync(aliasDir, { recursive: true });
    writeFileSync(join(aliasDir, 'default'), defaultAlias);
  }
  if (ltsAliases) {
    const ltsDir = join(tmpHome, '.nvm', 'alias', 'lts');
    mkdirSync(ltsDir, { recursive: true });
    for (const [name, value] of Object.entries(ltsAliases)) {
      writeFileSync(join(ltsDir, name), value);
    }
  }
}

/** Set up an fnm directory tree under tmpHome. */
function setupFnm(
  basePath: string,
  versions: string[],
  defaultAlias?: string,
): void {
  const versionsDir = join(basePath, 'node-versions');
  for (const v of versions) {
    createFakeNode(join(versionsDir, `v${v}`, 'installation', 'bin'), v);
  }
  if (defaultAlias !== undefined) {
    const aliasDir = join(basePath, 'aliases');
    mkdirSync(aliasDir, { recursive: true });
    writeFileSync(join(aliasDir, 'default'), defaultAlias);
  }
}

/** Run find-node.sh with tmpHome and return { stdout, stderr, status }. */
function run(extraEnv?: Record<string, string>): SpawnSyncReturns<string> {
  const cacheDir = join(tmpHome, '.claude');
  return spawnSync('sh', [SCRIPT, '--version'], {
    env: {
      HOME: tmpHome,
      PATH: '/usr/bin:/bin',
      CLAUDE_CONFIG_DIR: cacheDir,
      ...extraEnv,
    },
    encoding: 'utf-8',
    timeout: 5000,
  });
}

function cachePath(): string {
  return join(tmpHome, '.claude', 'plugins', 'filid', 'node-path-cache');
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('find-node.sh', () => {
  beforeEach(() => {
    tmpHome = mkdtempSync(join(tmpdir(), 'find-node-test-'));
  });

  afterEach(() => {
    rmSync(tmpHome, { recursive: true, force: true });
  });

  // ── nvm default alias ──────────────────────────────────────────────────

  describe('nvm default alias resolution', () => {
    it('prefers default alias over highest version', () => {
      setupNvm(['20.19.5', '22.5.0'], '20');
      const result = run();
      expect(result.stdout.trim()).toBe('v20.19.5');
    });

    it('resolves lts/{name} alias chain', () => {
      setupNvm(['20.19.5', '22.5.0'], 'lts/iron', { iron: '20' });
      const result = run();
      expect(result.stdout.trim()).toBe('v20.19.5');
    });

    it('resolves lts/* alias chain', () => {
      setupNvm(['20.19.5', '22.5.0'], 'lts/*', { '*': '22' });
      const result = run();
      expect(result.stdout.trim()).toBe('v22.5.0');
    });

    it('falls back to highest when alias target not installed', () => {
      setupNvm(['20.19.5', '22.5.0'], '24');
      const result = run();
      expect(result.stdout.trim()).toBe('v22.5.0');
    });
  });

  // ── nvm fallback (no alias) ────────────────────────────────────────────

  describe('nvm fallback to highest', () => {
    it('picks highest version when no alias file exists', () => {
      setupNvm(['20.19.5', '22.5.0']);
      const result = run();
      expect(result.stdout.trim()).toBe('v22.5.0');
    });

    it('picks highest version among multiple majors', () => {
      setupNvm(['20.19.5', '21.7.0', '22.5.0']);
      const result = run();
      expect(result.stdout.trim()).toBe('v22.5.0');
    });
  });

  // ── fnm default alias ──────────────────────────────────────────────────

  describe('fnm default alias resolution', () => {
    it('prefers default alias over highest version', () => {
      const fnmBase = join(tmpHome, '.fnm');
      setupFnm(fnmBase, ['20.19.5', '22.5.0'], 'v20.19.5');
      const result = run();
      expect(result.stdout.trim()).toBe('v20.19.5');
    });

    it('handles alias without leading v', () => {
      const fnmBase = join(tmpHome, '.fnm');
      setupFnm(fnmBase, ['20.19.5', '22.5.0'], '20.19.5');
      const result = run();
      expect(result.stdout.trim()).toBe('v20.19.5');
    });

    it('falls back to highest when no alias exists', () => {
      const fnmBase = join(tmpHome, '.fnm');
      setupFnm(fnmBase, ['20.19.5', '22.5.0']);
      const result = run();
      expect(result.stdout.trim()).toBe('v22.5.0');
    });
  });

  // ── Cache ──────────────────────────────────────────────────────────────

  describe('cache behavior', () => {
    it('caches resolved path after first run', () => {
      setupNvm(['20.19.5'], '20');
      run();
      expect(existsSync(cachePath())).toBe(true);
      const cached = readFileSync(cachePath(), 'utf-8').trim();
      expect(cached).toContain('.nvm/versions/node/v20.19.5/bin/node');
      expect(cached).toMatch(/:20$/);
    });

    it('uses cached path on second run', () => {
      setupNvm(['20.19.5', '22.5.0'], '20');

      // First run: resolves via nvm default alias
      const first = run();
      expect(first.stdout.trim()).toBe('v20.19.5');

      // Second run: should use cache (same result)
      const second = run();
      expect(second.stdout.trim()).toBe('v20.19.5');
    });

    it('invalidates stale cache when binary is removed', () => {
      setupNvm(['20.19.5', '22.5.0'], '20');

      // First run caches v20
      run();

      // Remove v20, leaving only v22
      rmSync(join(tmpHome, '.nvm', 'versions', 'node', 'v20.19.5'), {
        recursive: true,
        force: true,
      });

      // Second run should fall through to nvm scan (picks v22)
      const result = run();
      expect(result.stdout.trim()).toBe('v22.5.0');
    });
  });

  // ── Version validation ─────────────────────────────────────────────────

  describe('minimum version validation', () => {
    it('rejects node < 20 and prints warning', () => {
      setupNvm(['18.20.2'], '18');
      const result = run();
      expect(result.stderr).toContain('require >= 20');
      // stdout is empty (no valid node found) OR system node is used
      // Since PATH=/usr/bin:/bin, no system node should be found
    });
  });
});
