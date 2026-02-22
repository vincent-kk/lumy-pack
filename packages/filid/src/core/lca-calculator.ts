/**
 * @file lca-calculator.ts
 * @description Lowest Common Ancestor(최근접 공통 조상) 계산기.
 *
 * 프랙탈 트리에서 두 노드의 LCA를 계산하고 모듈 최적 배치 위치를 제안한다.
 * fractal-tree.getAncestors()를 내부적으로 활용한다.
 */

import type { FractalTree, FractalNode } from '../types/fractal.js';
import { getAncestors } from './fractal-tree.js';

/**
 * 노드에서 루트까지의 조상 경로 배열을 반환한다.
 * [nodePath, parent, grandparent, ..., root] 순서.
 *
 * @param tree - 탐색할 프랙탈 트리
 * @param nodePath - 시작 노드의 경로
 * @returns 경로 배열 (자신 포함)
 */
export function getAncestorPaths(tree: FractalTree, nodePath: string): string[] {
  if (!tree.nodes.has(nodePath)) return [];
  const ancestors = getAncestors(tree, nodePath);
  return [nodePath, ...ancestors.map((n) => n.path)];
}

/**
 * 두 노드의 Lowest Common Ancestor(LCA)를 반환한다.
 *
 * Naive parent traversal 알고리즘:
 * 1. pathA의 조상 집합을 구한다
 * 2. pathB의 조상 경로를 순회하며 집합에 있는 첫 번째 경로를 반환한다
 *
 * @param tree - 탐색할 프랙탈 트리
 * @param pathA - 첫 번째 노드의 경로
 * @param pathB - 두 번째 노드의 경로
 * @returns LCA 노드. 없으면 null
 */
export function findLCA(
  tree: FractalTree,
  pathA: string,
  pathB: string,
): FractalNode | null {
  if (!tree.nodes.has(pathA) || !tree.nodes.has(pathB)) return null;

  // 동일 노드인 경우
  if (pathA === pathB) return tree.nodes.get(pathA) ?? null;

  const ancestorsA = new Set(getAncestorPaths(tree, pathA));

  for (const ancestor of getAncestorPaths(tree, pathB)) {
    if (ancestorsA.has(ancestor)) {
      return tree.nodes.get(ancestor) ?? null;
    }
  }

  // fallback: 루트 반환
  return tree.nodes.get(tree.root) ?? null;
}

/**
 * 여러 의존 모듈을 분석하여 공유 코드를 배치할 최적 fractal 레벨을 제안한다.
 *
 * 모든 의존 모듈 쌍의 LCA 중 가장 깊은 것을 선택한다.
 *
 * @param tree - 탐색할 프랙탈 트리
 * @param dependencies - 배치 위치를 결정할 의존 모듈 경로 목록
 * @returns 최적 배치 정보 (suggestedParent 경로, confidence)
 */
export function getModulePlacement(
  tree: FractalTree,
  dependencies: string[],
): { suggestedParent: string; confidence: number } {
  if (dependencies.length === 0) {
    return { suggestedParent: tree.root, confidence: 0 };
  }

  if (dependencies.length === 1) {
    const node = tree.nodes.get(dependencies[0]);
    const parent = node?.parent ?? tree.root;
    return { suggestedParent: parent, confidence: 0.5 };
  }

  let deepestLCA: FractalNode | null = null;
  let maxDepth = -1;
  let pairCount = 0;
  let foundCount = 0;

  for (let i = 0; i < dependencies.length; i++) {
    for (let j = i + 1; j < dependencies.length; j++) {
      pairCount++;
      const lca = findLCA(tree, dependencies[i], dependencies[j]);
      if (lca) {
        foundCount++;
        if (lca.depth > maxDepth) {
          maxDepth = lca.depth;
          deepestLCA = lca;
        }
      }
    }
  }

  const suggestedParent = deepestLCA?.path ?? tree.root;
  const confidence = pairCount > 0 ? foundCount / pairCount : 0;

  return { suggestedParent, confidence };
}
