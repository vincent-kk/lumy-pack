/**
 * MCP tool handler: ast-grep-replace
 * Replace code patterns using AST matching.
 */
import { readFileSync, writeFileSync } from 'node:fs';

import {
  getFilesForLanguage,
  getSgLoadError,
  getSgModule,
  toLangEnum,
} from '../../ast/ast-grep-shared.js';

export interface AstGrepReplaceInput {
  /** Pattern to match */
  pattern: string;
  /** Replacement pattern (use same meta-variables) */
  replacement: string;
  /** Programming language */
  language: string;
  /** Directory or file to search (default: current directory) */
  path?: string;
  /** Preview only, don't apply changes (default: true) */
  dry_run?: boolean;
}

export interface AstGrepReplaceChange {
  file: string;
  before: string;
  after: string;
  line: number;
}

export interface AstGrepReplaceResult {
  changes: AstGrepReplaceChange[];
  totalReplacements: number;
  filesSearched: number;
  mode: string;
  pattern: string;
  replacement: string;
}

export interface AstGrepReplaceError {
  error: string;
  sgLoadError?: string;
}

/**
 * Handle ast-grep replace requests.
 * Returns a plain result object; MCP content wrapping is done in server.ts.
 */
export async function handleAstGrepReplace(
  args: AstGrepReplaceInput,
): Promise<
  | AstGrepReplaceResult
  | AstGrepReplaceError
  | { message: string; pattern: string; filesSearched: number }
> {
  const { pattern, replacement, language, path = '.', dry_run = true } = args;

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

    const changes: AstGrepReplaceChange[] = [];
    let totalReplacements = 0;

    for (const filePath of files) {
      try {
        const content = readFileSync(filePath, 'utf-8');
        const root = sg.parse(toLangEnum(sg, language), content).root();
        const matches = root.findAll(pattern);

        if (matches.length === 0) continue;

        // Collect all edits for this file
        const edits: {
          start: number;
          end: number;
          replacement: string;
          line: number;
          before: string;
        }[] = [];

        for (const match of matches) {
          const range = match.range();
          const startOffset = range.start.index;
          const endOffset = range.end.index;

          // Build replacement by substituting meta-variables
          let finalReplacement = replacement;

          // Get all captured meta-variables
          // ast-grep captures are accessed via match.getMatch() or by variable name
          // For simplicity, we'll use a basic approach here
          const matchedText = match.text();

          // Try to get named captures
          try {
            // Replace meta-variables in the replacement string
            const metaVars =
              replacement.match(/\$\$?\$?[A-Z_][A-Z0-9_]*/g) || [];
            for (const metaVar of metaVars) {
              const varName = metaVar.replace(/^\$+/, '');
              const captured = match.getMatch(varName);
              if (captured) {
                finalReplacement = finalReplacement.replace(
                  metaVar,
                  captured.text(),
                );
              }
            }
          } catch {
            // If meta-variable extraction fails, use pattern as-is
          }

          edits.push({
            start: startOffset,
            end: endOffset,
            replacement: finalReplacement,
            line: range.start.line + 1,
            before: matchedText,
          });
        }

        // Sort edits in reverse order to apply from end to start
        edits.sort((a, b) => b.start - a.start);

        let newContent = content;
        for (const edit of edits) {
          const before = newContent.slice(edit.start, edit.end);
          newContent =
            newContent.slice(0, edit.start) +
            edit.replacement +
            newContent.slice(edit.end);

          changes.push({
            file: filePath,
            before,
            after: edit.replacement,
            line: edit.line,
          });
          totalReplacements++;
        }

        if (!dry_run && edits.length > 0) {
          writeFileSync(filePath, newContent, 'utf-8');
        }
      } catch {
        // Skip files that fail to parse
      }
    }

    if (changes.length === 0) {
      return {
        message: `No matches found for pattern: ${pattern}\n\nSearched ${files.length} ${language} file(s) in ${path}`,
        pattern,
        filesSearched: files.length,
      };
    }

    const mode = dry_run ? 'DRY RUN (no changes applied)' : 'CHANGES APPLIED';

    return {
      changes,
      totalReplacements,
      filesSearched: files.length,
      mode,
      pattern,
      replacement,
    };
  } catch (error) {
    return {
      error: `Error in AST replace: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}
