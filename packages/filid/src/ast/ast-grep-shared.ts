/**
 * Shared utilities for ast-grep based AST analysis.
 *
 * Provides lazy-loaded @ast-grep/napi module, language mapping,
 * file discovery, and match formatting used by all ast modules.
 */
import { readdirSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { extname, join, resolve } from 'node:path';

// Dynamic import for @ast-grep/napi
// Graceful degradation: if the module is not available (e.g., in bundled/plugin context),
// tools will return a helpful error message instead of crashing
//
// IMPORTANT: Uses createRequire() (CJS resolution) instead of dynamic import() (ESM resolution)
// because ESM resolution does NOT respect NODE_PATH or Module._initPaths().
// In the MCP server plugin context, @ast-grep/napi is installed globally and resolved
// via NODE_PATH set in the bundle's startup banner.
import type * as AstGrepNapi from '@ast-grep/napi';

type SgModule = typeof AstGrepNapi;

let sgModule: SgModule | null = null;
let sgLoadFailed = false;
let sgLoadError = '';

export async function getSgModule(): Promise<SgModule | null> {
  if (sgLoadFailed) {
    return null;
  }
  if (!sgModule) {
    try {
      // Use createRequire for CJS-style resolution (respects NODE_PATH)
      const require = createRequire(import.meta.url || process.cwd() + '/');
      sgModule = require('@ast-grep/napi') as SgModule;
    } catch {
      // Fallback to dynamic import for pure ESM environments
      try {
        // @ts-ignore - optional dependency, may not be installed
        sgModule = await import('@ast-grep/napi');
      } catch (error) {
        sgLoadFailed = true;
        sgLoadError = error instanceof Error ? error.message : String(error);
        return null;
      }
    }
  }
  return sgModule;
}

export function getSgLoadError(): string {
  return sgLoadError;
}

/**
 * Convert lowercase language string to ast-grep Lang enum value
 */
export function toLangEnum(sg: SgModule, language: string): any {
  const langMap: Record<string, any> = {
    javascript: sg.Lang.JavaScript,
    typescript: sg.Lang.TypeScript,
    tsx: sg.Lang.Tsx,
    python: sg.Lang.Python,
    ruby: sg.Lang.Ruby,
    go: sg.Lang.Go,
    rust: sg.Lang.Rust,
    java: sg.Lang.Java,
    kotlin: sg.Lang.Kotlin,
    swift: sg.Lang.Swift,
    c: sg.Lang.C,
    cpp: sg.Lang.Cpp,
    csharp: sg.Lang.CSharp,
    html: sg.Lang.Html,
    css: sg.Lang.Css,
    json: sg.Lang.Json,
    yaml: sg.Lang.Yaml,
  };

  const lang = langMap[language];
  if (!lang) {
    throw new Error(`Unsupported language: ${language}`);
  }
  return lang;
}

/**
 * Supported languages for AST analysis
 * Maps to ast-grep language identifiers
 */
export const SUPPORTED_LANGUAGES: [string, ...string[]] = [
  'javascript',
  'typescript',
  'tsx',
  'python',
  'ruby',
  'go',
  'rust',
  'java',
  'kotlin',
  'swift',
  'c',
  'cpp',
  'csharp',
  'html',
  'css',
  'json',
  'yaml',
];

/**
 * Map file extensions to ast-grep language identifiers
 */
export const EXT_TO_LANG: Record<string, string> = {
  '.js': 'javascript',
  '.mjs': 'javascript',
  '.cjs': 'javascript',
  '.jsx': 'javascript',
  '.ts': 'typescript',
  '.mts': 'typescript',
  '.cts': 'typescript',
  '.tsx': 'tsx',
  '.py': 'python',
  '.rb': 'ruby',
  '.go': 'go',
  '.rs': 'rust',
  '.java': 'java',
  '.kt': 'kotlin',
  '.kts': 'kotlin',
  '.swift': 'swift',
  '.c': 'c',
  '.h': 'c',
  '.cpp': 'cpp',
  '.cc': 'cpp',
  '.cxx': 'cpp',
  '.hpp': 'cpp',
  '.cs': 'csharp',
  '.html': 'html',
  '.htm': 'html',
  '.css': 'css',
  '.json': 'json',
  '.yaml': 'yaml',
  '.yml': 'yaml',
};

/**
 * Get files matching the language in a directory
 */
export function getFilesForLanguage(
  dirPath: string,
  language: string,
  maxFiles = 1000,
): string[] {
  const files: string[] = [];
  const extensions = Object.entries(EXT_TO_LANG)
    .filter(([_, lang]) => lang === language)
    .map(([ext]) => ext);

  function walk(dir: string) {
    if (files.length >= maxFiles) return;

    try {
      const entries = readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (files.length >= maxFiles) return;

        const fullPath = join(dir, entry.name);

        // Skip common non-source directories
        if (entry.isDirectory()) {
          if (
            ![
              'node_modules',
              '.git',
              'dist',
              'build',
              '__pycache__',
              '.venv',
              'venv',
            ].includes(entry.name)
          ) {
            walk(fullPath);
          }
        } else if (entry.isFile()) {
          const ext = extname(entry.name).toLowerCase();
          if (extensions.includes(ext)) {
            files.push(fullPath);
          }
        }
      }
    } catch {
      // Ignore permission errors
    }
  }

  const resolvedPath = resolve(dirPath);
  const stat = statSync(resolvedPath);

  if (stat.isFile()) {
    return [resolvedPath];
  }

  walk(resolvedPath);
  return files;
}

/**
 * Format a match result for display
 */
export function formatMatch(
  filePath: string,
  _matchText: string,
  startLine: number,
  endLine: number,
  context: number,
  fileContent: string,
): string {
  const lines = fileContent.split('\n');
  const contextStart = Math.max(0, startLine - context - 1);
  const contextEnd = Math.min(lines.length, endLine + context);

  const contextLines = lines.slice(contextStart, contextEnd);
  const numberedLines = contextLines.map((line, i) => {
    const lineNum = contextStart + i + 1;
    const isMatch = lineNum >= startLine && lineNum <= endLine;
    const prefix = isMatch ? '>' : ' ';
    return `${prefix} ${lineNum.toString().padStart(4)}: ${line}`;
  });

  return `${filePath}:${startLine}\n${numberedLines.join('\n')}`;
}
