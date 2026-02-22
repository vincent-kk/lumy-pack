/**
 * @file category-classifier.ts
 * @description 파일 경로를 기반으로 프랙탈 카테고리를 분류하는 경량 유틸리티.
 *
 * organ-classifier의 구조 기반 분류 로직을 활용하여
 * 경로 세그먼트로부터 카테고리를 추론한다.
 */

import type { CategoryType } from '../types/fractal.js';
import { isOrganDirectory } from './organ-classifier.js';
import { existsSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';

/** 분류 결과 타입 (CategoryType + 'unclassified') */
export type ClassifiedCategory = CategoryType | 'unclassified' | 'unknown';

/**
 * 파일/디렉토리 경로를 분석하여 프랙탈 카테고리를 반환한다.
 *
 * 분류 우선순위:
 * 1. 부모 디렉토리에 CLAUDE.md 또는 SPEC.md가 있으면 → fractal
 * 2. organ 이름 세그먼트가 포함되면 → organ
 * 3. 경로에 pure-function 힌트가 있으면 → pure-function
 * 4. 판단 불가 → unclassified
 *
 * @param filePath - 분류할 파일 또는 디렉토리 경로 (절대 또는 cwd 기준 상대)
 * @param cwd - 현재 작업 디렉토리 (상대 경로 해석에 사용)
 * @returns ClassifiedCategory
 */
export function classify(filePath: string, cwd: string): ClassifiedCategory {
  try {
    const absPath = filePath.startsWith('/') ? filePath : resolve(cwd, filePath);
    const dir = absPath.endsWith('.ts') || absPath.endsWith('.js') || absPath.includes('.')
      ? dirname(absPath)
      : absPath;

    // 1. CLAUDE.md 또는 SPEC.md가 있으면 fractal
    if (existsSync(join(dir, 'CLAUDE.md')) || existsSync(join(dir, 'SPEC.md'))) {
      return 'fractal';
    }

    // 2. 경로 세그먼트 기반 분류
    const normalized = absPath.replace(/\\/g, '/');
    const segments = normalized.split('/').filter(Boolean);

    for (const segment of segments) {
      if (isOrganDirectory(segment)) {
        return 'organ';
      }
    }

    // 3. pure-function 힌트 (경로에 'pure', 'utils', 'helpers' 포함)
    const pureFunctionHints = ['pure-function', 'pure_function'];
    for (const segment of segments) {
      if (pureFunctionHints.includes(segment.toLowerCase())) {
        return 'pure-function';
      }
    }

    // 4. 판단 불가
    return 'unclassified';
  } catch {
    return 'unknown';
  }
}
