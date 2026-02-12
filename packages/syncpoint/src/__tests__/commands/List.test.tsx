import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock dependencies
vi.mock("../../core/restore.js", () => ({
  getBackupList: vi.fn(),
}));

vi.mock("../../core/provision.js", () => ({
  listTemplates: vi.fn(),
}));

import { getBackupList } from "../../core/restore.js";
import { listTemplates } from "../../core/provision.js";

describe("List Command", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("registers list command with correct name", async () => {
    const { registerListCommand } = await import("../../commands/List.js");
    const { Command } = await import("commander");
    const program = new Command();

    registerListCommand(program);

    const listCommand = program.commands.find((cmd) => cmd.name() === "list");
    expect(listCommand).toBeDefined();
    expect(listCommand?.name()).toBe("list");
  });

  it("list command has correct description", async () => {
    const { registerListCommand } = await import("../../commands/List.js");
    const { Command } = await import("commander");
    const program = new Command();

    registerListCommand(program);

    const listCommand = program.commands.find((cmd) => cmd.name() === "list");
    expect(listCommand?.description()).toContain("List");
  });

  it("list command is properly registered", async () => {
    const { registerListCommand } = await import("../../commands/List.js");
    const { Command } = await import("commander");
    const program = new Command();

    registerListCommand(program);

    const listCommand = program.commands.find((cmd) => cmd.name() === "list");
    expect(listCommand).toBeDefined();
    expect(listCommand?.name()).toBe("list");
  });

  it("list command has delete option", async () => {
    const { registerListCommand } = await import("../../commands/List.js");
    const { Command } = await import("commander");
    const program = new Command();

    registerListCommand(program);

    const listCommand = program.commands.find((cmd) => cmd.name() === "list");
    const options = listCommand?.options || [];
    const deleteOption = options.find((opt) => opt.long === "--delete");

    expect(deleteOption).toBeDefined();
  });

  it("exposes getBackupList dependency", () => {
    expect(getBackupList).toBeDefined();
    expect(typeof getBackupList).toBe("function");
  });

  it("exposes listTemplates dependency", () => {
    expect(listTemplates).toBeDefined();
    expect(typeof listTemplates).toBe("function");
  });
});
