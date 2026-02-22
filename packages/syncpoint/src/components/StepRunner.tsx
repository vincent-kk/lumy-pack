import { Box, Static, Text } from 'ink';
import Spinner from 'ink-spinner';
import React from 'react';

import type { StepResult } from '../utils/types.js';

interface StepRunnerProps {
  steps: StepResult[];
  currentStep: number;
  total: number;
}

const StepIcon: React.FC<{ status: StepResult['status'] }> = ({ status }) => {
  switch (status) {
    case 'success':
      return <Text color="green">✓</Text>;
    case 'running':
      return (
        <Text color="yellow">
          <Spinner type="dots" />
        </Text>
      );
    case 'skipped':
      return <Text color="blue">⏭</Text>;
    case 'failed':
      return <Text color="red">✗</Text>;
    case 'pending':
    default:
      return <Text color="gray">○</Text>;
  }
};

const StepStatusText: React.FC<{ step: StepResult }> = ({ step }) => {
  switch (step.status) {
    case 'success':
      return (
        <Text color="green">
          Done
          {step.duration != null
            ? ` (${Math.round(step.duration / 1000)}s)`
            : ''}
        </Text>
      );
    case 'running':
      return <Text color="yellow">Running...</Text>;
    case 'skipped':
      return <Text color="blue">Skipped (already installed)</Text>;
    case 'failed':
      return (
        <Text color="red">Failed{step.error ? `: ${step.error}` : ''}</Text>
      );
    case 'pending':
    default:
      return null;
  }
};

interface StepItemViewProps {
  step: StepResult;
  index: number;
  total: number;
  isLast: boolean;
}

const StepItemView: React.FC<StepItemViewProps> = ({
  step,
  index,
  total,
  isLast,
}) => (
  <Box flexDirection="column" marginBottom={isLast ? 0 : 1}>
    <Text>
      {'  '}
      <StepIcon status={step.status} />
      <Text>
        {' '}
        <Text bold>
          Step {index + 1}/{total}
        </Text>
        {'  '}
        {step.name}
      </Text>
    </Text>
    {step.output && step.status !== 'pending' && (
      <Text color="gray">
        {'            '}
        {step.output}
      </Text>
    )}
    <Text>
      {'            '}
      <StepStatusText step={step} />
    </Text>
  </Box>
);

type IndexedStep = StepResult & { idx: number };

export const StepRunner: React.FC<StepRunnerProps> = ({ steps, total }) => {
  const completedSteps: IndexedStep[] = [];
  const activeSteps: IndexedStep[] = [];

  steps.forEach((step, idx) => {
    const indexed = { ...step, idx };
    if (
      step.status === 'success' ||
      step.status === 'failed' ||
      step.status === 'skipped'
    ) {
      completedSteps.push(indexed);
    } else {
      activeSteps.push(indexed);
    }
  });

  const lastIdx = steps.length - 1;

  return (
    <Box flexDirection="column">
      <Static items={completedSteps}>
        {(item) => (
          <StepItemView
            key={item.idx}
            step={item}
            index={item.idx}
            total={total}
            isLast={item.idx === lastIdx && activeSteps.length === 0}
          />
        )}
      </Static>
      {activeSteps.map((item) => (
        <StepItemView
          key={item.idx}
          step={item}
          index={item.idx}
          total={total}
          isLast={item.idx === lastIdx}
        />
      ))}
    </Box>
  );
};
