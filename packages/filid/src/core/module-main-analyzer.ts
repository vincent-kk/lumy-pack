/**
 * @file module-main-analyzer.ts
 * @description 모듈 진입점 탐색 및 public API 추출기.
 *
 * 모듈 디렉토리의 진입점을 탐색하고 public API를 추출한다.
 * index-analyzer를 활용하여 barrel export를 분석한다.
 */
import { access, readFile, readdir } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';

import type {
  ModuleExportInfo,
  ModuleInfo,
  PublicApi,
} from '../types/fractal.js';

import { extractModuleExports } from './index-analyzer.js';

const ENTRY_CANDIDATES = [
  'index.ts',
  'index.js',
  'main.ts',
  'main.js',
] as const;

const RE_IMPORT =
  /^(?:import|export)\s+(?:type\s+)?(?:\{[^}]*\}|\*(?:\s+as\s+\w+)?|\w+(?:\s*,\s*\{[^}]*\})?)\s+from\s+['"]([^'"]+)['"]/gm;
const RE_DYNAMIC_IMPORT = /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/gm;
const RE_REQUIRE = /\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/gm;

/**
 * 파일 존재 여부 확인
 */
async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * 모듈 디렉토리에서 진입점 파일을 탐색한다.
 *
 * 탐색 순서:
 * 1. index.ts
 * 2. index.js
 * 3. main.ts
 * 4. main.js
 * 5. 디렉토리 내 유일한 .ts 파일 (여러 개이면 null)
 *
 * @param modulePath - 탐색할 디렉토리의 절대 경로
 * @returns 진입점 파일의 절대 경로 또는 null
 */
export async function findEntryPoint(
  modulePath: string,
): Promise<string | null> {
  // 1. 후보 파일을 순서대로 확인
  for (const candidate of ENTRY_CANDIDATES) {
    const full = join(modulePath, candidate);
    if (await fileExists(full)) return full;
  }

  // 2. 디렉토리 내 .ts 파일이 하나뿐이면 그것이 진입점
  try {
    const entries = await readdir(modulePath, { withFileTypes: true });
    const tsFiles = entries
      .filter(
        (e) =>
          e.isFile() && e.name.endsWith('.ts') && !e.name.endsWith('.d.ts'),
      )
      .map((e) => e.name);
    if (tsFiles.length === 1) {
      return join(modulePath, tsFiles[0]);
    }
  } catch {
    // 디렉토리 읽기 실패
  }

  return null;
}

/**
 * TypeScript 파일에서 import 경로를 추출한다.
 * 정규식 기반 (AST 파싱 없음).
 *
 * @param filePath - 분석할 파일의 절대 경로
 * @returns import 경로 목록 (상대 경로 그대로)
 */
export async function extractImports(filePath: string): Promise<string[]> {
  let content: string;
  try {
    content = await readFile(filePath, 'utf-8');
  } catch {
    return [];
  }

  const paths = new Set<string>();

  for (const pattern of [RE_IMPORT, RE_DYNAMIC_IMPORT, RE_REQUIRE]) {
    const regex = new RegExp(pattern.source, pattern.flags);
    const matches = content.matchAll(regex);
    for (const match of matches) {
      const importPath = match[1];
      if (importPath) paths.add(importPath);
    }
  }

  return [...paths];
}

/**
 * 진입점 파일을 분석하여 외부 공개 API를 추출한다.
 *
 * @param entryPoint - 진입점 파일의 절대 경로
 * @returns 공개 API (exports, types, functions, classes)
 */
export async function extractPublicApi(entryPoint: string): Promise<PublicApi> {
  let content: string;
  try {
    content = await readFile(entryPoint, 'utf-8');
  } catch {
    return { exports: [], types: [], functions: [], classes: [] };
  }

  const exports: ModuleExportInfo[] = extractModuleExports(content);

  const types: string[] = [];
  const functions: string[] = [];
  const classes: string[] = [];

  // named export를 분류 (type, function, class)
  const RE_FUNC_EXPORT = /^export\s+(?:async\s+)?function\s+(\w+)/gm;
  const RE_CLASS_EXPORT = /^export\s+(?:abstract\s+)?class\s+(\w+)/gm;
  const RE_TYPE_ALIAS = /^export\s+type\s+(\w+)\s*[=<{]/gm;
  const RE_INTERFACE = /^export\s+interface\s+(\w+)/gm;

  for (const match of content.matchAll(RE_FUNC_EXPORT)) {
    functions.push(match[1]);
  }
  for (const match of content.matchAll(RE_CLASS_EXPORT)) {
    classes.push(match[1]);
  }
  for (const match of content.matchAll(RE_TYPE_ALIAS)) {
    types.push(match[1]);
  }
  for (const match of content.matchAll(RE_INTERFACE)) {
    types.push(match[1]);
  }

  return {
    exports,
    types: [...new Set(types)],
    functions: [...new Set(functions)],
    classes: [...new Set(classes)],
  };
}

/**
 * 모듈 디렉토리를 분석하여 ModuleInfo를 반환한다.
 *
 * @param modulePath - 모듈 디렉토리의 절대 경로
 * @returns 모듈 정보 (진입점, exports, imports, dependencies)
 */
export async function analyzeModule(modulePath: string): Promise<ModuleInfo> {
  const absPath = resolve(modulePath);
  const name = absPath.split('/').pop() ?? absPath;

  const entryPoint = await findEntryPoint(absPath);

  if (!entryPoint) {
    return {
      path: absPath,
      name,
      entryPoint: null,
      exports: [],
      imports: [],
      dependencies: [],
    };
  }

  const [publicApi, rawImports] = await Promise.all([
    extractPublicApi(entryPoint),
    extractImports(entryPoint),
  ]);

  const exportNames = publicApi.exports.map((e) => e.name);

  // import 경로를 절대 경로로 변환 (상대 경로만, node_modules 제외)
  const entryDir = dirname(entryPoint);
  const dependencies: string[] = [];
  const resolvedImports: string[] = [];

  for (const importPath of rawImports) {
    if (importPath.startsWith('.')) {
      // 상대 경로 → 절대 경로
      const resolved = resolve(entryDir, importPath);
      resolvedImports.push(resolved);
      dependencies.push(resolved);
    } else {
      // 외부 패키지는 imports에만 포함
      resolvedImports.push(importPath);
    }
  }

  return {
    path: absPath,
    name,
    entryPoint,
    exports: exportNames,
    imports: resolvedImports,
    dependencies,
  };
}
