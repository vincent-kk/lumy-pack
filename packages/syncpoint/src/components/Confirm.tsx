import React, { useState } from "react";
import { Text, useInput } from "ink";

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
    if (input === "y" || input === "Y") {
      setAnswered(true);
      onConfirm(true);
    } else if (input === "n" || input === "N") {
      setAnswered(true);
      onConfirm(false);
    } else if (key.return) {
      setAnswered(true);
      onConfirm(defaultYes);
    }
  });

  const hint = defaultYes ? "[Y/n]" : "[y/N]";
  return (
    <Text>
      {message}{" "}
      <Text color="gray">{hint}</Text>
    </Text>
  );
};
