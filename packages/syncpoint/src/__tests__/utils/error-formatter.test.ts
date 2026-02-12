import { describe, it, expect } from "vitest";
import {
  formatValidationErrors,
  createRetryPrompt,
  formatErrorForDisplay,
  createUserFriendlyError,
} from "../../utils/error-formatter.js";

describe("utils/error-formatter", () => {
  describe("formatValidationErrors", () => {
    it("formats multiple errors with numbering", () => {
      const errors = [
        "/backup/targets must have required property 'targets'",
        "/backup/filename must be string",
      ];

      const formatted = formatValidationErrors(errors);

      expect(formatted).toContain("Validation failed with 2 error(s)");
      expect(formatted).toContain("1. /backup/targets must have required property 'targets'");
      expect(formatted).toContain("2. /backup/filename must be string");
    });

    it("handles single error", () => {
      const errors = ["/backup must be object"];

      const formatted = formatValidationErrors(errors);

      expect(formatted).toContain("Validation failed with 1 error(s)");
      expect(formatted).toContain("1. /backup must be object");
    });

    it("handles empty errors array", () => {
      const errors: string[] = [];

      const formatted = formatValidationErrors(errors);

      expect(formatted).toBe("No validation errors.");
    });
  });

  describe("createRetryPrompt", () => {
    it("creates retry prompt with error context", () => {
      const originalPrompt = "Generate a config file";
      const errors = ["/backup/targets is required"];
      const attemptNumber = 2;

      const retryPrompt = createRetryPrompt(
        originalPrompt,
        errors,
        attemptNumber,
      );

      expect(retryPrompt).toContain(originalPrompt);
      expect(retryPrompt).toContain("VALIDATION FAILED (Attempt 2)");
      expect(retryPrompt).toContain("/backup/targets is required");
      expect(retryPrompt).toContain("pure YAML only");
    });

    it("includes all errors in retry prompt", () => {
      const originalPrompt = "Generate template";
      const errors = [
        "missing required field: name",
        "missing required field: steps",
      ];
      const attemptNumber = 1;

      const retryPrompt = createRetryPrompt(
        originalPrompt,
        errors,
        attemptNumber,
      );

      expect(retryPrompt).toContain("missing required field: name");
      expect(retryPrompt).toContain("missing required field: steps");
    });
  });

  describe("formatErrorForDisplay", () => {
    it("formats Error object", () => {
      const error = new Error("Something went wrong");

      const formatted = formatErrorForDisplay(error);

      expect(formatted).toBe("Something went wrong");
    });

    it("formats string error", () => {
      const error = "Simple error message";

      const formatted = formatErrorForDisplay(error);

      expect(formatted).toBe("Simple error message");
    });
  });

  describe("createUserFriendlyError", () => {
    it("combines context and error message", () => {
      const context = "Failed to scan directory";
      const error = new Error("Permission denied");

      const friendly = createUserFriendlyError(context, error);

      expect(friendly).toBe("Failed to scan directory: Permission denied");
    });

    it("handles non-Error objects", () => {
      const context = "Invalid input";
      const error = "Not a number";

      const friendly = createUserFriendlyError(context, error);

      expect(friendly).toBe("Invalid input: Not a number");
    });

    it("handles Error objects with stack traces", () => {
      const context = "Execution failed";
      const error = new Error("Timeout");

      const friendly = createUserFriendlyError(context, error);

      expect(friendly).toBe("Execution failed: Timeout");
      expect(friendly).not.toContain("at ");
    });
  });
});
