import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { METADATA_FILENAME } from '../../constants.js';
import { createBackup, scanTargets } from '../../core/backup.js';
import { readFileFromArchive } from '../../core/storage.js';
import { fileExists } from '../../utils/paths.js';
import { makeConfig } from '../helpers/fixtures.js';
import { type Sandbox, createInitializedSandbox } from '../helpers/sandbox.js';

vi.mock('../../utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    success: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('core/backup', () => {
  let sandbox: Sandbox;

  beforeEach(async () => {
    sandbox = await createInitializedSandbox();
  });

  afterEach(async () => {
    await sandbox.cleanup();
  });

  describe('scanTargets', () => {
    it('finds files matching literal targets', async () => {
      // Create real test files
      await writeFile(join(sandbox.home, '.zshrc'), 'export PATH=...', 'utf-8');
      await writeFile(
        join(sandbox.home, '.gitconfig'),
        '[user]\nname=test',
        'utf-8',
      );

      const config = makeConfig({
        backup: {
          targets: ['~/.zshrc', '~/.gitconfig'],
          exclude: [],
          filename: 'test',
        },
      });

      const { found, missing } = await scanTargets(config);

      expect(found).toHaveLength(2);
      expect(found.map((f) => f.path)).toContain('~/.zshrc');
      expect(found.map((f) => f.path)).toContain('~/.gitconfig');
      expect(missing).toHaveLength(0);
    });

    it('finds files matching glob patterns', async () => {
      // Create multiple files matching pattern
      await mkdir(join(sandbox.home, '.config'), { recursive: true });
      await writeFile(
        join(sandbox.home, '.config', 'app1.conf'),
        'config1',
        'utf-8',
      );
      await writeFile(
        join(sandbox.home, '.config', 'app2.conf'),
        'config2',
        'utf-8',
      );
      await writeFile(
        join(sandbox.home, '.config', 'readme.txt'),
        'readme',
        'utf-8',
      );

      const config = makeConfig({
        backup: {
          targets: ['~/.config/*.conf'],
          exclude: [],
          filename: 'test',
        },
      });

      const { found, missing } = await scanTargets(config);

      expect(found).toHaveLength(2);
      expect(found.map((f) => f.path)).toContain('~/.config/app1.conf');
      expect(found.map((f) => f.path)).toContain('~/.config/app2.conf');
      expect(missing).toHaveLength(0);
    });

    it('reports missing files in result', async () => {
      const config = makeConfig({
        backup: {
          targets: ['~/.nonexistent', '~/.missing.conf'],
          exclude: [],
          filename: 'test',
        },
      });

      const { found, missing } = await scanTargets(config);

      expect(found).toHaveLength(0);
      expect(missing).toHaveLength(2);
      expect(missing).toContain('~/.nonexistent');
      expect(missing).toContain('~/.missing.conf');
    });

    it('excludes files matching exclude patterns', async () => {
      await mkdir(join(sandbox.home, '.vim'), { recursive: true });
      await writeFile(
        join(sandbox.home, '.vim', 'config.vim'),
        'config',
        'utf-8',
      );
      await writeFile(join(sandbox.home, '.vim', 'temp.swp'), 'swap', 'utf-8');

      const config = makeConfig({
        backup: {
          targets: ['~/.vim/*'],
          exclude: ['**/*.swp'],
          filename: 'test',
        },
      });

      const { found } = await scanTargets(config);

      expect(found).toHaveLength(1);
      expect(found[0].path).toContain('config.vim');
      expect(found.map((f) => f.path)).not.toContain('temp.swp');
    });

    it('excludes sensitive files by default', async () => {
      const { logger } = await import('../../utils/logger.js');
      await writeFile(join(sandbox.home, 'id_rsa'), 'privatekey', 'utf-8');

      const config = makeConfig({
        backup: {
          targets: ['~/id_rsa'],
          exclude: [],
          filename: 'test',
        },
      });

      const { found } = await scanTargets(config);

      expect(found).toHaveLength(0);
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Sensitive file excluded'),
      );
    });

    it('includes sensitive files when includeSensitiveFiles is true', async () => {
      await writeFile(join(sandbox.home, 'id_rsa'), 'privatekey', 'utf-8');

      const config = makeConfig({
        backup: {
          targets: ['~/id_rsa'],
          exclude: [],
          filename: 'test',
          includeSensitiveFiles: true,
        },
      });

      const { found } = await scanTargets(config);

      expect(found).toHaveLength(1);
      expect(found[0].path).toBe('~/id_rsa');
    });

    it('excludes sensitive files from glob targets', async () => {
      await mkdir(join(sandbox.home, '.ssh'), { recursive: true });
      await writeFile(join(sandbox.home, '.ssh', 'config'), 'Host *', 'utf-8');
      await writeFile(
        join(sandbox.home, '.ssh', 'id_rsa'),
        'privatekey',
        'utf-8',
      );

      const config = makeConfig({
        backup: {
          targets: ['~/.ssh/*'],
          exclude: [],
          filename: 'test',
        },
      });

      const { found } = await scanTargets(config);

      expect(found.some((f) => f.path.includes('config'))).toBe(true);
      expect(found.some((f) => f.path.includes('id_rsa'))).toBe(false);
    });

    it('excludes sensitive files from directory targets', async () => {
      await mkdir(join(sandbox.home, '.ssh'), { recursive: true });
      await writeFile(join(sandbox.home, '.ssh', 'config'), 'Host *', 'utf-8');
      await writeFile(
        join(sandbox.home, '.ssh', 'id_ed25519'),
        'privatekey',
        'utf-8',
      );

      const config = makeConfig({
        backup: {
          targets: ['~/.ssh/'],
          exclude: [],
          filename: 'test',
        },
      });

      const { found } = await scanTargets(config);

      expect(found.some((f) => f.path.includes('config'))).toBe(true);
      expect(found.some((f) => f.path.includes('id_ed25519'))).toBe(false);
    });

    describe('literal path exclude (bug fix)', () => {
      it('excludes literal paths matching glob patterns', async () => {
        await writeFile(join(sandbox.home, '.zshrc'), 'config', 'utf-8');
        await writeFile(join(sandbox.home, '.zshrc.bak'), 'backup', 'utf-8');

        const config = makeConfig({
          backup: {
            targets: ['~/.zshrc', '~/.zshrc.bak'],
            exclude: ['**/*.bak'],
            filename: 'test',
          },
        });

        const { found } = await scanTargets(config);

        expect(found).toHaveLength(1);
        expect(found[0].path).toBe('~/.zshrc');
        expect(found.map((f) => f.path)).not.toContain('~/.zshrc.bak');
      });

      it('excludes literal paths matching regex patterns', async () => {
        await writeFile(join(sandbox.home, 'file.tmp'), 'temp', 'utf-8');
        await writeFile(join(sandbox.home, 'file.txt'), 'text', 'utf-8');

        const config = makeConfig({
          backup: {
            targets: ['~/file.tmp', '~/file.txt'],
            exclude: ['/\\.tmp$/'],
            filename: 'test',
          },
        });

        const { found } = await scanTargets(config);

        expect(found).toHaveLength(1);
        expect(found[0].path).toBe('~/file.txt');
        expect(found.map((f) => f.path)).not.toContain('~/file.tmp');
      });

      it('excludes literal paths matching multiple pattern types', async () => {
        await writeFile(join(sandbox.home, 'file.log'), 'log', 'utf-8');
        await writeFile(join(sandbox.home, 'file.bak'), 'backup', 'utf-8');
        await writeFile(join(sandbox.home, 'file.txt'), 'text', 'utf-8');

        const config = makeConfig({
          backup: {
            targets: ['~/file.log', '~/file.bak', '~/file.txt'],
            exclude: ['**/*.log', '/\\.bak$/'],
            filename: 'test',
          },
        });

        const { found } = await scanTargets(config);

        expect(found).toHaveLength(1);
        expect(found[0].path).toBe('~/file.txt');
      });
    });

    describe('regex target patterns', () => {
      it('finds files matching regex patterns', async () => {
        await mkdir(join(sandbox.home, '.config'), { recursive: true });
        await writeFile(
          join(sandbox.home, '.config', 'app1.conf'),
          'config1',
          'utf-8',
        );
        await writeFile(
          join(sandbox.home, '.config', 'app2.conf'),
          'config2',
          'utf-8',
        );
        await writeFile(
          join(sandbox.home, '.config', 'readme.txt'),
          'text',
          'utf-8',
        );

        const config = makeConfig({
          backup: {
            targets: ['/\\.conf$/'],
            exclude: [],
            filename: 'test',
          },
        });

        const { found } = await scanTargets(config);

        expect(found.length).toBeGreaterThan(0);
        expect(found.every((f) => f.path.endsWith('.conf'))).toBe(true);
      });

      it('excludes files from regex targets', async () => {
        await mkdir(join(sandbox.home, '.config'), { recursive: true });
        await writeFile(
          join(sandbox.home, '.config', 'app.conf'),
          'config',
          'utf-8',
        );
        await writeFile(
          join(sandbox.home, '.config', 'app.conf.bak'),
          'backup',
          'utf-8',
        );

        const config = makeConfig({
          backup: {
            targets: ['/\\.conf/'],
            exclude: ['**/*.bak'],
            filename: 'test',
          },
        });

        const { found } = await scanTargets(config);

        expect(
          found.some(
            (f) => f.path.includes('app.conf') && !f.path.includes('.bak'),
          ),
        ).toBe(true);
        expect(found.some((f) => f.path.includes('.bak'))).toBe(false);
      });

      it('handles invalid regex patterns gracefully', async () => {
        const { logger } = await import('../../utils/logger.js');

        const config = makeConfig({
          backup: {
            targets: ['/[invalid/'],
            exclude: [],
            filename: 'test',
          },
        });

        const { found } = await scanTargets(config);

        expect(found).toHaveLength(0);
        expect(logger.warn).toHaveBeenCalledWith(
          expect.stringContaining('Invalid regex pattern'),
        );
      });
    });

    describe('mixed pattern types', () => {
      it('handles glob, regex, and literal patterns together', async () => {
        await mkdir(join(sandbox.home, '.config'), { recursive: true });
        await writeFile(join(sandbox.home, '.zshrc'), 'zsh config', 'utf-8');
        await writeFile(
          join(sandbox.home, '.config', 'app1.conf'),
          'config1',
          'utf-8',
        );
        await writeFile(
          join(sandbox.home, '.config', 'app2.yml'),
          'config2',
          'utf-8',
        );

        const config = makeConfig({
          backup: {
            targets: [
              '~/.zshrc', // literal
              '~/.config/*.yml', // glob
              '/\\.conf$/', // regex
            ],
            exclude: [],
            filename: 'test',
          },
        });

        const { found } = await scanTargets(config);

        expect(found.some((f) => f.path === '~/.zshrc')).toBe(true);
        expect(found.some((f) => f.path.includes('app2.yml'))).toBe(true);
        expect(found.some((f) => f.path.includes('app1.conf'))).toBe(true);
      });
    });

    describe('directory targets', () => {
      it('recursively scans directory when directory path is provided', async () => {
        // Create directory structure
        await mkdir(join(sandbox.home, '.testdir', 'sub'), { recursive: true });
        await writeFile(
          join(sandbox.home, '.testdir', 'file1.txt'),
          'content1',
          'utf-8',
        );
        await writeFile(
          join(sandbox.home, '.testdir', 'file2.txt'),
          'content2',
          'utf-8',
        );
        await writeFile(
          join(sandbox.home, '.testdir', 'sub', 'file3.txt'),
          'content3',
          'utf-8',
        );

        const config = makeConfig({
          backup: {
            targets: ['~/.testdir/'],
            exclude: [],
            filename: 'test',
          },
        });

        const { found, missing } = await scanTargets(config);

        expect(missing).toHaveLength(0);
        expect(found).toHaveLength(3);
        expect(found.some((f) => f.path.includes('file1.txt'))).toBe(true);
        expect(found.some((f) => f.path.includes('file2.txt'))).toBe(true);
        expect(found.some((f) => f.path.includes('file3.txt'))).toBe(true);
      });

      it('applies exclude patterns to directory contents', async () => {
        await mkdir(join(sandbox.home, '.testdir'), { recursive: true });
        await writeFile(
          join(sandbox.home, '.testdir', 'keep.txt'),
          'keep',
          'utf-8',
        );
        await writeFile(
          join(sandbox.home, '.testdir', 'exclude.log'),
          'exclude',
          'utf-8',
        );

        const config = makeConfig({
          backup: {
            targets: ['~/.testdir/'],
            exclude: ['**/*.log'],
            filename: 'test',
          },
        });

        const { found } = await scanTargets(config);

        expect(found).toHaveLength(1);
        expect(found[0].path).toContain('keep.txt');
        expect(found.some((f) => f.path.includes('.log'))).toBe(false);
      });

      it('handles empty directory with warning', async () => {
        const { logger } = await import('../../utils/logger.js');
        await mkdir(join(sandbox.home, '.emptydir'), { recursive: true });

        const config = makeConfig({
          backup: {
            targets: ['~/.emptydir/'],
            exclude: [],
            filename: 'test',
          },
        });

        const { found } = await scanTargets(config);

        expect(found).toHaveLength(0);
        expect(logger.warn).toHaveBeenCalledWith(
          expect.stringContaining('Directory is empty or fully excluded'),
        );
      });

      it('handles mixed file and directory targets', async () => {
        await mkdir(join(sandbox.home, '.testdir'), { recursive: true });
        await writeFile(
          join(sandbox.home, '.testdir', 'dir-file.txt'),
          'dir-content',
          'utf-8',
        );
        await writeFile(
          join(sandbox.home, '.standalone'),
          'standalone-content',
          'utf-8',
        );

        const config = makeConfig({
          backup: {
            targets: ['~/.testdir/', '~/.standalone'],
            exclude: [],
            filename: 'test',
          },
        });

        const { found } = await scanTargets(config);

        expect(found).toHaveLength(2);
        expect(found.some((f) => f.path.includes('dir-file.txt'))).toBe(true);
        expect(found.some((f) => f.path === '~/.standalone')).toBe(true);
      });
    });
  });

  describe('createBackup', () => {
    it('creates tar.gz archive at expected path', async () => {
      await writeFile(join(sandbox.home, '.zshrc'), 'export PATH=...', 'utf-8');

      const config = makeConfig({
        backup: {
          targets: ['~/.zshrc'],
          exclude: [],
          filename: 'test_{datetime}',
        },
      });

      const result = await createBackup(config);

      expect(result.archivePath).toMatch(/\.tar\.gz$/);
      expect(await fileExists(result.archivePath)).toBe(true);
    });

    it('archive contains _metadata.json', async () => {
      await writeFile(join(sandbox.home, '.zshrc'), 'export PATH=...', 'utf-8');

      const config = makeConfig({
        backup: {
          targets: ['~/.zshrc'],
          exclude: [],
          filename: 'test',
        },
      });

      const result = await createBackup(config);

      const metaBuf = await readFileFromArchive(
        result.archivePath,
        METADATA_FILENAME,
      );
      expect(metaBuf).toBeDefined();

      const metadata = JSON.parse(metaBuf!.toString('utf-8'));
      expect(metadata.version).toBe('1.0.0');
      expect(metadata.files).toHaveLength(1);
    });

    it('archive contains all target files', async () => {
      await writeFile(join(sandbox.home, '.zshrc'), 'zshrc content', 'utf-8');
      await writeFile(join(sandbox.home, '.gitconfig'), 'git config', 'utf-8');

      const config = makeConfig({
        backup: {
          targets: ['~/.zshrc', '~/.gitconfig'],
          exclude: [],
          filename: 'test',
        },
      });

      const result = await createBackup(config);

      const zshrcBuf = await readFileFromArchive(result.archivePath, '.zshrc');
      const gitconfigBuf = await readFileFromArchive(
        result.archivePath,
        '.gitconfig',
      );

      expect(zshrcBuf?.toString('utf-8')).toBe('zshrc content');
      expect(gitconfigBuf?.toString('utf-8')).toBe('git config');
    });

    it('returns correct archivePath and metadata', async () => {
      await writeFile(join(sandbox.home, '.zshrc'), 'export PATH=...', 'utf-8');

      const config = makeConfig({
        backup: {
          targets: ['~/.zshrc'],
          exclude: [],
          filename: 'test',
        },
      });

      const result = await createBackup(config);

      expect(result.archivePath).toBeDefined();
      expect(result.metadata).toBeDefined();
      expect(result.metadata.files).toHaveLength(1);
      expect(result.metadata.summary.fileCount).toBe(1);
    });

    it('dry-run returns result without creating archive file', async () => {
      await writeFile(join(sandbox.home, '.zshrc'), 'export PATH=...', 'utf-8');

      const config = makeConfig({
        backup: {
          targets: ['~/.zshrc'],
          exclude: [],
          filename: 'test',
        },
      });

      const result = await createBackup(config, { dryRun: true });

      expect(result.archivePath).toBeDefined();
      expect(result.metadata).toBeDefined();
      expect(await fileExists(result.archivePath)).toBe(false);
    });

    it('uses custom destination from config', async () => {
      await writeFile(join(sandbox.home, '.zshrc'), 'export PATH=...', 'utf-8');
      const customDest = join(sandbox.home, 'custom-backups');
      await mkdir(customDest, { recursive: true });

      const config = makeConfig({
        backup: {
          targets: ['~/.zshrc'],
          exclude: [],
          filename: 'test',
          destination: customDest,
        },
      });

      const result = await createBackup(config);

      expect(result.archivePath).toContain('custom-backups');
      expect(await fileExists(result.archivePath)).toBe(true);
    });

    it('appends tag to filename', async () => {
      await writeFile(join(sandbox.home, '.zshrc'), 'export PATH=...', 'utf-8');

      const config = makeConfig({
        backup: {
          targets: ['~/.zshrc'],
          exclude: [],
          filename: 'test',
        },
      });

      const result = await createBackup(config, { tag: 'mytag' });

      expect(result.archivePath).toContain('mytag');
    });
  });
});
