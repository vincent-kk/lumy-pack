import type {
  GraphResult,
  PlatformAdapter,
  TraceNode,
} from '../../types/index.js';

export interface GraphTraversalOptions {
  maxDepth?: number;
}

const DEFAULT_MAX_DEPTH = 2;

export async function traverseIssueGraph(
  adapter: PlatformAdapter,
  startType: 'pr' | 'issue',
  startNumber: number,
  options?: GraphTraversalOptions,
): Promise<GraphResult> {
  const maxDepth = options?.maxDepth ?? DEFAULT_MAX_DEPTH;
  const nodes: TraceNode[] = [];
  const edges: GraphResult['edges'] = [];
  const visited = new Set<string>();

  await traverse(adapter, startType, startNumber, 0, maxDepth, nodes, edges, visited);

  return { nodes, edges };
}

async function traverse(
  adapter: PlatformAdapter,
  type: 'pr' | 'issue',
  number: number,
  depth: number,
  maxDepth: number,
  nodes: TraceNode[],
  edges: GraphResult['edges'],
  visited: Set<string>,
): Promise<void> {
  const key = `${type}:${number}`;
  if (visited.has(key)) return;
  if (depth > maxDepth) return;
  visited.add(key);

  if (type === 'pr') {
    nodes.push({
      type: 'pull_request',
      trackingMethod: 'issue-link',
      confidence: 'exact',
      prNumber: number,
    });

    if (depth < maxDepth) {
      const linkedIssues = await adapter.getLinkedIssues(number);
      for (const issue of linkedIssues) {
        edges.push({
          from: `pr:${number}`,
          to: `issue:${issue.number}`,
          relation: 'closes',
        });
        await traverse(adapter, 'issue', issue.number, depth + 1, maxDepth, nodes, edges, visited);
      }
    }
  } else {
    nodes.push({
      type: 'issue',
      trackingMethod: 'issue-link',
      confidence: 'exact',
      issueNumber: number,
    });

    if (depth < maxDepth) {
      const linkedPRs = await adapter.getLinkedPRs(number);
      for (const pr of linkedPRs) {
        edges.push({
          from: `issue:${number}`,
          to: `pr:${pr.number}`,
          relation: 'referenced-by',
        });
        await traverse(adapter, 'pr', pr.number, depth + 1, maxDepth, nodes, edges, visited);
      }
    }
  }
}
