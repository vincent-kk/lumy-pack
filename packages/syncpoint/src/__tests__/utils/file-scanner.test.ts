import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { join } from "node:path";
import { mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import {
  scanHomeDirectory,
  fileStructureToJSON,
  getRecommendedTargets,
} from "../../utils/file-scanner.js";

describe("utils/file-scanner", () => {
  let testDir: string;
  const originalHome = process.env.HOME;

  beforeEach(async () => {
    // Create a temporary home directory for testing
    testDir = join(tmpdir(), `syncpoint-test-${Date.now()}`);
    await mkdir(testDir, { recursive: true });
    // Use SYNCPOINT_HOME which the scanner respects
    process.env.SYNCPOINT_HOME = testDir;
  });

  afterEach(async () => {
    // Clean up
    await rm(testDir, { recursive: true, force: true });
    if (originalHome !== undefined) {
      process.env.HOME = originalHome;
    }
    delete process.env.SYNCPOINT_HOME;
  });

  describe("scanHomeDirectory", () => {
    it("scans and categorizes common config files", async () => {
      // Create test files
      await writeFile(join(testDir, ".zshrc"), "# zsh config", "utf-8");
      await writeFile(join(testDir, ".gitconfig"), "[user]", "utf-8");
      await mkdir(join(testDir, ".ssh"), { recursive: true });
      await writeFile(join(testDir, ".ssh/config"), "Host *", "utf-8");

      const result = await scanHomeDirectory({ maxDepth: 2 });

      expect(result.homeDir).toBe(testDir);
      expect(result.totalFiles).toBeGreaterThan(0);
      expect(result.categories.length).toBeGreaterThan(0);

      // Check that shell configs are found
      const shellCategory = result.categories.find((c) =>
        c.category.includes("Shell"),
      );
      expect(shellCategory).toBeDefined();
      expect(shellCategory?.files).toContain(".zshrc");

      // Check that git configs are found
      const gitCategory = result.categories.find((c) =>
        c.category.includes("Git"),
      );
      expect(gitCategory).toBeDefined();
      expect(gitCategory?.files).toContain(".gitconfig");

      // Check that SSH configs are found
      const sshCategory = result.categories.find((c) =>
        c.category.includes("SSH"),
      );
      expect(sshCategory).toBeDefined();
      expect(sshCategory?.files).toContain(".ssh/config");
    });

    it("respects maxDepth option", async () => {
      // Create nested directory structure
      await mkdir(join(testDir, "a/b/c/d/e"), { recursive: true });
      await writeFile(join(testDir, "a/b/c/d/e/.zshrc"), "deep", "utf-8");

      const result = await scanHomeDirectory({ maxDepth: 3 });

      // File at depth 5 should not be found with maxDepth 3
      const allFiles = result.categories.flatMap((c) => c.files);
      expect(allFiles).not.toContain("a/b/c/d/e/.zshrc");
    });

    it("excludes ignored patterns", async () => {
      await mkdir(join(testDir, "node_modules"), { recursive: true });
      await writeFile(
        join(testDir, "node_modules/.zshrc"),
        "should be ignored",
        "utf-8",
      );

      const result = await scanHomeDirectory();

      const allFiles = result.categories.flatMap((c) => c.files);
      expect(allFiles).not.toContain("node_modules/.zshrc");
    });

    it("handles empty home directory", async () => {
      const result = await scanHomeDirectory();

      expect(result.homeDir).toBe(testDir);
      expect(result.totalFiles).toBe(0);
      expect(result.categories).toEqual([]);
    });
  });

  describe("fileStructureToJSON", () => {
    it("converts file structure to JSON string", () => {
      const structure = {
        homeDir: "/home/user",
        categories: [
          {
            category: "Shell Configuration",
            files: [".zshrc", ".bashrc"],
          },
        ],
        totalFiles: 2,
      };

      const json = fileStructureToJSON(structure);

      expect(json).toBeTypeOf("string");
      const parsed = JSON.parse(json);
      expect(parsed).toEqual(structure);
    });
  });

  describe("getRecommendedTargets", () => {
    it("returns targets with tilde prefix", () => {
      const structure = {
        homeDir: "/home/user",
        categories: [
          {
            category: "Shell Configuration",
            files: [".zshrc", ".config/starship.toml"],
          },
        ],
        totalFiles: 2,
      };

      const targets = getRecommendedTargets(structure);

      expect(targets).toEqual(["~/.zshrc", "~/.config/starship.toml"]);
    });

    it("handles empty categories", () => {
      const structure = {
        homeDir: "/home/user",
        categories: [],
        totalFiles: 0,
      };

      const targets = getRecommendedTargets(structure);

      expect(targets).toEqual([]);
    });
  });
});
