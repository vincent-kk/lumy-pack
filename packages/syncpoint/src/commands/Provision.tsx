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
import { ensureSudo } from "../utils/sudo.js";
import { StepRunner } from "../components/StepRunner.js";

type Phase = "running" | "done" | "error";

interface ProvisionViewProps {
  template: TemplateConfig;
  templatePath: string;
  options: ProvisionOptions;
}

const ProvisionView: React.FC<ProvisionViewProps> = ({
  template,
  templatePath,
  options,
}) => {
  const { exit } = useApp();
  const [phase, setPhase] = useState<Phase>(options.dryRun ? "done" : "running");
  const [steps, setSteps] = useState<StepResult[]>(
    template.steps.map((s) => ({
      name: s.name,
      status: "pending" as const,
      output: s.description,
    })),
  );
  const [currentStep, setCurrentStep] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (options.dryRun) {
      setTimeout(() => exit(), 100);
      return;
    }

    (async () => {
      try {
        const generator = runProvision(templatePath, options);
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
      <Box flexDirection="column" marginBottom={1}>
        <Text bold>▸ {template.name}</Text>
        {template.description && (
          <Text color="gray">{"  "}{template.description}</Text>
        )}
      </Box>

      {/* Dry-run notice */}
      {options.dryRun && phase === "done" && (
        <Box flexDirection="column">
          <Text color="yellow">
            (dry-run) Showing execution plan only
          </Text>
          {template.sudo && (
            <Text color="yellow">
              {"  "}⚠ This template requires sudo privileges (will prompt on actual run)
            </Text>
          )}
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
                    {"            "}Skip condition: {step.skip_if}
                  </Text>
                )}
              </Box>
            ))}
          </Box>
        </Box>
      )}

      {/* Step execution */}
      {(phase === "running" || (phase === "done" && !options.dryRun)) && (
        <StepRunner
          steps={steps}
          currentStep={currentStep}
          total={template.steps.length}
        />
      )}

      {/* Summary */}
      {phase === "done" && !options.dryRun && (
        <Box flexDirection="column" marginTop={1}>
          <Text color="gray">{"  "}────────────────────</Text>
          <Text>
            {"  "}Result: <Text color="green">{successCount} succeeded</Text> ·{" "}
            <Text color="blue">{skippedCount} skipped</Text> ·{" "}
            <Text color="red">{failedCount} failed</Text>
          </Text>

          {template.backup && !options.skipRestore && (
            <Box flexDirection="column" marginTop={1}>
              <Text bold>
                ▸ Proceeding with config file restore...
              </Text>
              <Text color="gray">
                {"  "}Backup link: {template.backup}
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
    .description("Run template-based machine provisioning")
    .option("--dry-run", "Show plan without execution", false)
    .option("--skip-restore", "Skip automatic restore after template completion", false)
    .action(
      async (
        templateName: string,
        opts: { dryRun: boolean; skipRestore: boolean },
      ) => {
        // Pre-Ink phase: resolve template and handle sudo
        const templates = await listTemplates();
        const match = templates.find(
          (t) =>
            t.name === templateName ||
            t.name === `${templateName}.yml` ||
            t.config.name === templateName,
        );

        if (!match) {
          console.error(`Template not found: ${templateName}`);
          process.exit(1);
        }

        const tmpl = await loadTemplate(match.path);

        // Handle sudo requirement (skip in dry-run)
        if (tmpl.sudo && !opts.dryRun) {
          ensureSudo(tmpl.name);
        }

        // Ink phase: render the TUI
        const { waitUntilExit } = render(
          <ProvisionView
            template={tmpl}
            templatePath={match.path}
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
