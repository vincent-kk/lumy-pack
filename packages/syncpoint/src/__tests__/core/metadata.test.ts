import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { createSandbox } from "../helpers/sandbox.js";
import {
  createMetadata,
  parseMetadata,
  computeFileHash,
  collectFileInfo,
} from "../../core/metadata.js";
import type { FileEntry, SyncpointConfig } from "../../utils/types.js";

describe("metadata", () => {
  describe("createMetadata", () => {
    it("creates metadata with correct version and toolVersion", () => {
      const files: FileEntry[] = [
        {
          path: "~/.zshrc",
          absolutePath: "/home/user/.zshrc",
          size: 100,
          hash: "sha256:abc123",
        },
      ];
      const config: SyncpointConfig = {
        backup: {
          targets: ["~/.zshrc"],
          exclude: [],
          filename: "test_{datetime}",
          destination: "/backups",
        },
        scripts: { includeInBackup: true },
      };

      const metadata = createMetadata(files, config);

      expect(metadata.version).toBe("1.0.0");
      expect(metadata.toolVersion).toBe("0.0.1");
    });

    it("includes hostname and system info", () => {
      const files: FileEntry[] = [];
      const config: SyncpointConfig = {
        backup: {
          targets: [],
          exclude: [],
          filename: "test",
        },
        scripts: { includeInBackup: false },
      };

      const metadata = createMetadata(files, config);

      expect(metadata.hostname).toBeTruthy();
      expect(typeof metadata.hostname).toBe("string");
      expect(metadata.system).toBeDefined();
      expect(metadata.system.platform).toBeTruthy();
      expect(metadata.system.release).toBeTruthy();
      expect(metadata.system.arch).toBeTruthy();
    });

    it("creates ISO string createdAt timestamp", () => {
      const files: FileEntry[] = [];
      const config: SyncpointConfig = {
        backup: {
          targets: [],
          exclude: [],
          filename: "test",
        },
        scripts: { includeInBackup: false },
      };

      const metadata = createMetadata(files, config);

      expect(metadata.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
      expect(() => new Date(metadata.createdAt)).not.toThrow();
    });

    it("includes correct summary with fileCount and totalSize", () => {
      const files: FileEntry[] = [
        {
          path: "~/.zshrc",
          absolutePath: "/home/user/.zshrc",
          size: 100,
          hash: "sha256:abc",
        },
        {
          path: "~/.bashrc",
          absolutePath: "/home/user/.bashrc",
          size: 200,
          hash: "sha256:def",
        },
      ];
      const config: SyncpointConfig = {
        backup: {
          targets: [],
          exclude: [],
          filename: "test",
        },
        scripts: { includeInBackup: false },
      };

      const metadata = createMetadata(files, config);

      expect(metadata.summary.fileCount).toBe(2);
      expect(metadata.summary.totalSize).toBe(300);
    });

    it("includes config fields filename and destination", () => {
      const files: FileEntry[] = [];
      const config: SyncpointConfig = {
        backup: {
          targets: [],
          exclude: [],
          filename: "backup_{hostname}",
          destination: "/custom/path",
        },
        scripts: { includeInBackup: false },
      };

      const metadata = createMetadata(files, config);

      expect(metadata.config.filename).toBe("backup_{hostname}");
      expect(metadata.config.destination).toBe("/custom/path");
    });

    it("includes files array in metadata", () => {
      const files: FileEntry[] = [
        {
          path: "~/.zshrc",
          absolutePath: "/home/user/.zshrc",
          size: 100,
          hash: "sha256:abc",
        },
      ];
      const config: SyncpointConfig = {
        backup: {
          targets: [],
          exclude: [],
          filename: "test",
        },
        scripts: { includeInBackup: false },
      };

      const metadata = createMetadata(files, config);

      expect(metadata.files).toEqual(files);
    });
  });

  describe("parseMetadata", () => {
    it("parses valid JSON string to BackupMetadata", () => {
      const validJson = JSON.stringify({
        version: "1.0.0",
        toolVersion: "0.0.1",
        createdAt: "2024-01-01T00:00:00.000Z",
        hostname: "testhost",
        system: {
          platform: "linux",
          release: "5.10.0",
          arch: "x64",
        },
        config: {
          filename: "test_{datetime}",
        },
        files: [],
        summary: {
          fileCount: 0,
          totalSize: 0,
        },
      });

      const metadata = parseMetadata(validJson);

      expect(metadata.version).toBe("1.0.0");
      expect(metadata.toolVersion).toBe("0.0.1");
      expect(metadata.hostname).toBe("testhost");
    });

    it("parses Buffer input to BackupMetadata", () => {
      const validJson = JSON.stringify({
        version: "1.0.0",
        toolVersion: "0.0.1",
        createdAt: "2024-01-01T00:00:00.000Z",
        hostname: "testhost",
        system: {
          platform: "linux",
          release: "5.10.0",
          arch: "x64",
        },
        config: {
          filename: "test",
        },
        files: [],
        summary: {
          fileCount: 0,
          totalSize: 0,
        },
      });
      const buffer = Buffer.from(validJson, "utf-8");

      const metadata = parseMetadata(buffer);

      expect(metadata.version).toBe("1.0.0");
      expect(metadata.hostname).toBe("testhost");
    });

    it("throws on invalid JSON", () => {
      const invalidJson = "{ invalid json }";

      expect(() => parseMetadata(invalidJson)).toThrow();
    });

    it("throws on malformed metadata schema", () => {
      const missingFields = JSON.stringify({
        version: "1.0.0",
        // Missing required fields
      });

      expect(() => parseMetadata(missingFields)).toThrow(/Invalid metadata/);
    });

    it("throws on invalid metadata field types", () => {
      const wrongTypes = JSON.stringify({
        version: "1.0.0",
        toolVersion: "0.0.1",
        createdAt: "2024-01-01T00:00:00.000Z",
        hostname: "testhost",
        system: {
          platform: "linux",
          release: "5.10.0",
          arch: "x64",
        },
        config: {
          filename: "test",
        },
        files: "not an array", // Wrong type
        summary: {
          fileCount: 0,
          totalSize: 0,
        },
      });

      expect(() => parseMetadata(wrongTypes)).toThrow(/Invalid metadata/);
    });
  });

  describe("computeFileHash", () => {
    it("computes SHA-256 hash with sha256: prefix", async () => {
      const sandbox = createSandbox();
      sandbox.apply();

      try {
        const testFile = join(sandbox.root, "test.txt");
        await writeFile(testFile, "hello world", "utf-8");

        const hash = await computeFileHash(testFile);

        expect(hash).toMatch(/^sha256:[a-f0-9]{64}$/);
      } finally {
        await sandbox.cleanup();
      }
    });

    it("produces same hash for same content", async () => {
      const sandbox = createSandbox();
      sandbox.apply();

      try {
        const file1 = join(sandbox.root, "file1.txt");
        const file2 = join(sandbox.root, "file2.txt");
        const content = "identical content";
        await writeFile(file1, content, "utf-8");
        await writeFile(file2, content, "utf-8");

        const hash1 = await computeFileHash(file1);
        const hash2 = await computeFileHash(file2);

        expect(hash1).toBe(hash2);
      } finally {
        await sandbox.cleanup();
      }
    });

    it("produces different hash for different content", async () => {
      const sandbox = createSandbox();
      sandbox.apply();

      try {
        const file1 = join(sandbox.root, "file1.txt");
        const file2 = join(sandbox.root, "file2.txt");
        await writeFile(file1, "content A", "utf-8");
        await writeFile(file2, "content B", "utf-8");

        const hash1 = await computeFileHash(file1);
        const hash2 = await computeFileHash(file2);

        expect(hash1).not.toBe(hash2);
      } finally {
        await sandbox.cleanup();
      }
    });

    it("computes hash for empty file", async () => {
      const sandbox = createSandbox();
      sandbox.apply();

      try {
        const testFile = join(sandbox.root, "empty.txt");
        await writeFile(testFile, "", "utf-8");

        const hash = await computeFileHash(testFile);

        expect(hash).toMatch(/^sha256:[a-f0-9]{64}$/);
        // SHA-256 of empty string
        expect(hash).toBe(
          "sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
        );
      } finally {
        await sandbox.cleanup();
      }
    });

    it("computes known SHA-256 hash correctly", async () => {
      const sandbox = createSandbox();
      sandbox.apply();

      try {
        const testFile = join(sandbox.root, "test.txt");
        await writeFile(testFile, "test", "utf-8");

        const hash = await computeFileHash(testFile);

        // SHA-256 of "test" is known
        expect(hash).toBe(
          "sha256:9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08"
        );
      } finally {
        await sandbox.cleanup();
      }
    });
  });

  describe("collectFileInfo", () => {
    it("collects correct path, absolutePath, size, and hash", async () => {
      const sandbox = createSandbox();
      sandbox.apply();

      try {
        const { mkdir } = await import("node:fs/promises");
        await mkdir(sandbox.home, { recursive: true });
        const absolutePath = join(sandbox.home, ".zshrc");
        await writeFile(absolutePath, "echo hello", "utf-8");

        const info = await collectFileInfo(absolutePath, "~/.zshrc");

        expect(info.path).toBe("~/.zshrc");
        expect(info.absolutePath).toBe(absolutePath);
        expect(info.size).toBe(10); // "echo hello" length
        expect(info.hash).toMatch(/^sha256:[a-f0-9]{64}$/);
      } finally {
        await sandbox.cleanup();
      }
    });

    it("detects symlink type", async () => {
      const sandbox = createSandbox();
      sandbox.apply();

      try {
        const targetFile = join(sandbox.root, "target.txt");
        const linkFile = join(sandbox.root, "link.txt");
        await writeFile(targetFile, "target", "utf-8");

        // Create symlink using Node.js
        const { symlink } = await import("node:fs/promises");
        await symlink(targetFile, linkFile);

        const info = await collectFileInfo(linkFile, linkFile);

        expect(info.type).toBe("symlink");
        expect(info.hash).toMatch(/^sha256:[a-f0-9]{64}$/);
      } finally {
        await sandbox.cleanup();
      }
    });

    it("throws when called with a directory path", async () => {
      const sandbox = createSandbox();
      sandbox.apply();

      try {
        const dirPath = join(sandbox.root, "testdir");
        const { mkdir } = await import("node:fs/promises");
        await mkdir(dirPath);

        await expect(collectFileInfo(dirPath, dirPath)).rejects.toThrow();
      } finally {
        await sandbox.cleanup();
      }
    });

    it("does not set type for regular files", async () => {
      const sandbox = createSandbox();
      sandbox.apply();

      try {
        const filePath = join(sandbox.root, "regular.txt");
        await writeFile(filePath, "regular file", "utf-8");

        const info = await collectFileInfo(filePath, filePath);

        expect(info.type).toBeUndefined();
      } finally {
        await sandbox.cleanup();
      }
    });

    it("contracts home directory to tilde in path", async () => {
      const sandbox = createSandbox();
      sandbox.apply();

      try {
        const absolutePath = join(sandbox.home, "Documents", "file.txt");
        const { mkdir } = await import("node:fs/promises");
        await mkdir(join(sandbox.home, "Documents"), { recursive: true });
        await writeFile(absolutePath, "content", "utf-8");

        const info = await collectFileInfo(
          absolutePath,
          join(sandbox.home, "Documents", "file.txt")
        );

        expect(info.path).toBe("~/Documents/file.txt");
      } finally {
        await sandbox.cleanup();
      }
    });
  });
});
