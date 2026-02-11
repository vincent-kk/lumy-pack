import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createInitializedSandbox, type Sandbox } from "../helpers/sandbox.js";
import { writeFile, readFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { createBackup, scanTargets } from "../../core/backup.js";
import {
  restoreBackup,
  getRestorePlan,
  getBackupList,
} from "../../core/restore.js";
import { loadConfig, saveConfig } from "../../core/config.js";
import { fileExists } from "../../utils/paths.js";
import type { SyncpointConfig } from "../../utils/types.js";

vi.mock("../../utils/logger.js", () => ({
  logger: {
    info: vi.fn(),
    success: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe("Backup-Restore Integration Tests", () => {
  let sandbox: Sandbox;

  beforeEach(async () => {
    sandbox = await createInitializedSandbox();
  });

  afterEach(async () => {
    await sandbox.cleanup();
  });

  it("should create a valid backup archive", async () => {
    // Setup: Create test files
    const zshrcPath = join(sandbox.home, ".zshrc");
    await writeFile(zshrcPath, "export PATH=$PATH:/usr/local/bin", "utf-8");

    const gitconfigPath = join(sandbox.home, ".gitconfig");
    await writeFile(gitconfigPath, "[user]\nname = Test User", "utf-8");

    // Load config and create backup
    const config = await loadConfig();
    const result = await createBackup(config);

    // Verify archive exists
    expect(await fileExists(result.archivePath)).toBe(true);
    expect(result.archivePath).toMatch(/\.tar\.gz$/);

    // Verify metadata
    expect(result.metadata.files.length).toBeGreaterThan(0);
    expect(result.metadata.summary.fileCount).toBe(result.metadata.files.length);
  });

  it("should complete full backup+restore roundtrip", async () => {
    // Setup: Create test file with known content
    let zshrcPath = join(sandbox.home, ".zshrc");
    const zshrcContent = "export PATH=$PATH:/usr/local/bin\nalias ll='ls -la'";
    await writeFile(zshrcPath, zshrcContent, "utf-8");

    // Backup (only .zshrc is in default config targets)
    const config = await loadConfig();
    const backupResult = await createBackup(config);

    // Verify .zshrc was backed up
    expect(backupResult.metadata.files.some(f => f.path.includes(".zshrc"))).toBe(true);

    // Copy archive to temp location before cleanup
    const { copyFile } = await import("node:fs/promises");
    const { tmpdir } = await import("node:os");
    const { mkdtempSync } = await import("node:fs");
    const tempDir = mkdtempSync(join(tmpdir(), "backup-test-"));
    const tempArchivePath = join(tempDir, "backup.tar.gz");
    await copyFile(backupResult.archivePath, tempArchivePath);

    // Delete original files and reinitialize
    await sandbox.cleanup();
    sandbox = await createInitializedSandbox();

    // Update path to new sandbox
    zshrcPath = join(sandbox.home, ".zshrc");

    // Verify file doesn't exist before restore
    expect(await fileExists(zshrcPath)).toBe(false);

    // Restore from temp archive
    const restoreResult = await restoreBackup(tempArchivePath);

    // Verify files were restored
    expect(restoreResult.restoredFiles.length).toBeGreaterThan(0);
    expect(restoreResult.restoredFiles.some(f => f.includes(".zshrc"))).toBe(true);

    // Verify content matches
    const restoredZshrc = await readFile(zshrcPath, "utf-8");
    expect(restoredZshrc).toBe(zshrcContent);

    // Cleanup temp dir
    const { rm } = await import("node:fs/promises");
    await rm(tempDir, { recursive: true, force: true });
  });

  it("should detect identical files and skip during restore", async () => {
    // Setup: Create test file
    const zshrcPath = join(sandbox.home, ".zshrc");
    await writeFile(zshrcPath, "export PATH=$PATH:/usr/local/bin", "utf-8");

    // Backup
    const config = await loadConfig();
    const backupResult = await createBackup(config);

    // Get restore plan without changing files
    const plan = await getRestorePlan(backupResult.archivePath);

    // Verify all actions are "skip" since files are identical
    const skipActions = plan.actions.filter((a) => a.action === "skip");
    expect(skipActions.length).toBeGreaterThan(0);

    // Verify reasons
    for (const action of skipActions) {
      expect(action.reason).toContain("identical");
    }
  });

  it("should detect modified files during restore", async () => {
    // Setup: Create test file
    const zshrcPath = join(sandbox.home, ".zshrc");
    const originalContent = "export PATH=$PATH:/usr/local/bin";
    await writeFile(zshrcPath, originalContent, "utf-8");

    // Backup
    const config = await loadConfig();
    const backupResult = await createBackup(config);

    // Modify file
    const modifiedContent = "export PATH=$PATH:/usr/bin";
    await writeFile(zshrcPath, modifiedContent, "utf-8");

    // Get restore plan
    const plan = await getRestorePlan(backupResult.archivePath);

    // Verify overwrite action detected
    const overwriteActions = plan.actions.filter((a) => a.action === "overwrite");
    expect(overwriteActions.length).toBeGreaterThan(0);

    const zshrcAction = overwriteActions.find((a) => a.path.includes(".zshrc"));
    expect(zshrcAction).toBeDefined();
    expect(zshrcAction?.reason).toContain("modified");
  });

  it("should support backup dry-run mode", async () => {
    // Setup: Create test file
    const zshrcPath = join(sandbox.home, ".zshrc");
    await writeFile(zshrcPath, "export PATH=$PATH:/usr/local/bin", "utf-8");

    // Dry-run backup
    const config = await loadConfig();
    const result = await createBackup(config, { dryRun: true });

    // Verify archive was not created
    expect(await fileExists(result.archivePath)).toBe(false);

    // Verify metadata was generated
    expect(result.metadata.files.length).toBeGreaterThan(0);
  });

  it("should support restore dry-run mode", async () => {
    // Setup: Create test file
    const zshrcPath = join(sandbox.home, ".zshrc");
    const originalContent = "export PATH=$PATH:/usr/local/bin";
    await writeFile(zshrcPath, originalContent, "utf-8");

    // Backup
    const config = await loadConfig();
    const backupResult = await createBackup(config);

    // Modify file
    await writeFile(zshrcPath, "modified content", "utf-8");

    // Dry-run restore
    const restoreResult = await restoreBackup(backupResult.archivePath, {
      dryRun: true,
    });

    // Verify files were not actually restored
    const currentContent = await readFile(zshrcPath, "utf-8");
    expect(currentContent).toBe("modified content");

    // Verify plan was generated
    expect(restoreResult.restoredFiles.length).toBeGreaterThan(0);
  });

  it("should backup files matching glob patterns", async () => {
    // Setup: Create multiple files
    await writeFile(join(sandbox.home, ".zshrc"), "zsh config", "utf-8");
    await writeFile(join(sandbox.home, ".bashrc"), "bash config", "utf-8");
    await writeFile(join(sandbox.home, ".vimrc"), "vim config", "utf-8");

    // Update config to use glob pattern
    const config = await loadConfig();
    config.backup.targets = ["~/.*rc"];
    await saveConfig(config);

    // Scan targets
    const reloadedConfig = await loadConfig();
    const { found } = await scanTargets(reloadedConfig);

    // Verify all *rc files were found
    expect(found.length).toBeGreaterThanOrEqual(3);
    const paths = found.map((f) => f.path);
    expect(paths.some((p) => p.includes(".zshrc"))).toBe(true);
    expect(paths.some((p) => p.includes(".bashrc"))).toBe(true);
    expect(paths.some((p) => p.includes(".vimrc"))).toBe(true);
  });

  it("should exclude files matching exclude patterns", async () => {
    // Setup: Create files
    await writeFile(join(sandbox.home, ".zshrc"), "zsh config", "utf-8");
    await writeFile(join(sandbox.home, ".zshrc.swp"), "swap file", "utf-8");

    // Update config with exclude pattern
    const config = await loadConfig();
    config.backup.targets = ["~/.zshrc*"];
    config.backup.exclude = ["**/*.swp"];
    await saveConfig(config);

    // Scan targets
    const reloadedConfig = await loadConfig();
    const { found } = await scanTargets(reloadedConfig);

    // Verify swap file was excluded
    const paths = found.map((f) => f.path);
    expect(paths.some((p) => p.includes(".zshrc.swp"))).toBe(false);
    expect(paths.some((p) => p === "~/.zshrc")).toBe(true);
  });

  it("should list backups in correct order", async () => {
    // Setup: Create test file
    const zshrcPath = join(sandbox.home, ".zshrc");
    await writeFile(zshrcPath, "export PATH=$PATH:/usr/local/bin", "utf-8");

    const config = await loadConfig();

    // Create multiple backups with delay to ensure different timestamps
    const backup1 = await createBackup(config, { tag: "first" });
    await new Promise((resolve) => setTimeout(resolve, 100));

    await writeFile(zshrcPath, "modified content", "utf-8");
    const backup2 = await createBackup(config, { tag: "second" });
    await new Promise((resolve) => setTimeout(resolve, 100));

    await writeFile(zshrcPath, "another modification", "utf-8");
    const backup3 = await createBackup(config, { tag: "third" });

    // Get backup list
    const backupList = await getBackupList(config);

    // Verify count
    expect(backupList.length).toBeGreaterThanOrEqual(3);

    // Verify sorted by date descending (newest first)
    for (let i = 0; i < backupList.length - 1; i++) {
      expect(backupList[i].createdAt.getTime()).toBeGreaterThanOrEqual(
        backupList[i + 1].createdAt.getTime()
      );
    }

    // Verify metadata was read
    expect(backupList[0].hostname).toBeDefined();
    expect(backupList[0].fileCount).toBeGreaterThan(0);
  });
});
