import micromatch from "micromatch";

/**
 * Pattern type classification for targets and excludes.
 */
export type PatternType = "literal" | "glob" | "regex";

/**
 * Detect the type of a pattern string.
 *
 * Rules:
 * - Regex: Starts and ends with `/`, and the content between doesn't contain unescaped `/`
 *   Example: `/\.conf$/`, `/test/` (simple)
 * - Glob: Contains glob metacharacters: `*`, `?`, `{`
 *   Example: `*.conf`, `~/.config/{a,b}`
 * - Literal: Everything else
 *   Example: `~/.zshrc`, `/usr/local/bin`
 *
 * Special handling for absolute paths vs regex:
 * - `/usr/local/bin` is literal (multiple `/` inside, not at boundaries)
 * - `/test/` is regex (starts and ends with `/`, single segment inside)
 * - `/\.conf$/` is regex (starts and ends with `/`, no unescaped `/` inside)
 */
export function detectPatternType(pattern: string): PatternType {
  // Check for regex pattern: /.../ format
  if (pattern.startsWith("/") && pattern.endsWith("/") && pattern.length > 2) {
    const inner = pattern.slice(1, -1);

    // If the inner content has no unescaped forward slashes, treat as regex
    // We check for unescaped slashes by looking for slashes not preceded by backslash
    const hasUnescapedSlash = /(?<!\\)\//.test(inner);

    if (!hasUnescapedSlash) {
      return "regex";
    }
  }

  // Check for glob pattern
  if (pattern.includes("*") || pattern.includes("?") || pattern.includes("{")) {
    return "glob";
  }

  // Default to literal
  return "literal";
}

/**
 * Parse a regex pattern string (e.g., `/\.conf$/`) into a RegExp object.
 *
 * @throws {Error} If the pattern is invalid regex syntax
 */
export function parseRegexPattern(pattern: string): RegExp {
  if (!pattern.startsWith("/") || !pattern.endsWith("/")) {
    throw new Error(`Invalid regex pattern format: ${pattern}. Must be enclosed in slashes like /pattern/`);
  }

  const regexBody = pattern.slice(1, -1);

  try {
    return new RegExp(regexBody);
  } catch (error) {
    throw new Error(`Invalid regex pattern: ${pattern}. ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Create an optimized exclude matcher function.
 *
 * This function pre-compiles all patterns for efficient repeated matching.
 * It handles three pattern types: glob, regex, and literal.
 *
 * @param excludePatterns - Array of exclude pattern strings
 * @returns A function that tests if a file path should be excluded
 */
export function createExcludeMatcher(
  excludePatterns: string[],
): (filePath: string) => boolean {
  if (excludePatterns.length === 0) {
    return () => false;
  }

  // Pre-compile patterns by type
  const regexPatterns: RegExp[] = [];
  const globPatterns: string[] = [];
  const literalPatterns: Set<string> = new Set();

  for (const pattern of excludePatterns) {
    const type = detectPatternType(pattern);

    if (type === "regex") {
      try {
        regexPatterns.push(parseRegexPattern(pattern));
      } catch {
        // Skip invalid regex patterns (they should be caught by validation earlier)
        console.warn(`Skipping invalid regex pattern: ${pattern}`);
      }
    } else if (type === "glob") {
      globPatterns.push(pattern);
    } else {
      literalPatterns.add(pattern);
    }
  }

  // Return optimized matcher function
  return (filePath: string): boolean => {
    // Check literal patterns first (fastest)
    if (literalPatterns.has(filePath)) {
      return true;
    }

    // Check glob patterns with proper options for absolute paths
    if (globPatterns.length > 0 && micromatch.isMatch(filePath, globPatterns, {
      dot: true,        // Match dotfiles
      matchBase: false, // Don't use basename matching, match full path
    })) {
      return true;
    }

    // Check regex patterns
    for (const regex of regexPatterns) {
      if (regex.test(filePath)) {
        return true;
      }
    }

    return false;
  };
}

/**
 * Validate that a pattern string is well-formed.
 *
 * Used for schema validation at config load time.
 *
 * @param pattern - Pattern string to validate
 * @returns true if valid, false otherwise
 */
export function isValidPattern(pattern: string): boolean {
  if (typeof pattern !== "string" || pattern.length === 0) {
    return false;
  }

  const type = detectPatternType(pattern);

  if (type === "regex") {
    try {
      parseRegexPattern(pattern);
      return true;
    } catch {
      return false;
    }
  }

  // Glob and literal patterns are always valid at this level
  // (glob validity is implicitly checked by fast-glob at runtime)
  return true;
}
