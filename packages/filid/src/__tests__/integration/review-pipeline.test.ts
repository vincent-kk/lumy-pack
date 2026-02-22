/**
 * Integration test: Review Pipeline
 * Tests: metrics collection → 3+12 check → decision tree → promotion eligibility
 */
import { describe, it, expect } from "vitest";
import { countTestCases } from "../../metrics/test-counter.js";
import { check312Rule } from "../../metrics/three-plus-twelve.js";
import { decide } from "../../metrics/decision-tree.js";
import { checkPromotionEligibility } from "../../metrics/promotion-tracker.js";
import { validatePreToolUse } from "../../hooks/pre-tool-validator.js";
import { guardStructure } from "../../hooks/structure-guard.js";
import type { PreToolUseInput } from "../../types/hooks.js";

describe("review pipeline", () => {
  describe("metrics collection → 3+12 check", () => {
    it("should pass 3+12 rule for well-structured spec files", () => {
      const specContent = `
        describe('UserService', () => {
          it('should create user', () => {});
          it('should read user', () => {});
          it('should update user', () => {});

          describe('validation', () => {
            it('should reject empty name', () => {});
            it('should reject invalid email', () => {});
            it('should enforce password policy', () => {});
          });
        });
      `;

      const counts = countTestCases({
        filePath: "user.spec.ts",
        content: specContent,
      });
      expect(counts.total).toBe(6);
      expect(counts.total).toBeLessThanOrEqual(15);

      const rule = check312Rule([counts]);
      expect(rule.violated).toBe(false);
    });

    it("should detect 3+12 violation for oversized spec", () => {
      // Generate a spec with 16 test cases (> 15 limit)
      const tests = Array.from(
        { length: 16 },
        (_, i) => `  it('test case ${i + 1}', () => {});`,
      ).join("\n");
      const specContent = `describe('OverloadedSpec', () => {\n${tests}\n});`;

      const counts = countTestCases({
        filePath: "overloaded.spec.ts",
        content: specContent,
      });
      expect(counts.total).toBe(16);

      const rule = check312Rule([counts]);
      expect(rule.violated).toBe(true);
      expect(rule.violatingFiles).toContain("overloaded.spec.ts");
    });
  });

  describe("decision tree integration", () => {
    it("should recommend split for high LCOM4 when tests exceed threshold", () => {
      const decision = decide({
        testCount: 20,
        lcom4: 3,
        cyclomaticComplexity: 8,
      });

      expect(decision.action).toBe("split");
      expect(decision.reason).toContain("LCOM4");
    });

    it("should recommend compress for high CC with cohesive class", () => {
      const decision = decide({
        testCount: 20,
        lcom4: 1,
        cyclomaticComplexity: 20,
      });

      expect(decision.action).toBe("compress");
    });

    it("should recommend ok when test count is within limit", () => {
      const decision = decide({
        testCount: 8,
        lcom4: 1,
        cyclomaticComplexity: 5,
      });

      expect(decision.action).toBe("ok");
    });
  });

  describe("promotion eligibility", () => {
    it("should identify stable tests as promotion candidates", () => {
      // Default threshold is 90 days
      const candidate = checkPromotionEligibility({
        testFilePath: "auth.test.ts",
        specFilePath: "auth.spec.ts",
        stableDays: 100,
        lastFailure: null,
        caseCount: 8,
      });

      expect(candidate.eligible).toBe(true);
    });

    it("should reject recently failed tests", () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      const candidate = checkPromotionEligibility({
        testFilePath: "flaky.test.ts",
        specFilePath: "flaky.spec.ts",
        stableDays: 100,
        lastFailure: yesterday.toISOString(),
        caseCount: 5,
      });

      expect(candidate.eligible).toBe(false);
    });
  });

  describe("hook enforcement in review context", () => {
    it("should block oversized CLAUDE.md writes", () => {
      const longContent = Array.from(
        { length: 101 },
        (_, i) => `Line ${i + 1}`,
      ).join("\n");
      const input: PreToolUseInput = {
        tool_name: "Write",
        tool_input: {
          file_path: "/project/CLAUDE.md",
          content: longContent,
        },
        cwd: "/project",
        session_id: "test",
        hook_event_name: "PreToolUse",
      };

      const result = validatePreToolUse(input);
      expect(result.continue).toBe(false);
    });

    it("should block CLAUDE.md in organ directories", () => {
      const input: PreToolUseInput = {
        tool_name: "Write",
        tool_input: {
          file_path: "/project/auth/components/CLAUDE.md",
          content: "# Components",
        },
        cwd: "/project",
        session_id: "test",
        hook_event_name: "PreToolUse",
      };

      const result = guardStructure(input);
      expect(result.continue).toBe(false);
    });

    it("should allow valid CLAUDE.md writes", () => {
      const validContent = Array.from(
        { length: 50 },
        (_, i) => `Line ${i + 1}`,
      ).join("\n");
      const input: PreToolUseInput = {
        tool_name: "Write",
        tool_input: {
          file_path: "/project/auth/CLAUDE.md",
          content: validContent,
        },
        cwd: "/project",
        session_id: "test",
        hook_event_name: "PreToolUse",
      };

      const result = validatePreToolUse(input);
      expect(result.continue).toBe(true);

      const guardResult = guardStructure(input);
      expect(guardResult.continue).toBe(true);
    });
  });
});
