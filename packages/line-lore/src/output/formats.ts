import pc from 'picocolors';

import type { TraceFullResult } from '../core/core.js';
import type { TraceNode } from '../types/index.js';

export function formatHuman(result: TraceFullResult): string {
  const lines: string[] = [];

  for (const node of result.nodes) {
    lines.push(formatNodeHuman(node));
  }

  if (result.warnings.length > 0) {
    lines.push('');
    for (const warning of result.warnings) {
      lines.push(pc.yellow(`⚠ ${warning}`));
    }
  }

  return lines.join('\n');
}

export function formatJson(result: TraceFullResult): string {
  return JSON.stringify(result, null, 2);
}

export function formatLlm(result: TraceFullResult): string {
  const { createSuccessResponse } =
    require('./normalizer.js') as typeof import('./normalizer.js');
  const response = createSuccessResponse(
    'trace',
    result,
    result.operatingLevel,
    {
      warnings: result.warnings.length > 0 ? result.warnings : undefined,
    },
  );
  return JSON.stringify(response);
}

export function formatQuiet(result: TraceFullResult): string {
  const prNode = result.nodes.find((n) => n.type === 'pull_request');
  if (prNode?.prNumber) return String(prNode.prNumber);
  const commitNode = result.nodes.find(
    (n) => n.type === 'original_commit' || n.type === 'cosmetic_commit',
  );
  return commitNode?.sha?.slice(0, 7) ?? '';
}

function formatNodeHuman(node: TraceNode): string {
  const sha = node.sha ? pc.cyan(node.sha.slice(0, 7)) : '';
  const confidence = pc.dim(`[${node.confidence}]`);

  switch (node.type) {
    case 'original_commit':
      return `${pc.green('●')} Commit ${sha} ${confidence} via ${node.trackingMethod}`;
    case 'cosmetic_commit':
      return `${pc.yellow('○')} Cosmetic ${sha} ${confidence} ${node.note ? pc.dim(node.note) : ''}`;
    case 'merge_commit':
      return `${pc.blue('◆')} Merge ${sha}`;
    case 'rebased_commit':
      return `${pc.magenta('◇')} Rebased ${sha} → ${node.patchId ? pc.dim(`patch-id: ${node.patchId.slice(0, 7)}`) : ''}`;
    case 'pull_request':
      return `${pc.green('▸')} PR #${pc.bold(String(node.prNumber))} ${node.prTitle ? pc.white(node.prTitle) : ''} ${node.prUrl ? pc.dim(node.prUrl) : ''}`;
    case 'issue':
      return `${pc.cyan('▹')} Issue #${node.issueNumber} ${node.issueTitle ?? ''}`;
    default:
      return `  ${node.type} ${sha}`;
  }
}
