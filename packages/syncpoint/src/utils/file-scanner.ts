import { stat } from 'node:fs/promises';
import { join } from 'node:path';

import glob from 'fast-glob';

import { getHomeDir } from './paths.js';

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
    name: 'Shell Configuration',
    patterns: ['.zshrc', '.bashrc', '.bash_profile', '.profile', '.zprofile'],
  },
  git: {
    name: 'Git Configuration',
    patterns: ['.gitconfig', '.gitignore_global', '.git-credentials'],
  },
  ssh: {
    name: 'SSH Configuration',
    patterns: ['.ssh/config', '.ssh/known_hosts'],
  },
  editors: {
    name: 'Editor Configuration',
    patterns: ['.vimrc', '.vim/**', '.emacs', '.emacs.d/**'],
  },
  terminal: {
    name: 'Terminal & Multiplexer',
    patterns: ['.tmux.conf', '.tmux/**', '.screenrc', '.alacritty.yml'],
  },
  appConfigs: {
    name: 'Application Configs',
    patterns: [
      '.config/**/*.conf',
      '.config/**/*.toml',
      '.config/**/*.yml',
      '.config/**/*.yaml',
      '.config/**/*.json',
    ],
  },
  dotfiles: {
    name: 'Other Dotfiles',
    patterns: ['.*rc', '.*profile', '.*.conf'],
  },
};

/**
 * Scan home directory and categorize files for backup suggestions
 */
export async function scanHomeDirectory(options?: {
  maxDepth?: number;
  maxFiles?: number;
  ignorePatterns?: string[];
}): Promise<FileStructure> {
  const homeDir = getHomeDir();
  const maxDepth = options?.maxDepth ?? 3;
  const maxFiles = options?.maxFiles ?? 500;
  const ignorePatterns = options?.ignorePatterns ?? [
    '**/node_modules/**',
    '**/.git/**',
    '**/Library/**',
    '**/Downloads/**',
    '**/Desktop/**',
    '**/Documents/**',
    '**/Pictures/**',
    '**/Music/**',
    '**/Videos/**',
    '**/Movies/**',
    '**/.Trash/**',
    '**/.cache/**',
    '**/.npm/**',
    '**/.yarn/**',
    '**/.vscode-server/**',
    '**/.*_history',
    '**/.local/share/**',
  ];

  const categories: FileCategory[] = [];
  const categorizedFiles = new Set<string>();
  let totalFiles = 0;

  // Step 1: Scan defined categories
  for (const [, category] of Object.entries(FILE_CATEGORIES)) {
    const patterns = category.patterns;

    try {
      const files = await glob(patterns, {
        ignore: ignorePatterns,
        dot: true,
        onlyFiles: true,
        deep: maxDepth,
        absolute: false,
        cwd: homeDir,
        suppressErrors: true,
      });

      const validFiles: string[] = [];
      for (const file of files) {
        try {
          const fullPath = join(homeDir, file);
          await stat(fullPath);
          validFiles.push(file);
          categorizedFiles.add(file);
        } catch {
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
    } catch {
      continue;
    }
  }

  // Step 2: Full scan for remaining files
  if (totalFiles < maxFiles) {
    try {
      const allFiles = await glob(['**/*', '**/.*'], {
        ignore: ignorePatterns,
        dot: true,
        onlyFiles: true,
        deep: maxDepth,
        absolute: false,
        cwd: homeDir,
        suppressErrors: true,
      });

      const uncategorizedFiles: string[] = [];
      for (const file of allFiles) {
        // Skip if already categorized
        if (categorizedFiles.has(file)) continue;

        // Limit total files
        if (totalFiles >= maxFiles) break;

        try {
          const fullPath = join(homeDir, file);
          await stat(fullPath);
          uncategorizedFiles.push(file);
          totalFiles++;
        } catch {
          continue;
        }
      }

      if (uncategorizedFiles.length > 0) {
        categories.push({
          category: 'Other Files',
          files: uncategorizedFiles.sort(),
        });
      }
    } catch {
      // Full scan failed, continue with categorized files only
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
