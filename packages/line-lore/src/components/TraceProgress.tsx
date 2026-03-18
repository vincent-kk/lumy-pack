import React from 'react';
import { Text, Box } from 'ink';
import Spinner from 'ink-spinner';

interface TraceProgressProps {
  stage: string;
  detail?: string;
}

export function TraceProgress({ stage, detail }: TraceProgressProps): React.ReactElement {
  return (
    <Box>
      <Text color="green">
        <Spinner type="dots" />
      </Text>
      <Text> {stage}</Text>
      {detail && <Text color="gray"> — {detail}</Text>}
    </Box>
  );
}
