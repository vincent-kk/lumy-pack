import YAML from "yaml";

/**
 * Extract YAML content from LLM response
 * Handles markdown code blocks and pure YAML
 */
export function extractYAML(response: string): string | null {
  // Try to extract YAML from markdown code blocks
  const codeBlockMatch = response.match(/```ya?ml\s*\n([\s\S]*?)\n```/);
  if (codeBlockMatch) {
    return codeBlockMatch[1].trim();
  }

  // Try to extract YAML from generic code blocks
  const genericCodeBlockMatch = response.match(/```\s*\n([\s\S]*?)\n```/);
  if (genericCodeBlockMatch) {
    const content = genericCodeBlockMatch[1].trim();
    // Verify it's YAML by trying to parse
    try {
      YAML.parse(content);
      return content;
    } catch {
      // Not valid YAML
    }
  }

  // Try to parse the entire response as YAML
  try {
    YAML.parse(response);
    return response.trim();
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
