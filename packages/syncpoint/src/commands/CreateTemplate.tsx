import React, { useState, useEffect } from "react";
import { Text, Box, useApp } from "ink";
import Spinner from "ink-spinner";
import { Command } from "commander";
import { render } from "ink";
import { join } from "node:path";
import { writeFile } from "node:fs/promises";

import { getSubDir } from "../constants.js";
import { readAsset } from "../utils/assets.js";
import { ensureDir, fileExists } from "../utils/paths.js";
import { validateTemplate } from "../schemas/template.schema.js";
import { generateTemplateWizardPrompt } from "../prompts/wizard-template.js";
import {
  isClaudeCodeAvailable,
  invokeClaudeCode,
  resumeClaudeCodeSession,
} from "../utils/claude-code-runner.js";
import { extractYAML, parseYAML } from "../utils/yaml-parser.js";
import { createRetryPrompt, formatValidationErrors } from "../utils/error-formatter.js";
import type { TemplateConfig } from "../utils/types.js";

type Phase =
  | "init"
  | "llm-invoke"
  | "validating"
  | "retry"
  | "writing"
  | "done"
  | "error";

interface CreateTemplateViewProps {
  printMode: boolean;
  templateName?: string;
}

const MAX_RETRIES = 3;

const CreateTemplateView: React.FC<CreateTemplateViewProps> = ({
  printMode,
  templateName,
}) => {
  const { exit } = useApp();
  const [phase, setPhase] = useState<Phase>("init");
  const [message, setMessage] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [prompt, setPrompt] = useState<string>("");
  const [sessionId, setSessionId] = useState<string | undefined>(undefined);
  const [attemptNumber, setAttemptNumber] = useState<number>(1);

  useEffect(() => {
    (async () => {
      try {
        const templatesDir = getSubDir("templates");
        await ensureDir(templatesDir);

        // Load example template
        const exampleTemplate = readAsset("template.example.yml");

        // Generate prompt
        const generatedPrompt = generateTemplateWizardPrompt({
          exampleTemplate,
        });
        setPrompt(generatedPrompt);

        // Print mode: just output the prompt
        if (printMode) {
          setPhase("done");
          exit();
          return;
        }

        // Check if Claude Code is available
        if (!(await isClaudeCodeAvailable())) {
          throw new Error(
            "Claude Code CLI not found. Install it or use --print mode to get the prompt.",
          );
        }

        // Invoke LLM with retry
        await invokeLLMWithRetry(generatedPrompt, templatesDir);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
        setPhase("error");
        setTimeout(() => exit(), 100);
      }
    })();
  }, []);

  async function invokeLLMWithRetry(
    initialPrompt: string,
    templatesDir: string,
  ): Promise<void> {
    let currentPrompt = initialPrompt;
    let currentAttempt = 1;
    let currentSessionId = sessionId;

    while (currentAttempt <= MAX_RETRIES) {
      try {
        // Invoke LLM
        setPhase("llm-invoke");
        setMessage(`Generating template... (Attempt ${currentAttempt}/${MAX_RETRIES})`);

        const result = currentSessionId
          ? await resumeClaudeCodeSession(currentSessionId, currentPrompt)
          : await invokeClaudeCode(currentPrompt);

        if (!result.success) {
          throw new Error(result.error || "Failed to invoke Claude Code");
        }

        currentSessionId = result.sessionId;
        setSessionId(currentSessionId);

        // Parse response
        setPhase("validating");
        setMessage("Parsing YAML response...");

        const yamlContent = extractYAML(result.output);
        if (!yamlContent) {
          throw new Error("No valid YAML found in LLM response");
        }

        const parsedTemplate = parseYAML<TemplateConfig>(yamlContent);

        // Validate
        setMessage("Validating template...");
        const validation = validateTemplate(parsedTemplate);

        if (validation.valid) {
          // Success! Write template
          setPhase("writing");
          setMessage("Writing template...");

          // Generate filename from template name or use provided name
          const filename = templateName
            ? `${templateName}.yml`
            : `${parsedTemplate.name.toLowerCase().replace(/\s+/g, "-")}.yml`;

          const templatePath = join(templatesDir, filename);

          // Check if file already exists
          if (await fileExists(templatePath)) {
            throw new Error(
              `Template already exists: ${filename}\nPlease choose a different name or delete the existing template.`,
            );
          }

          await writeFile(templatePath, yamlContent, "utf-8");

          setPhase("done");
          setMessage(`✓ Template created: ${filename}`);
          setTimeout(() => exit(), 100);
          return;
        }

        // Validation failed
        if (currentAttempt >= MAX_RETRIES) {
          throw new Error(
            `Validation failed after ${MAX_RETRIES} attempts:\n${formatValidationErrors(validation.errors || [])}`,
          );
        }

        // Retry with error context
        setPhase("retry");
        setMessage(`Validation failed. Retrying with error context...`);
        currentPrompt = createRetryPrompt(
          initialPrompt,
          validation.errors || [],
          currentAttempt + 1,
        );
        currentAttempt++;
        setAttemptNumber(currentAttempt);
      } catch (err) {
        if (currentAttempt >= MAX_RETRIES) {
          throw err;
        }
        currentAttempt++;
        setAttemptNumber(currentAttempt);
      }
    }
  }

  if (error) {
    return (
      <Box flexDirection="column">
        <Text color="red">✗ {error}</Text>
      </Box>
    );
  }

  if (printMode && phase === "done") {
    return (
      <Box flexDirection="column">
        <Text bold>Create Template Prompt (Copy and paste to your LLM):</Text>
        <Box marginTop={1} marginBottom={1}>
          <Text dimColor>{"─".repeat(60)}</Text>
        </Box>
        <Text>{prompt}</Text>
        <Box marginTop={1} marginBottom={1}>
          <Text dimColor>{"─".repeat(60)}</Text>
        </Box>
        <Text dimColor>
          After getting the YAML response, save it to ~/.syncpoint/templates/
        </Text>
      </Box>
    );
  }

  if (phase === "done") {
    return (
      <Box flexDirection="column">
        <Text color="green">{message}</Text>
        <Box marginTop={1}>
          <Text>Next steps:</Text>
          <Text>  1. Review your template: syncpoint list templates</Text>
          <Text>  2. Run provisioning: syncpoint provision &lt;template-name&gt;</Text>
        </Box>
      </Box>
    );
  }

  return (
    <Box flexDirection="column">
      <Text>
        <Text color="cyan">
          <Spinner type="dots" />
        </Text>
        {" "}
        {message}
      </Text>
      {attemptNumber > 1 && (
        <Text dimColor>Attempt {attemptNumber}/{MAX_RETRIES}</Text>
      )}
    </Box>
  );
};

export function registerCreateTemplateCommand(program: Command): void {
  program
    .command("create-template [name]")
    .description("Interactive wizard to create a provisioning template")
    .option("-p, --print", "Print prompt instead of invoking Claude Code")
    .action(async (name: string | undefined, opts: { print?: boolean }) => {
      const { waitUntilExit } = render(
        <CreateTemplateView printMode={opts.print || false} templateName={name} />,
      );
      await waitUntilExit();
    });
}
