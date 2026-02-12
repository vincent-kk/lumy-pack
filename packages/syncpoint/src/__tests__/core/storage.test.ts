import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  createArchive,
  extractArchive,
  listArchiveEntries,
  readFileFromArchive,
} from '../../core/storage.js';
import { createSandbox } from '../helpers/sandbox.js';

describe('storage', () => {
  describe('createArchive', () => {
    it('creates archive file at outputPath', async () => {
      const sandbox = createSandbox();
      sandbox.apply();

      try {
        const outputPath = join(sandbox.root, 'test.tar.gz');
        const files = [{ name: 'file1.txt', content: 'content1' }];

        await createArchive(files, outputPath);

        const { stat } = await import('node:fs/promises');
        const stats = await stat(outputPath);
        expect(stats.isFile()).toBe(true);
        expect(stats.size).toBeGreaterThan(0);
      } finally {
        await sandbox.cleanup();
      }
    });

    it('creates archive with content files', async () => {
      const sandbox = createSandbox();
      sandbox.apply();

      try {
        const outputPath = join(sandbox.root, 'test.tar.gz');
        const files = [
          { name: 'file1.txt', content: 'hello' },
          { name: 'file2.txt', content: Buffer.from('world') },
        ];

        await createArchive(files, outputPath);

        const entries = await listArchiveEntries(outputPath);
        expect(entries).toContain('file1.txt');
        expect(entries).toContain('file2.txt');
      } finally {
        await sandbox.cleanup();
      }
    });

    it('creates archive with sourcePath files', async () => {
      const sandbox = createSandbox();
      sandbox.apply();

      try {
        const sourceFile = join(sandbox.root, 'source.txt');
        await writeFile(sourceFile, 'source content', 'utf-8');

        const outputPath = join(sandbox.root, 'test.tar.gz');
        const files = [{ name: 'archived.txt', sourcePath: sourceFile }];

        await createArchive(files, outputPath);

        const content = await readFileFromArchive(outputPath, 'archived.txt');
        expect(content?.toString('utf-8')).toBe('source content');
      } finally {
        await sandbox.cleanup();
      }
    });

    it('handles nested directory paths', async () => {
      const sandbox = createSandbox();
      sandbox.apply();

      try {
        const outputPath = join(sandbox.root, 'test.tar.gz');
        const files = [{ name: 'dir1/dir2/file.txt', content: 'nested' }];

        await createArchive(files, outputPath);

        const entries = await listArchiveEntries(outputPath);
        expect(entries).toContain('dir1/dir2/file.txt');

        const content = await readFileFromArchive(
          outputPath,
          'dir1/dir2/file.txt',
        );
        expect(content?.toString('utf-8')).toBe('nested');
      } finally {
        await sandbox.cleanup();
      }
    });

    it('creates archive with single file', async () => {
      const sandbox = createSandbox();
      sandbox.apply();

      try {
        const outputPath = join(sandbox.root, 'single.tar.gz');
        const files = [{ name: 'only.txt', content: 'single file' }];

        await createArchive(files, outputPath);

        const entries = await listArchiveEntries(outputPath);
        expect(entries).toHaveLength(1);
        expect(entries[0]).toBe('only.txt');
      } finally {
        await sandbox.cleanup();
      }
    });

    it('creates archive with multiple files of different types', async () => {
      const sandbox = createSandbox();
      sandbox.apply();

      try {
        const sourceFile = join(sandbox.root, 'source.txt');
        await writeFile(sourceFile, 'from file', 'utf-8');

        const outputPath = join(sandbox.root, 'mixed.tar.gz');
        const files = [
          { name: 'content.txt', content: 'from content' },
          { name: 'buffer.txt', content: Buffer.from('from buffer') },
          { name: 'source.txt', sourcePath: sourceFile },
        ];

        await createArchive(files, outputPath);

        const entries = await listArchiveEntries(outputPath);
        expect(entries).toHaveLength(3);
        expect(entries).toContain('content.txt');
        expect(entries).toContain('buffer.txt');
        expect(entries).toContain('source.txt');
      } finally {
        await sandbox.cleanup();
      }
    });
  });

  describe('extractArchive', () => {
    it('extracts archive files to destination directory', async () => {
      const sandbox = createSandbox();
      sandbox.apply();

      try {
        const archivePath = join(sandbox.root, 'test.tar.gz');
        const files = [
          { name: 'file1.txt', content: 'content1' },
          { name: 'file2.txt', content: 'content2' },
        ];
        await createArchive(files, archivePath);

        const destDir = join(sandbox.root, 'extracted');
        await extractArchive(archivePath, destDir);

        const file1Content = await readFile(
          join(destDir, 'file1.txt'),
          'utf-8',
        );
        const file2Content = await readFile(
          join(destDir, 'file2.txt'),
          'utf-8',
        );
        expect(file1Content).toBe('content1');
        expect(file2Content).toBe('content2');
      } finally {
        await sandbox.cleanup();
      }
    });

    it('preserves nested directory structure', async () => {
      const sandbox = createSandbox();
      sandbox.apply();

      try {
        const archivePath = join(sandbox.root, 'nested.tar.gz');
        const files = [{ name: 'dir1/file.txt', content: 'nested content' }];
        await createArchive(files, archivePath);

        const destDir = join(sandbox.root, 'extracted');
        await extractArchive(archivePath, destDir);

        const content = await readFile(
          join(destDir, 'dir1', 'file.txt'),
          'utf-8',
        );
        expect(content).toBe('nested content');
      } finally {
        await sandbox.cleanup();
      }
    });

    it('creates destination directory if not exists', async () => {
      const sandbox = createSandbox();
      sandbox.apply();

      try {
        const archivePath = join(sandbox.root, 'test.tar.gz');
        const files = [{ name: 'file.txt', content: 'test' }];
        await createArchive(files, archivePath);

        const destDir = join(sandbox.root, 'new', 'nested', 'dir');
        await extractArchive(archivePath, destDir);

        const content = await readFile(join(destDir, 'file.txt'), 'utf-8');
        expect(content).toBe('test');
      } finally {
        await sandbox.cleanup();
      }
    });

    it('extracts files with correct content', async () => {
      const sandbox = createSandbox();
      sandbox.apply();

      try {
        const originalContent = 'The quick brown fox jumps over the lazy dog';
        const archivePath = join(sandbox.root, 'test.tar.gz');
        const files = [{ name: 'test.txt', content: originalContent }];
        await createArchive(files, archivePath);

        const destDir = join(sandbox.root, 'extracted');
        await extractArchive(archivePath, destDir);

        const extractedContent = await readFile(
          join(destDir, 'test.txt'),
          'utf-8',
        );
        expect(extractedContent).toBe(originalContent);
      } finally {
        await sandbox.cleanup();
      }
    });
  });

  describe('readFileFromArchive', () => {
    it('reads specific file from archive as Buffer', async () => {
      const sandbox = createSandbox();
      sandbox.apply();

      try {
        const archivePath = join(sandbox.root, 'test.tar.gz');
        const files = [
          { name: 'target.txt', content: 'target content' },
          { name: 'other.txt', content: 'other content' },
        ];
        await createArchive(files, archivePath);

        const content = await readFileFromArchive(archivePath, 'target.txt');

        expect(content).toBeInstanceOf(Buffer);
        expect(content?.toString('utf-8')).toBe('target content');
      } finally {
        await sandbox.cleanup();
      }
    });

    it('returns null for non-existent file', async () => {
      const sandbox = createSandbox();
      sandbox.apply();

      try {
        const archivePath = join(sandbox.root, 'test.tar.gz');
        const files = [{ name: 'exists.txt', content: 'content' }];
        await createArchive(files, archivePath);

        const content = await readFileFromArchive(
          archivePath,
          'nonexistent.txt',
        );

        expect(content).toBeNull();
      } finally {
        await sandbox.cleanup();
      }
    });

    it('reads nested file from archive', async () => {
      const sandbox = createSandbox();
      sandbox.apply();

      try {
        const archivePath = join(sandbox.root, 'nested.tar.gz');
        const files = [
          { name: 'dir1/dir2/nested.txt', content: 'deep content' },
        ];
        await createArchive(files, archivePath);

        const content = await readFileFromArchive(
          archivePath,
          'dir1/dir2/nested.txt',
        );

        expect(content?.toString('utf-8')).toBe('deep content');
      } finally {
        await sandbox.cleanup();
      }
    });

    it('handles files with leading ./ in archive', async () => {
      const sandbox = createSandbox();
      sandbox.apply();

      try {
        const archivePath = join(sandbox.root, 'test.tar.gz');
        const files = [{ name: 'file.txt', content: 'content' }];
        await createArchive(files, archivePath);

        // Archives may store entries with ./ prefix
        const content = await readFileFromArchive(archivePath, 'file.txt');

        expect(content).not.toBeNull();
        expect(content?.toString('utf-8')).toBe('content');
      } finally {
        await sandbox.cleanup();
      }
    });

    it('reads binary content correctly', async () => {
      const sandbox = createSandbox();
      sandbox.apply();

      try {
        const binaryData = Buffer.from([0x00, 0x01, 0x02, 0xff, 0xfe]);
        const archivePath = join(sandbox.root, 'binary.tar.gz');
        const files = [{ name: 'binary.dat', content: binaryData }];
        await createArchive(files, archivePath);

        const content = await readFileFromArchive(archivePath, 'binary.dat');

        expect(content).toEqual(binaryData);
      } finally {
        await sandbox.cleanup();
      }
    });
  });

  describe('listArchiveEntries', () => {
    it('lists all entries in archive', async () => {
      const sandbox = createSandbox();
      sandbox.apply();

      try {
        const archivePath = join(sandbox.root, 'test.tar.gz');
        const files = [
          { name: 'file1.txt', content: 'a' },
          { name: 'file2.txt', content: 'b' },
          { name: 'file3.txt', content: 'c' },
        ];
        await createArchive(files, archivePath);

        const entries = await listArchiveEntries(archivePath);

        expect(entries).toHaveLength(3);
        expect(entries).toContain('file1.txt');
        expect(entries).toContain('file2.txt');
        expect(entries).toContain('file3.txt');
      } finally {
        await sandbox.cleanup();
      }
    });

    it('lists nested directory paths', async () => {
      const sandbox = createSandbox();
      sandbox.apply();

      try {
        const archivePath = join(sandbox.root, 'nested.tar.gz');
        const files = [
          { name: 'dir1/file1.txt', content: 'a' },
          { name: 'dir1/dir2/file2.txt', content: 'b' },
          { name: 'root.txt', content: 'c' },
        ];
        await createArchive(files, archivePath);

        const entries = await listArchiveEntries(archivePath);

        expect(entries).toContain('dir1/file1.txt');
        expect(entries).toContain('dir1/dir2/file2.txt');
        expect(entries).toContain('root.txt');
      } finally {
        await sandbox.cleanup();
      }
    });

    it('throws when creating archive with empty files', async () => {
      const sandbox = createSandbox();
      sandbox.apply();

      try {
        const archivePath = join(sandbox.root, 'empty.tar.gz');
        const files: Array<{ name: string; content: string }> = [];

        await expect(createArchive(files, archivePath)).rejects.toThrow();
      } finally {
        await sandbox.cleanup();
      }
    });

    it('returns correct paths without ./ prefix normalization', async () => {
      const sandbox = createSandbox();
      sandbox.apply();

      try {
        const archivePath = join(sandbox.root, 'test.tar.gz');
        const files = [{ name: 'file.txt', content: 'content' }];
        await createArchive(files, archivePath);

        const entries = await listArchiveEntries(archivePath);

        // Entries are returned as-is from tar
        expect(entries.length).toBeGreaterThan(0);
        expect(
          entries.some((e) => e === 'file.txt' || e === './file.txt'),
        ).toBe(true);
      } finally {
        await sandbox.cleanup();
      }
    });
  });
});
