/**
 * MCP tool handler: ast-grep-search
 * Search for code patterns using AST matching.
 */
import { readFileSync } from 'node:fs';

import {
  formatMatch,
  getFilesForLanguage,
  getSgLoadError,
  getSgModule,
  toLangEnum,
} from '../../ast/ast-grep-shared.js';

export interface AstGrepSearchInput {
  /** AST pattern with meta-variables ($VAR, $$$VARS) */
  pattern: string;
  /** Programming language */
  language: string;
  /** Directory or file to search (default: current directory) */
  path?: string;
  /** Lines of context around matches (default: 2) */
  context?: number;
  /** Maximum results to return (default: 20) */
  max_results?: number;
}

export interface AstGrepSearchResult {
  matches: string[];
  totalMatches: number;
  filesSearched: number;
  pattern: string;
}

export interface AstGrepSearchError {
  error: string;
  sgLoadError: string;
}

/**
 * Handle ast-grep search requests.
 * Returns a plain result object; MCP content wrapping is done in server.ts.
 */
export async function handleAstGrepSearch(
  args: AstGrepSearchInput,
): Promise<
  | AstGrepSearchResult
  | AstGrepSearchError
  | { message: string; pattern: string; filesSearched: number }
  | { error: string }
> {
  const { pattern, language, path = '.', context = 2, max_results = 20 } = args;

  try {
    const sg = await getSgModule();
    if (!sg) {
      return {
        error: `@ast-grep/napi is not available. Install it with: npm install -g @ast-grep/napi`,
        sgLoadError: getSgLoadError(),
      };
    }

    const files = getFilesForLanguage(path, language);

    if (files.length === 0) {
      return {
        message: `No ${language} files found in ${path}`,
        pattern,
        filesSearched: 0,
      };
    }

    const results: string[] = [];
    let totalMatches = 0;

    for (const filePath of files) {
      if (totalMatches >= max_results) break;

      try {
        const content = readFileSync(filePath, 'utf-8');
        const root = sg.parse(toLangEnum(sg, language), content).root();
        const matches = root.findAll(pattern);

        for (const match of matches) {
          if (totalMatches >= max_results) break;

          const range = match.range();
          const startLine = range.start.line + 1;
          const endLine = range.end.line + 1;

          results.push(
            formatMatch(
              filePath,
              match.text(),
              startLine,
              endLine,
              context,
              content,
            ),
          );
          totalMatches++;
        }
      } catch {
        // Skip files that fail to parse
      }
    }

    if (results.length === 0) {
      return {
        message: `No matches found for pattern: ${pattern}\n\nSearched ${files.length} ${language} file(s) in ${path}\n\nTip: Ensure the pattern is a valid AST node. For example:\n- Use "function $NAME" not just "$NAME"\n- Use "console.log($X)" not "console.log"`,
        pattern,
        filesSearched: files.length,
      };
    }

    return {
      matches: results,
      totalMatches,
      filesSearched: files.length,
      pattern,
    };
  } catch (error) {
    return {
      error: `Error in AST search: ${error instanceof Error ? error.message : String(error)}\n\nCommon issues:\n- Pattern must be a complete AST node\n- Language must match file type\n- Check that @ast-grep/napi is installed`,
    };
  }
}
