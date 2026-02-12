import type { FileStructure } from "../utils/file-scanner.js";

export interface ConfigPromptVariables {
  fileStructure: FileStructure;
  defaultConfig: string;
}

/**
 * Generate the LLM prompt for config wizard
 */
export function generateConfigWizardPrompt(
  variables: ConfigPromptVariables,
): string {
  const fileStructureJSON = JSON.stringify(variables.fileStructure, null, 2);

  return `You are a Syncpoint configuration assistant. Your role is to analyze the user's home directory structure and generate a personalized backup configuration file.

**Input:**
1. Home directory file structure (JSON format)
2. Default configuration template (YAML)

**Your Task:**
1. Analyze the provided file structure to identify important configuration files
2. Ask the user clarifying questions to understand their backup needs:
   - Development environment files (e.g., Node.js, Python configs)
   - Shell customizations (zsh, bash)
   - Application settings
   - SSH and Git configurations
3. Based on user responses, generate a customized \`config.yml\` file

**Output Requirements:**
- Pure YAML format only (no markdown, no code blocks, no explanations)
- Must be valid according to Syncpoint config schema
- Include \`backup.targets\` array with recommended files/patterns
- Include \`backup.exclude\` array with common exclusions
- Use appropriate pattern types:
  - Literal paths: ~/.zshrc
  - Glob patterns: ~/.config/*.conf
  - Regex patterns: /\\.toml$/ (for scanning with depth limit)

**File Structure JSON:**
${fileStructureJSON}

**Default Config Template:**
${variables.defaultConfig}

Begin by asking the user about their backup priorities.`;
}
