import { writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';

import {
  contractTilde,
  ensureDir,
  expandTilde,
  fileExists,
  getHomeDir,
  resolveTargetPath,
} from '../../utils/paths.js';
import { createSandbox } from '../helpers/sandbox.js';

describe('utils/paths', () => {
  describe('getHomeDir', () => {
    it('returns SYNCPOINT_HOME when set', () => {
      const originalHome = process.env.SYNCPOINT_HOME;
      try {
        process.env.SYNCPOINT_HOME = '/custom/home';
        expect(getHomeDir()).toBe('/custom/home');
      } finally {
        if (originalHome !== undefined) {
          process.env.SYNCPOINT_HOME = originalHome;
        } else {
          delete process.env.SYNCPOINT_HOME;
        }
      }
    });

    it('returns os.homedir() when SYNCPOINT_HOME is unset', () => {
      const originalHome = process.env.SYNCPOINT_HOME;
      try {
        delete process.env.SYNCPOINT_HOME;
        expect(getHomeDir()).toBe(homedir());
      } finally {
        if (originalHome !== undefined) {
          process.env.SYNCPOINT_HOME = originalHome;
        }
      }
    });
  });

  describe('expandTilde', () => {
    it('expands "~" to sandbox home', () => {
      const originalHome = process.env.SYNCPOINT_HOME;
      try {
        process.env.SYNCPOINT_HOME = '/sandbox/home';
        expect(expandTilde('~')).toBe('/sandbox/home');
      } finally {
        if (originalHome !== undefined) {
          process.env.SYNCPOINT_HOME = originalHome;
        } else {
          delete process.env.SYNCPOINT_HOME;
        }
      }
    });

    it('expands "~/path" to sandbox home + path', () => {
      const originalHome = process.env.SYNCPOINT_HOME;
      try {
        process.env.SYNCPOINT_HOME = '/sandbox/home';
        expect(expandTilde('~/path')).toBe('/sandbox/home/path');
      } finally {
        if (originalHome !== undefined) {
          process.env.SYNCPOINT_HOME = originalHome;
        } else {
          delete process.env.SYNCPOINT_HOME;
        }
      }
    });

    it('leaves absolute paths unchanged', () => {
      expect(expandTilde('/absolute')).toBe('/absolute');
    });

    it('leaves relative paths unchanged', () => {
      expect(expandTilde('relative')).toBe('relative');
    });
  });

  describe('contractTilde', () => {
    it('returns "~" for sandbox home', () => {
      const originalHome = process.env.SYNCPOINT_HOME;
      try {
        process.env.SYNCPOINT_HOME = '/sandbox/home';
        expect(contractTilde('/sandbox/home')).toBe('~');
      } finally {
        if (originalHome !== undefined) {
          process.env.SYNCPOINT_HOME = originalHome;
        } else {
          delete process.env.SYNCPOINT_HOME;
        }
      }
    });

    it('returns "~/sub" for sandbox home + path', () => {
      const originalHome = process.env.SYNCPOINT_HOME;
      try {
        process.env.SYNCPOINT_HOME = '/sandbox/home';
        expect(contractTilde('/sandbox/home/sub')).toBe('~/sub');
      } finally {
        if (originalHome !== undefined) {
          process.env.SYNCPOINT_HOME = originalHome;
        } else {
          delete process.env.SYNCPOINT_HOME;
        }
      }
    });

    it('leaves other paths unchanged', () => {
      const originalHome = process.env.SYNCPOINT_HOME;
      try {
        process.env.SYNCPOINT_HOME = '/sandbox/home';
        expect(contractTilde('/other/path')).toBe('/other/path');
      } finally {
        if (originalHome !== undefined) {
          process.env.SYNCPOINT_HOME = originalHome;
        } else {
          delete process.env.SYNCPOINT_HOME;
        }
      }
    });
  });

  describe('resolveTargetPath', () => {
    it('returns resolved absolute path for ~/file', () => {
      const originalHome = process.env.SYNCPOINT_HOME;
      try {
        process.env.SYNCPOINT_HOME = '/sandbox/home';
        expect(resolveTargetPath('~/file')).toBe('/sandbox/home/file');
      } finally {
        if (originalHome !== undefined) {
          process.env.SYNCPOINT_HOME = originalHome;
        } else {
          delete process.env.SYNCPOINT_HOME;
        }
      }
    });
  });

  describe('ensureDir and fileExists with sandbox', () => {
    const sandbox = createSandbox();

    beforeEach(async () => {
      sandbox.apply();
      const { mkdir } = await import('node:fs/promises');
      await mkdir(sandbox.home, { recursive: true });
    });

    afterEach(async () => {
      await sandbox.cleanup();
    });

    it('ensureDir creates nested directories', async () => {
      const nestedDir = join(sandbox.home, 'a', 'b', 'c');
      await ensureDir(nestedDir);
      expect(await fileExists(nestedDir)).toBe(true);
    });

    it('ensureDir is idempotent', async () => {
      const dir = join(sandbox.home, 'testdir');
      await ensureDir(dir);
      await ensureDir(dir); // Second call should not throw
      expect(await fileExists(dir)).toBe(true);
    });

    it('fileExists returns true for existing file', async () => {
      const file = join(sandbox.home, 'existing.txt');
      await writeFile(file, 'content');
      expect(await fileExists(file)).toBe(true);
    });

    it('fileExists returns false for missing file', async () => {
      const file = join(sandbox.home, 'nonexistent.txt');
      expect(await fileExists(file)).toBe(false);
    });
  });
});
