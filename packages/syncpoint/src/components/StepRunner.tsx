import React from "react";
import { Text, Box } from "ink";
import Spinner from "ink-spinner";

import type { StepResult } from "../utils/types.js";

interface StepRunnerProps {
  steps: StepResult[];
  currentStep: number;
  total: number;
}

const StepIcon: React.FC<{ status: StepResult["status"] }> = ({ status }) => {
  switch (status) {
    case "success":
      return <Text color="green">✓</Text>;
    case "running":
      return (
        <Text color="yellow">
          <Spinner type="dots" />
        </Text>
      );
    case "skipped":
      return <Text color="blue">⏭</Text>;
    case "failed":
      return <Text color="red">✗</Text>;
    case "pending":
    default:
      return <Text color="gray">○</Text>;
  }
};

const StepStatusText: React.FC<{ step: StepResult }> = ({ step }) => {
  switch (step.status) {
    case "success":
      return (
        <Text color="green">
          Done{step.duration != null ? ` (${Math.round(step.duration / 1000)}s)` : ""}
        </Text>
      );
    case "running":
      return <Text color="yellow">Running...</Text>;
    case "skipped":
      return <Text color="blue">Skipped (already installed)</Text>;
    case "failed":
      return <Text color="red">Failed{step.error ? `: ${step.error}` : ""}</Text>;
    case "pending":
    default:
      return null;
  }
};

export const StepRunner: React.FC<StepRunnerProps> = ({
  steps,
  total,
}) => {
  return (
    <Box flexDirection="column">
      {steps.map((step, idx) => (
        <Box key={idx} flexDirection="column" marginBottom={idx < steps.length - 1 ? 1 : 0}>
          <Text>
            {"  "}
            <StepIcon status={step.status} />
            <Text>
              {" "}
              <Text bold>
                Step {idx + 1}/{total}
              </Text>
              {"  "}
              {step.name}
            </Text>
          </Text>
          {step.output && step.status !== "pending" && (
            <Text color="gray">{"            "}{step.output}</Text>
          )}
          <Text>
            {"            "}
            <StepStatusText step={step} />
          </Text>
        </Box>
      ))}
    </Box>
  );
};
