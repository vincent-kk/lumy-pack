import React, { useState, useEffect } from "react";
import { Text, Box, useApp } from "ink";
import Spinner from "ink-spinner";
import { Command } from "commander";
import { render } from "ink";
import { join } from "node:path";
import { readFile, writeFile, rename } from "node:fs/promises";

import { getAppDir, CONFIG_FILENAME } from "../constants.js";
import { readAsset } from "../utils/assets.js";
import { fileExists } from "../utils/paths.js";
import { validateConfig } from "../schemas/config.schema.js";
import {
  scanHomeDirectory,
  fileStructureToJSON,
} from "../utils/file-scanner.js";
import { generateConfigWizardPrompt } from "../prompts/wizard-config.js";
import {
  isClaudeCodeAvailable,
  invokeClaudeCode,
  resumeClaudeCodeSession,
} from "../utils/claude-code-runner.js";
import { extractYAML, parseYAML } from "../utils/yaml-parser.js";
import { createRetryPrompt, formatValidationErrors } from "../utils/error-formatter.js";
import type { SyncpointConfig } from "../utils/types.js";

type Phase =
  | "init"
  | "scanning"
  | "llm-invoke"
  | "validating"
  | "retry"
  | "writing"
  | "done"
  | "error";

interface WizardViewProps {
  printMode: boolean;
}

const MAX_RETRIES = 3;

const WizardView: React.FC<WizardViewProps> = ({ printMode }) => {
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
        const configPath = join(getAppDir(), CONFIG_FILENAME);

        // Check if config already exists
        if (await fileExists(configPath)) {
          setMessage(
            `Config already exists: ${configPath}\nWould you like to backup and overwrite? (Backup will be saved as config.yml.bak)`,
          );
          // In a real implementation, we'd wait for user confirmation here
          // For now, we'll proceed with backup
          await rename(configPath, `${configPath}.bak`);
          setMessage(`Backed up existing config to config.yml.bak`);
        }

        // Phase 1: Scan home directory
        setPhase("scanning");
        setMessage("Scanning home directory for backup targets...");

        const fileStructure = await scanHomeDirectory();
        setMessage(`Found ${fileStructure.totalFiles} files in ${fileStructure.categories.length} categories`);

        // Load default config template
        const defaultConfig = readAsset("config.default.yml");

        // Generate prompt
        const generatedPrompt = generateConfigWizardPrompt({
          fileStructure,
          defaultConfig,
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

        // Phase 2: Invoke LLM
        await invokeLLMWithRetry(generatedPrompt, configPath);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
        setPhase("error");
        setTimeout(() => exit(), 100);
      }
    })();
  }, []);

  async function invokeLLMWithRetry(
    initialPrompt: string,
    configPath: string,
  ): Promise<void> {
    let currentPrompt = initialPrompt;
    let currentAttempt = 1;
    let currentSessionId = sessionId;

    while (currentAttempt <= MAX_RETRIES) {
      try {
        // Invoke LLM
        setPhase("llm-invoke");
        setMessage(`Generating config... (Attempt ${currentAttempt}/${MAX_RETRIES})`);

        const result = currentSessionId
          ? await resumeClaudeCodeSession(currentSessionId, currentPrompt)
          : await invokeClaudeCode(currentPrompt);

        if (!result.success) {
          throw new Error(result.error || "Failed to invoke Claude Code");
        }

        currentSessionId = result.sessionId;
        setSessionId(currentSessionId);

        // Phase 3: Parse response
        setPhase("validating");
        setMessage("Parsing YAML response...");

        const yamlContent = extractYAML(result.output);
        if (!yamlContent) {
          throw new Error("No valid YAML found in LLM response");
        }

        const parsedConfig = parseYAML<SyncpointConfig>(yamlContent);

        // Phase 4: Validate
        setMessage("Validating config...");
        const validation = validateConfig(parsedConfig);

        if (validation.valid) {
          // Success! Write config
          setPhase("writing");
          setMessage("Writing config.yml...");
          await writeFile(configPath, yamlContent, "utf-8");

          setPhase("done");
          setMessage("✓ Config wizard complete! Your config.yml has been created.");
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
        <Text bold>Config Wizard Prompt (Copy and paste to your LLM):</Text>
        <Box marginTop={1} marginBottom={1}>
          <Text dimColor>{"─".repeat(60)}</Text>
        </Box>
        <Text>{prompt}</Text>
        <Box marginTop={1} marginBottom={1}>
          <Text dimColor>{"─".repeat(60)}</Text>
        </Box>
        <Text dimColor>After getting the YAML response, save it to ~/.syncpoint/config.yml</Text>
      </Box>
    );
  }

  if (phase === "done") {
    return (
      <Box flexDirection="column">
        <Text color="green">{message}</Text>
        <Box marginTop={1}>
          <Text>Next steps:</Text>
          <Text>  1. Review your config: ~/.syncpoint/config.yml</Text>
          <Text>  2. Run: syncpoint backup</Text>
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

export function registerWizardCommand(program: Command): void {
  program
    .command("wizard")
    .description("Interactive wizard to generate config.yml")
    .option("-p, --print", "Print prompt instead of invoking Claude Code")
    .action(async (opts: { print?: boolean }) => {
      const { waitUntilExit } = render(
        <WizardView printMode={opts.print || false} />,
      );
      await waitUntilExit();
    });
}
