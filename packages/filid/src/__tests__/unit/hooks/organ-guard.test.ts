import { describe, it, expect } from "vitest";
import { guardOrganWrite } from "../../../hooks/organ-guard.js";
import type { PreToolUseInput } from "../../../types/hooks.js";

const baseInput: PreToolUseInput = {
  cwd: "/workspace",
  session_id: "test-session",
  hook_event_name: "PreToolUse",
  tool_name: "Write",
  tool_input: {},
};

describe("organ-guard", () => {
  it("should block CLAUDE.md creation inside organ directories", () => {
    const input: PreToolUseInput = {
      ...baseInput,
      tool_input: { file_path: "/app/src/utils/CLAUDE.md", content: "# Utils" },
    };
    const result = guardOrganWrite(input);
    expect(result.continue).toBe(false);
    expect(result.hookSpecificOutput?.additionalContext).toContain("organ");
  });

  it("should block CLAUDE.md in nested organ directories", () => {
    const input: PreToolUseInput = {
      ...baseInput,
      tool_input: {
        file_path: "/app/src/components/ui/CLAUDE.md",
        content: "# UI",
      },
    };
    const result = guardOrganWrite(input);
    expect(result.continue).toBe(false);
  });

  it("should allow CLAUDE.md in fractal directories", () => {
    const input: PreToolUseInput = {
      ...baseInput,
      tool_input: { file_path: "/app/src/auth/CLAUDE.md", content: "# Auth" },
    };
    const result = guardOrganWrite(input);
    expect(result.continue).toBe(true);
  });

  it("should allow non-CLAUDE.md files in organ directories", () => {
    const input: PreToolUseInput = {
      ...baseInput,
      tool_input: {
        file_path: "/app/src/utils/helper.ts",
        content: "export {}",
      },
    };
    const result = guardOrganWrite(input);
    expect(result.continue).toBe(true);
  });

  it("should pass through Edit tool calls", () => {
    const input: PreToolUseInput = {
      ...baseInput,
      tool_name: "Edit",
      tool_input: {
        file_path: "/app/src/utils/CLAUDE.md",
        new_string: "updated",
      },
    };
    const result = guardOrganWrite(input);
    expect(result.continue).toBe(true);
  });

  it("should detect all known organ directory names", () => {
    const organDirs = [
      "components",
      "utils",
      "types",
      "hooks",
      "helpers",
      "lib",
      "styles",
      "assets",
      "constants",
    ];
    for (const dir of organDirs) {
      const input: PreToolUseInput = {
        ...baseInput,
        tool_input: { file_path: `/app/src/${dir}/CLAUDE.md`, content: "# X" },
      };
      const result = guardOrganWrite(input);
      expect(result.continue, `Expected block for organ dir: ${dir}`).toBe(
        false,
      );
    }
  });

  it("should handle root-relative CLAUDE.md paths", () => {
    const input: PreToolUseInput = {
      ...baseInput,
      tool_input: { file_path: "utils/CLAUDE.md", content: "# Utils" },
    };
    const result = guardOrganWrite(input);
    expect(result.continue).toBe(false);
  });
});
