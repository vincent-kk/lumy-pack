import { map } from '@winglet/common-utils/array';
import { Box, Text } from 'ink';
import React from 'react';

import type { TraceNode } from '../types/index.js';

interface TraceResultProps {
  nodes: TraceNode[];
  warnings?: string[];
}

export function TraceResultView({
  nodes,
  warnings,
}: TraceResultProps): React.ReactElement {
  return (
    <Box flexDirection="column">
      {map(nodes, (node, i) => (
        <NodeRow key={i} node={node} />
      ))}
      {warnings && warnings.length > 0 && (
        <Box marginTop={1} flexDirection="column">
          {map(warnings, (w, i) => (
            <Text key={i} color="yellow">
              ⚠ {w}
            </Text>
          ))}
        </Box>
      )}
    </Box>
  );
}

function NodeRow({ node }: { node: TraceNode }): React.ReactElement {
  const sha = node.sha?.slice(0, 7) ?? '';

  switch (node.type) {
    case 'original_commit':
      return (
        <Text>
          <Text color="green">●</Text> Commit <Text color="cyan">{sha}</Text> [
          {node.confidence}]
        </Text>
      );
    case 'cosmetic_commit':
      return (
        <Text>
          <Text color="yellow">○</Text> Cosmetic <Text color="cyan">{sha}</Text>{' '}
          {node.note ?? ''}
        </Text>
      );
    case 'pull_request':
      return (
        <Text>
          <Text color="green">▸</Text> PR <Text bold>#{node.prNumber}</Text>{' '}
          {node.prTitle ?? ''}
        </Text>
      );
    case 'issue':
      return (
        <Text>
          <Text color="cyan">▹</Text> Issue #{node.issueNumber}{' '}
          {node.issueTitle ?? ''}
        </Text>
      );
    default:
      return (
        <Text>
          {' '}
          {node.type} {sha}
        </Text>
      );
  }
}
