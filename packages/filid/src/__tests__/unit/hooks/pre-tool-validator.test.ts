import { describe, it, expect } from "vitest";
import { validatePreToolUse } from "../../../hooks/pre-tool-validator.js";
import type { PreToolUseInput } from "../../../types/hooks.js";

const baseInput: PreToolUseInput = {
  cwd: "/workspace",
  session_id: "test-session",
  hook_event_name: "PreToolUse",
  tool_name: "Write",
  tool_input: {},
};

describe("pre-tool-validator", () => {
  it("should block Write to CLAUDE.md exceeding 100 lines", () => {
    const content = Array.from({ length: 101 }, (_, i) => `Line ${i + 1}`).join(
      "\n",
    );
    const input: PreToolUseInput = {
      ...baseInput,
      tool_input: { file_path: "/app/CLAUDE.md", content },
    };
    const result = validatePreToolUse(input);
    expect(result.continue).toBe(false);
  });

  it("should allow Write to CLAUDE.md within 100 lines", () => {
    const content = Array.from({ length: 50 }, (_, i) => `Line ${i + 1}`).join(
      "\n",
    );
    const input: PreToolUseInput = {
      ...baseInput,
      tool_input: { file_path: "/app/CLAUDE.md", content },
    };
    const result = validatePreToolUse(input);
    expect(result.continue).toBe(true);
  });

  it("should pass through non-CLAUDE.md/SPEC.md files", () => {
    const input: PreToolUseInput = {
      ...baseInput,
      tool_input: { file_path: "/app/index.ts", content: "const x = 1;" },
    };
    const result = validatePreToolUse(input);
    expect(result.continue).toBe(true);
  });

  it("should warn when CLAUDE.md is missing boundary sections", () => {
    const content = "# My Module\nSome description\n";
    const input: PreToolUseInput = {
      ...baseInput,
      tool_input: { file_path: "/app/CLAUDE.md", content },
    };
    const result = validatePreToolUse(input);
    // Missing boundaries is a warning, not a block
    expect(result.continue).toBe(true);
    expect(result.hookSpecificOutput?.additionalContext).toContain("missing");
  });

  it("should handle Edit tool targeting CLAUDE.md", () => {
    const input: PreToolUseInput = {
      ...baseInput,
      tool_name: "Edit",
      tool_input: {
        file_path: "/app/CLAUDE.md",
        new_string: Array.from({ length: 200 }, (_, i) => `Line ${i}`).join(
          "\n",
        ),
      },
    };
    // Edit doesn't have full content — cannot validate line limit on partial edits
    const result = validatePreToolUse(input);
    expect(result.continue).toBe(true);
  });

  it("should block SPEC.md if detected as append-only (when old content available)", () => {
    const input: PreToolUseInput = {
      ...baseInput,
      tool_input: {
        file_path: "/app/SPEC.md",
        content: "line1\nline2\nline3\nline4\n",
      },
    };
    const result = validatePreToolUse(input, "line1\nline2\n");
    expect(result.continue).toBe(false);
  });

  it("should allow SPEC.md when content is restructured", () => {
    const input: PreToolUseInput = {
      ...baseInput,
      tool_input: {
        file_path: "/app/SPEC.md",
        content: "# Refactored\n- New structure\n",
      },
    };
    const result = validatePreToolUse(input, "# Old\n- Old content\n");
    expect(result.continue).toBe(true);
  });
});
