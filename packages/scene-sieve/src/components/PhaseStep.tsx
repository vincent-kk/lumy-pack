import { Box, Text } from 'ink';
import Spinner from 'ink-spinner';
import React from 'react';

import { ProgressBar } from './ProgressBar.js';

export type PhaseStatus = 'pending' | 'running' | 'done' | 'failed';

export interface PhaseState {
  label: string;
  status: PhaseStatus;
  hasProgress: boolean;
  percent: number;
  durationMs?: number;
}

interface PhaseStepProps {
  phase: PhaseState;
}

export const PhaseStep: React.FC<PhaseStepProps> = ({ phase }) => {
  const icon = (() => {
    switch (phase.status) {
      case 'done':
        return <Text color="green">✓</Text>;
      case 'running':
        return (
          <Text color="yellow">
            <Spinner type="dots" />
          </Text>
        );
      case 'failed':
        return <Text color="red">✗</Text>;
      default:
        return <Text color="gray">○</Text>;
    }
  })();

  const duration =
    phase.status === 'done' && phase.durationMs !== undefined
      ? `Done (${Math.round(phase.durationMs / 1000)}s)`
      : '';

  return (
    <Box flexDirection="column">
      <Text>
        {'  '}
        {icon} {phase.label}
        {duration ? <Text color="gray">  {duration}</Text> : null}
      </Text>
      {phase.status === 'running' &&
        phase.hasProgress &&
        phase.percent > 0 && (
          <Text>
            {'      '}
            <ProgressBar percent={phase.percent} />
          </Text>
        )}
    </Box>
  );
};
