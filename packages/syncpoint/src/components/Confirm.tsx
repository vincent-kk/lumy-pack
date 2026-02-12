import { Text, useInput } from 'ink';
import React, { useState } from 'react';

interface ConfirmProps {
  message: string;
  onConfirm: (yes: boolean) => void;
  defaultYes?: boolean;
}

export const Confirm: React.FC<ConfirmProps> = ({
  message,
  onConfirm,
  defaultYes = true,
}) => {
  const [answered, setAnswered] = useState(false);

  useInput((input, key) => {
    if (answered) return;
    if (input === 'y' || input === 'Y') {
      setAnswered(true);
      onConfirm(true);
    } else if (input === 'n' || input === 'N') {
      setAnswered(true);
      onConfirm(false);
    } else if (key.return) {
      setAnswered(true);
      onConfirm(defaultYes);
    }
  });

  const yText = defaultYes ? <Text bold>Y</Text> : <Text dimColor>y</Text>;
  const nText = defaultYes ? <Text dimColor>n</Text> : <Text bold>N</Text>;

  return (
    <Text>
      <Text color="cyan">? </Text>
      {message} <Text color="gray">[</Text>
      {yText}
      <Text color="gray">/</Text>
      {nText}
      <Text color="gray">]</Text>
    </Text>
  );
};
