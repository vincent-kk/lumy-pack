/**
 * @file index-analyzer.ts
 * @description index.ts barrel 패턴 분석기.
 *
 * TypeScript AST 파싱 없이 정규식 기반으로 export 구문을 분석한다.
 * re-export, named export, default export, type export를 구분한다.
 */
import type { BarrelPattern, ModuleExportInfo } from '../types/fractal.js';

// 정규식 패턴
const RE_NAMED_REEXPORT = /^export\s+\{[^}]*\}\s+from\s+['"][^'"]+['"]/gm;
const RE_STAR_REEXPORT =
  /^export\s+\*\s+(?:as\s+\w+\s+)?from\s+['"][^'"]+['"]/gm;
const RE_TYPE_REEXPORT = /^export\s+type\s+\{[^}]*\}\s+from\s+['"][^'"]+['"]/gm;
const RE_NAMED_DECL =
  /^export\s+(?:const|function|class|interface|enum|abstract\s+class)\s+(\w+)/gm;
const RE_DEFAULT_EXPORT = /^export\s+default\s+/gm;
const RE_TYPE_DECL = /^export\s+type\s+(\w+)\s*[=<{]/gm;

// re-export 소스 경로 추출
const RE_FROM_SOURCE = /from\s+['"]([^'"]+)['"]/;
// named export 이름 추출
const RE_EXPORT_NAMES = /\{([^}]*)\}/;

/**
 * TypeScript/JavaScript 파일 내용에서 export 구문을 정규식으로 추출한다.
 *
 * @param content - 파일 내용 문자열
 * @returns 추출된 ModuleExportInfo 배열
 */
export function extractModuleExports(content: string): ModuleExportInfo[] {
  const exports: ModuleExportInfo[] = [];

  // 1. type re-export: export type { X } from './y'
  const typeReexportMatches = content.matchAll(RE_TYPE_REEXPORT);
  for (const match of typeReexportMatches) {
    const sourceMatch = RE_FROM_SOURCE.exec(match[0]);
    const namesMatch = RE_EXPORT_NAMES.exec(match[0]);
    const source = sourceMatch?.[1];
    if (namesMatch) {
      const names = namesMatch[1]
        .split(',')
        .map(
          (n) =>
            n
              .trim()
              .split(/\s+as\s+/)
              .pop()
              ?.trim() ?? '',
        )
        .filter(Boolean);
      for (const name of names) {
        exports.push({ name, kind: 're-export', source });
      }
    }
  }

  // 2. named re-export: export { X } from './y'
  // (type re-export와 겹치지 않도록 type 키워드 없는 것만)
  const namedReexportMatches = content.matchAll(RE_NAMED_REEXPORT);
  for (const match of namedReexportMatches) {
    // type re-export 제외
    if (/^export\s+type\s+\{/.test(match[0])) continue;
    const sourceMatch = RE_FROM_SOURCE.exec(match[0]);
    const namesMatch = RE_EXPORT_NAMES.exec(match[0]);
    const source = sourceMatch?.[1];
    if (namesMatch) {
      const names = namesMatch[1]
        .split(',')
        .map(
          (n) =>
            n
              .trim()
              .split(/\s+as\s+/)
              .pop()
              ?.trim() ?? '',
        )
        .filter(Boolean);
      for (const name of names) {
        exports.push({ name, kind: 're-export', source });
      }
    }
  }

  // 3. star re-export: export * from './y' or export * as ns from './y'
  const starReexportMatches = content.matchAll(RE_STAR_REEXPORT);
  for (const match of starReexportMatches) {
    const sourceMatch = RE_FROM_SOURCE.exec(match[0]);
    const source = sourceMatch?.[1];
    // 'as namespace' 형태 처리
    const asMatch = /export\s+\*\s+as\s+(\w+)/.exec(match[0]);
    const name = asMatch ? asMatch[1] : '*';
    exports.push({ name, kind: 're-export', source });
  }

  // 4. type declaration: export type X = ...
  const typeDeclMatches = content.matchAll(RE_TYPE_DECL);
  for (const match of typeDeclMatches) {
    exports.push({ name: match[1], kind: 'type' });
  }

  // 5. named declaration: export const/function/class/etc X
  const namedDeclMatches = content.matchAll(RE_NAMED_DECL);
  for (const match of namedDeclMatches) {
    exports.push({ name: match[1], kind: 'named' });
  }

  // 6. default export
  const defaultMatches = content.matchAll(RE_DEFAULT_EXPORT);
  for (const _match of defaultMatches) {
    exports.push({ name: 'default', kind: 'default' });
  }

  return exports;
}

/**
 * index.ts 파일 내용을 분석하여 BarrelPattern을 반환한다.
 *
 * barrel 패턴 기준:
 * - 모든 export가 re-export여야 한다
 * - 직접 선언(function, class, const 등)이 없어야 한다
 *
 * @param content - 파일 내용 문자열
 * @returns BarrelPattern 분석 결과
 */
export function analyzeIndex(content: string): BarrelPattern {
  const exports = extractModuleExports(content);

  const reExportCount = exports.filter((e) => e.kind === 're-export').length;
  const declarationCount = exports.filter(
    (e) => e.kind === 'named' || e.kind === 'default' || e.kind === 'type',
  ).length;

  const isPureBarrel = declarationCount === 0 && reExportCount > 0;

  return {
    isPureBarrel,
    reExportCount,
    declarationCount,
    missingExports: [],
  };
}
