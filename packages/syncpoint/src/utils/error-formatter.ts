/**
 * Format validation errors for human-readable feedback to LLM
 */
export function formatValidationErrors(errors: string[]): string {
  if (errors.length === 0) {
    return 'No validation errors.';
  }

  const formattedErrors = errors.map((error, index) => {
    return `${index + 1}. ${error}`;
  });

  return `Validation failed with ${errors.length} error(s):\n\n${formattedErrors.join('\n')}`;
}

/**
 * Create a retry prompt with validation error context
 */
export function createRetryPrompt(
  originalPrompt: string,
  errors: string[],
  attemptNumber: number,
): string {
  const errorSummary = formatValidationErrors(errors);

  return `${originalPrompt}

---

**VALIDATION FAILED (Attempt ${attemptNumber})**

The previously generated YAML configuration did not pass validation:

${errorSummary}

Please analyze these errors and generate a corrected YAML configuration that addresses all validation issues.

Remember:
- Output pure YAML only (no markdown, no code blocks, no explanations)
- Ensure all required fields are present
- Follow the correct schema structure
- Validate pattern syntax for targets and exclude arrays`;
}

/**
 * Format error for display in terminal UI
 */
export function formatErrorForDisplay(error: string | Error): string {
  if (error instanceof Error) {
    return error.message;
  }
  return error;
}

/**
 * Create user-friendly error messages
 */
export function createUserFriendlyError(
  context: string,
  error: unknown,
): string {
  const errorMessage = formatErrorForDisplay(
    error instanceof Error ? error : new Error(String(error)),
  );

  return `${context}: ${errorMessage}`;
}
