import { glob } from "fast-glob";
import { join } from "node:path";
import { stat } from "node:fs/promises";
import { getHomeDir } from "./paths.js";

export interface FileCategory {
  category: string;
  files: string[];
}

export interface FileStructure {
  homeDir: string;
  categories: FileCategory[];
  totalFiles: number;
}

/**
 * Categories for common backup targets
 */
const FILE_CATEGORIES = {
  shell: {
    name: "Shell Configuration",
    patterns: [".zshrc", ".bashrc", ".bash_profile", ".profile", ".zprofile"],
  },
  git: {
    name: "Git Configuration",
    patterns: [".gitconfig", ".gitignore_global", ".git-credentials"],
  },
  ssh: {
    name: "SSH Configuration",
    patterns: [".ssh/config", ".ssh/known_hosts"],
  },
  editors: {
    name: "Editor Configuration",
    patterns: [".vimrc", ".vim/**", ".emacs", ".emacs.d/**"],
  },
  appConfigs: {
    name: "Application Configs",
    patterns: [".config/**/*.conf", ".config/**/*.toml", ".config/**/*.yml", ".config/**/*.yaml", ".config/**/*.json"],
  },
  dotfiles: {
    name: "Other Dotfiles",
    patterns: [".*rc", ".*profile"],
  },
};

/**
 * Scan home directory and categorize files for backup suggestions
 */
export async function scanHomeDirectory(options?: {
  maxDepth?: number;
  ignorePatterns?: string[];
}): Promise<FileStructure> {
  const homeDir = getHomeDir();
  const maxDepth = options?.maxDepth ?? 5;
  const ignorePatterns = options?.ignorePatterns ?? [
    "**/node_modules/**",
    "**/.git/**",
    "**/Library/**",
    "**/Downloads/**",
    "**/Desktop/**",
    "**/Documents/**",
    "**/Pictures/**",
    "**/Music/**",
    "**/Videos/**",
    "**/Movies/**",
    "**/.Trash/**",
    "**/.cache/**",
    "**/.npm/**",
    "**/.yarn/**",
  ];

  const categories: FileCategory[] = [];
  let totalFiles = 0;

  // Scan each category
  for (const [, category] of Object.entries(FILE_CATEGORIES)) {
    // Use relative patterns for glob with cwd
    const patterns = category.patterns;

    try {
      const files = await glob(patterns, {
        ignore: ignorePatterns,
        dot: true,
        onlyFiles: true,
        deep: maxDepth,
        absolute: false,
        cwd: homeDir,
      });

      // Filter out files that don't exist or can't be accessed
      const validFiles: string[] = [];
      for (const file of files) {
        try {
          const fullPath = join(homeDir, file);
          await stat(fullPath);
          validFiles.push(file);
        } catch {
          // Skip files that can't be accessed
          continue;
        }
      }

      if (validFiles.length > 0) {
        categories.push({
          category: category.name,
          files: validFiles.sort(),
        });
        totalFiles += validFiles.length;
      }
    } catch (error) {
      // Skip categories that fail to scan
      continue;
    }
  }

  return {
    homeDir,
    categories,
    totalFiles,
  };
}

/**
 * Convert file structure to JSON format for LLM prompt
 */
export function fileStructureToJSON(structure: FileStructure): string {
  return JSON.stringify(structure, null, 2);
}

/**
 * Get a list of recommended backup targets based on scan results
 */
export function getRecommendedTargets(structure: FileStructure): string[] {
  const targets: string[] = [];

  for (const category of structure.categories) {
    for (const file of category.files) {
      // Add ~ prefix for home directory relative paths
      targets.push(`~/${file}`);
    }
  }

  return targets;
}
