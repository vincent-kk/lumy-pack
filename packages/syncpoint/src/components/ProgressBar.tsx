import { Text } from 'ink';
import React from 'react';

interface ProgressBarProps {
  percent: number;
  width?: number;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  percent,
  width = 30,
}) => {
  const clamped = Math.max(0, Math.min(100, percent));
  const filled = Math.round(width * (clamped / 100));
  const empty = width - filled;
  return (
    <Text>
      <Text color="green">{'█'.repeat(filled)}</Text>
      <Text color="gray">{'░'.repeat(empty)}</Text>
      <Text> {clamped}%</Text>
    </Text>
  );
};
