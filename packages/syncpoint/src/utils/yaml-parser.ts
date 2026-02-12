import YAML from 'yaml';

/**
 * Check if parsed YAML is a structured object (not a scalar string/number)
 */
function isStructuredYAML(parsed: unknown): boolean {
  return parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed);
}

/**
 * Extract YAML content from LLM response
 * Handles markdown code blocks and pure YAML
 * Rejects plain text and scalar values
 */
export function extractYAML(response: string): string | null {
  // Try to extract YAML from markdown code blocks
  const codeBlockMatch = response.match(/```ya?ml\s*\n([\s\S]*?)\n```/);
  if (codeBlockMatch) {
    const content = codeBlockMatch[1].trim();
    // Even in yaml blocks, validate it's structured YAML
    try {
      const parsed = YAML.parse(content);
      if (isStructuredYAML(parsed)) return content;
    } catch {
      // Not valid structured YAML
    }
  }

  // Try to extract YAML from generic code blocks
  const genericCodeBlockMatch = response.match(/```\s*\n([\s\S]*?)\n```/);
  if (genericCodeBlockMatch) {
    const content = genericCodeBlockMatch[1].trim();
    try {
      const parsed = YAML.parse(content);
      if (isStructuredYAML(parsed)) return content;
    } catch {
      // Not valid YAML
    }
  }

  // Try to parse the entire response as YAML (with structure validation)
  try {
    const parsed = YAML.parse(response);
    if (isStructuredYAML(parsed)) {
      return response.trim();
    }
  } catch {
    // Not valid YAML
  }

  return null;
}

/**
 * Parse YAML string to object
 */
export function parseYAML<T = unknown>(yamlString: string): T {
  return YAML.parse(yamlString) as T;
}

/**
 * Extract and parse YAML from LLM response
 */
export function extractAndParseYAML<T = unknown>(response: string): T | null {
  const yamlString = extractYAML(response);
  if (!yamlString) {
    return null;
  }

  try {
    return parseYAML<T>(yamlString);
  } catch {
    return null;
  }
}

/**
 * Extract config-specific YAML (requires 'backup:' key)
 * More strict validation for Syncpoint config files
 */
export function extractConfigYAML(response: string): string | null {
  const yaml = extractYAML(response);
  if (!yaml) return null;

  try {
    const parsed = YAML.parse(yaml);
    // Config must contain 'backup:' key
    if (parsed && typeof parsed === 'object' && 'backup' in parsed) {
      return yaml;
    }
  } catch {
    // Invalid YAML
  }

  return null;
}
