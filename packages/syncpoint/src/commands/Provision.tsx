import React, { useState, useEffect } from "react";
import { Text, Box, useApp } from "ink";
import { Command } from "commander";
import { render } from "ink";

import type {
  TemplateConfig,
  StepResult,
  ProvisionOptions,
} from "../utils/types.js";
import { loadTemplate, listTemplates } from "../core/provision.js";
import { runProvision } from "../core/provision.js";
import { StepRunner } from "../components/StepRunner.js";

type Phase = "loading" | "running" | "done" | "error";

interface ProvisionViewProps {
  templateName: string;
  options: ProvisionOptions;
}

const ProvisionView: React.FC<ProvisionViewProps> = ({
  templateName,
  options,
}) => {
  const { exit } = useApp();
  const [phase, setPhase] = useState<Phase>("loading");
  const [template, setTemplate] = useState<TemplateConfig | null>(null);
  const [, setTemplatePath] = useState<string>("");
  const [steps, setSteps] = useState<StepResult[]>([]);
  const [currentStep, setCurrentStep] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Load template
  useEffect(() => {
    (async () => {
      try {
        // Find template by name
        const templates = await listTemplates();
        const match = templates.find(
          (t) =>
            t.name === templateName ||
            t.name === `${templateName}.yml` ||
            t.config.name === templateName,
        );

        if (!match) {
          setError(`템플릿을 찾을 수 없습니다: ${templateName}`);
          setPhase("error");
          exit();
          return;
        }

        const tmpl = await loadTemplate(match.path);
        setTemplate(tmpl);
        setTemplatePath(match.path);

        // Initialize step states
        const initialSteps: StepResult[] = tmpl.steps.map((s) => ({
          name: s.name,
          status: "pending" as const,
          output: s.description,
        }));
        setSteps(initialSteps);

        if (options.dryRun) {
          setPhase("done");
          setTimeout(() => exit(), 100);
          return;
        }

        // Phase 2: Run provision
        setPhase("running");

        const generator = runProvision(match.path, options);
        let stepIdx = 0;

        for await (const result of generator) {
          setCurrentStep(stepIdx);
          setSteps((prev) => {
            const updated = [...prev];
            updated[stepIdx] = result;
            return updated;
          });
          if (
            result.status === "success" ||
            result.status === "skipped" ||
            result.status === "failed"
          ) {
            stepIdx++;
          }
        }

        setPhase("done");
        setTimeout(() => exit(), 100);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
        setPhase("error");
        exit();
      }
    })();
  }, []);

  if (phase === "error" || error) {
    return (
      <Box flexDirection="column">
        <Text color="red">✗ {error}</Text>
      </Box>
    );
  }

  const successCount = steps.filter((s) => s.status === "success").length;
  const skippedCount = steps.filter((s) => s.status === "skipped").length;
  const failedCount = steps.filter((s) => s.status === "failed").length;

  return (
    <Box flexDirection="column">
      {/* Template header */}
      {template && (
        <Box flexDirection="column" marginBottom={1}>
          <Text bold>▸ {template.name}</Text>
          {template.description && (
            <Text color="gray">{"  "}{template.description}</Text>
          )}
        </Box>
      )}

      {/* Dry-run notice */}
      {options.dryRun && phase === "done" && template && (
        <Box flexDirection="column">
          <Text color="yellow">
            (dry-run) 실행 계획만 표시합니다
          </Text>
          <Box flexDirection="column" marginTop={1}>
            {template.steps.map((step, idx) => (
              <Box key={idx} flexDirection="column" marginBottom={1}>
                <Text>
                  {"  "}
                  <Text bold>
                    Step {idx + 1}/{template.steps.length}
                  </Text>
                  {"  "}
                  {step.name}
                </Text>
                {step.description && (
                  <Text color="gray">{"            "}{step.description}</Text>
                )}
                {step.skip_if && (
                  <Text color="blue">
                    {"            "}건너뜀 조건: {step.skip_if}
                  </Text>
                )}
              </Box>
            ))}
          </Box>
        </Box>
      )}

      {/* Step execution */}
      {(phase === "running" || (phase === "done" && !options.dryRun)) &&
        template && (
          <StepRunner
            steps={steps}
            currentStep={currentStep}
            total={template.steps.length}
          />
        )}

      {/* Summary */}
      {phase === "done" && !options.dryRun && template && (
        <Box flexDirection="column" marginTop={1}>
          <Text color="gray">{"  "}────────────────────</Text>
          <Text>
            {"  "}결과: <Text color="green">{successCount} 성공</Text> ·{" "}
            <Text color="blue">{skippedCount} 건너뜀</Text> ·{" "}
            <Text color="red">{failedCount} 실패</Text>
          </Text>

          {template.backup && !options.skipRestore && (
            <Box flexDirection="column" marginTop={1}>
              <Text bold>
                ▸ 설정파일 복원을 진행합니다...
              </Text>
              <Text color="gray">
                {"  "}백업 연동: {template.backup}
              </Text>
            </Box>
          )}
        </Box>
      )}
    </Box>
  );
};

export function registerProvisionCommand(program: Command): void {
  program
    .command("provision <template>")
    .description("템플릿 기반 머신 프로비저닝 실행")
    .option("--dry-run", "실행 없이 계획만 표시", false)
    .option("--skip-restore", "템플릿 완료 후 자동 복원 건너뛰기", false)
    .action(
      async (
        template: string,
        opts: { dryRun: boolean; skipRestore: boolean },
      ) => {
        const { waitUntilExit } = render(
          <ProvisionView
            templateName={template}
            options={{
              dryRun: opts.dryRun,
              skipRestore: opts.skipRestore,
            }}
          />,
        );
        await waitUntilExit();
      },
    );
}
