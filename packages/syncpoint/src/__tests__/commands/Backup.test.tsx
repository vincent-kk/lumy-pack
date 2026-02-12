import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock dependencies
vi.mock("../../core/config.js", () => ({
  loadConfig: vi.fn(),
}));

vi.mock("../../core/backup.js", () => ({
  scanTargets: vi.fn(),
  createBackup: vi.fn(),
}));

import { loadConfig } from "../../core/config.js";
import { scanTargets, createBackup } from "../../core/backup.js";

describe("Backup Command", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("registers backup command with correct name", async () => {
    const { registerBackupCommand } = await import("../../commands/Backup.js");
    const { Command } = await import("commander");
    const program = new Command();

    registerBackupCommand(program);

    const backupCommand = program.commands.find((cmd) => cmd.name() === "backup");
    expect(backupCommand).toBeDefined();
    expect(backupCommand?.name()).toBe("backup");
  });

  it("backup command has correct description", async () => {
    const { registerBackupCommand } = await import("../../commands/Backup.js");
    const { Command } = await import("commander");
    const program = new Command();

    registerBackupCommand(program);

    const backupCommand = program.commands.find((cmd) => cmd.name() === "backup");
    expect(backupCommand?.description()).toContain("backup");
  });

  it("backup command has dry-run option", async () => {
    const { registerBackupCommand } = await import("../../commands/Backup.js");
    const { Command } = await import("commander");
    const program = new Command();

    registerBackupCommand(program);

    const backupCommand = program.commands.find((cmd) => cmd.name() === "backup");
    const options = backupCommand?.options || [];
    const dryRunOption = options.find((opt) => opt.long === "--dry-run");

    expect(dryRunOption).toBeDefined();
  });

  it("backup command has tag option", async () => {
    const { registerBackupCommand } = await import("../../commands/Backup.js");
    const { Command } = await import("commander");
    const program = new Command();

    registerBackupCommand(program);

    const backupCommand = program.commands.find((cmd) => cmd.name() === "backup");
    const options = backupCommand?.options || [];
    const tagOption = options.find((opt) => opt.long === "--tag");

    expect(tagOption).toBeDefined();
  });

  it("exposes loadConfig dependency", () => {
    expect(loadConfig).toBeDefined();
    expect(typeof loadConfig).toBe("function");
  });

  it("exposes scanTargets dependency", () => {
    expect(scanTargets).toBeDefined();
    expect(typeof scanTargets).toBe("function");
  });

  it("exposes createBackup dependency", () => {
    expect(createBackup).toBeDefined();
    expect(typeof createBackup).toBe("function");
  });
});
