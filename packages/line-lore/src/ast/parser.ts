import { isNil } from '@winglet/common-utils';

import type { SymbolInfo, SymbolKind } from '../types/index.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let astGrep: any = null;
let loadAttempted = false;
let available = false;

const EXTENSION_TO_LANG: Record<string, string> = {
  '.ts': 'typescript',
  '.tsx': 'typescript',
  '.js': 'javascript',
  '.jsx': 'javascript',
  '.py': 'python',
  '.go': 'go',
  '.rs': 'rust',
  '.java': 'java',
  '.c': 'c',
  '.cpp': 'cpp',
  '.rb': 'ruby',
  '.swift': 'swift',
  '.kt': 'kotlin',
  '.cs': 'c_sharp',
};

const AST_GREP_MODULE = '@ast-grep/napi';

async function loadAstGrep(): Promise<boolean> {
  if (loadAttempted) return available;
  loadAttempted = true;
  try {
    astGrep = await import(/* webpackIgnore: true */ AST_GREP_MODULE);
    available = true;
  } catch {
    console.warn(
      '[line-lore] @ast-grep/napi not available. AST diff features disabled.',
    );
    available = false;
  }
  return available;
}

export function isAstAvailable(): boolean {
  return available;
}

export function detectLanguage(filePath: string): string | null {
  const ext = filePath.slice(filePath.lastIndexOf('.'));
  return EXTENSION_TO_LANG[ext] ?? null;
}

export async function parseFile(
  source: string,
  lang: string,
): Promise<unknown | null> {
  await loadAstGrep();
  if (!astGrep) return null;

  try {
    const sgLang = (astGrep as Record<string, unknown>).Lang as
      | Record<string, unknown>
      | undefined;
    if (!sgLang) return null;

    const langEnum =
      sgLang[lang] ?? sgLang[lang.charAt(0).toUpperCase() + lang.slice(1)];
    if (isNil(langEnum)) return null;

    const parse = (astGrep as Record<string, (...args: unknown[]) => unknown>)
      .parse;
    if (typeof parse !== 'function') return null;

    return parse(lang, source) ?? null;
  } catch {
    return null;
  }
}

export async function findSymbols(
  source: string,
  lang: string,
): Promise<SymbolInfo[]> {
  await loadAstGrep();
  if (!astGrep) return [];

  try {
    const { parse, Lang } = astGrep as Record<string, unknown> & {
      parse: (
        lang: unknown,
        source: string,
      ) => {
        root: () => {
          findAll: (pattern: { rule: unknown }) => Array<{
            text: () => string;
            range: () => { start: { line: number }; end: { line: number } };
            kind: () => string;
          }>;
        };
      };
      Lang: Record<string, unknown>;
    };

    const langEnum =
      Lang[lang] ?? Lang[lang.charAt(0).toUpperCase() + lang.slice(1)];
    if (isNil(langEnum)) return [];

    const root = parse(langEnum, source).root();
    const symbols: SymbolInfo[] = [];

    const kindPatterns: Array<{
      rule: { kind: string };
      symbolKind: SymbolKind;
    }> = [
      { rule: { kind: 'function_declaration' }, symbolKind: 'function' },
      { rule: { kind: 'arrow_function' }, symbolKind: 'arrow_function' },
      { rule: { kind: 'method_definition' }, symbolKind: 'method' },
      { rule: { kind: 'class_declaration' }, symbolKind: 'class' },
      { rule: { kind: 'function_item' }, symbolKind: 'function' },
      { rule: { kind: 'impl_item' }, symbolKind: 'class' },
    ];

    for (const { rule, symbolKind } of kindPatterns) {
      const nodes = root.findAll({ rule });
      for (const node of nodes) {
        const range = node.range();
        const nameNode = root.findAll({
          rule: { kind: 'identifier', inside: { kind: rule.kind } },
        });
        const name = nameNode.length > 0 ? nameNode[0].text() : 'anonymous';

        symbols.push({
          name,
          kind: symbolKind,
          startLine: range.start.line + 1,
          endLine: range.end.line + 1,
          bodyText: node.text(),
        });
      }
    }

    return symbols;
  } catch {
    return [];
  }
}

export function extractSymbolsFromText(
  source: string,
  lang: string,
): SymbolInfo[] {
  const symbols: SymbolInfo[] = [];
  const lines = source.split('\n');

  if (lang === 'typescript' || lang === 'javascript') {
    extractJsSymbols(lines, symbols);
  } else if (lang === 'python') {
    extractPythonSymbols(lines, symbols);
  }

  return symbols;
}

function extractJsSymbols(lines: string[], symbols: SymbolInfo[]): void {
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const funcMatch = /^(?:export\s+)?(?:async\s+)?function\s+(\w+)/.exec(line);
    if (funcMatch) {
      const endLine = findBlockEnd(lines, i);
      symbols.push({
        name: funcMatch[1],
        kind: 'function',
        startLine: i + 1,
        endLine: endLine + 1,
        bodyText: lines.slice(i, endLine + 1).join('\n'),
      });
      continue;
    }

    const arrowMatch =
      /^(?:export\s+)?(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?\(/.exec(
        line,
      );
    if (arrowMatch && (line.includes('=>') || lines[i + 1]?.includes('=>'))) {
      const endLine = findBlockEnd(lines, i);
      symbols.push({
        name: arrowMatch[1],
        kind: 'arrow_function',
        startLine: i + 1,
        endLine: endLine + 1,
        bodyText: lines.slice(i, endLine + 1).join('\n'),
      });
      continue;
    }

    const classMatch = /^(?:export\s+)?class\s+(\w+)/.exec(line);
    if (classMatch) {
      const endLine = findBlockEnd(lines, i);
      symbols.push({
        name: classMatch[1],
        kind: 'class',
        startLine: i + 1,
        endLine: endLine + 1,
        bodyText: lines.slice(i, endLine + 1).join('\n'),
      });
      continue;
    }

    const methodMatch = /^\s+(?:async\s+)?(\w+)\s*\(/.exec(line);
    if (
      methodMatch &&
      !line.includes('if') &&
      !line.includes('for') &&
      !line.includes('while')
    ) {
      const endLine = findBlockEnd(lines, i);
      if (endLine > i) {
        symbols.push({
          name: methodMatch[1],
          kind: 'method',
          startLine: i + 1,
          endLine: endLine + 1,
          bodyText: lines.slice(i, endLine + 1).join('\n'),
        });
      }
    }
  }
}

function extractPythonSymbols(lines: string[], symbols: SymbolInfo[]): void {
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const funcMatch = /^(?:async\s+)?def\s+(\w+)/.exec(line);
    if (funcMatch) {
      const endLine = findPythonBlockEnd(lines, i);
      symbols.push({
        name: funcMatch[1],
        kind: 'function',
        startLine: i + 1,
        endLine: endLine + 1,
        bodyText: lines.slice(i, endLine + 1).join('\n'),
      });
      continue;
    }

    const classMatch = /^class\s+(\w+)/.exec(line);
    if (classMatch) {
      const endLine = findPythonBlockEnd(lines, i);
      symbols.push({
        name: classMatch[1],
        kind: 'class',
        startLine: i + 1,
        endLine: endLine + 1,
        bodyText: lines.slice(i, endLine + 1).join('\n'),
      });
    }
  }
}

function findBlockEnd(lines: string[], startIdx: number): number {
  let depth = 0;
  let started = false;
  for (let i = startIdx; i < lines.length; i++) {
    for (const ch of lines[i]) {
      if (ch === '{') {
        depth++;
        started = true;
      }
      if (ch === '}') depth--;
    }
    if (started && depth === 0) return i;
  }
  return startIdx;
}

function findPythonBlockEnd(lines: string[], startIdx: number): number {
  const indent = lines[startIdx].search(/\S/);
  for (let i = startIdx + 1; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim() === '') continue;
    if (line.search(/\S/) <= indent) return i - 1;
  }
  return lines.length - 1;
}
