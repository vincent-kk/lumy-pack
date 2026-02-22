import {
  copyFile,
  readFile,
  rename,
  unlink,
  writeFile,
} from 'node:fs/promises';
import { join } from 'node:path';

import { Command } from 'commander';
import { Box, Text, useApp } from 'ink';
import { render } from 'ink';
import Spinner from 'ink-spinner';
import React, { useEffect, useState } from 'react';

import { CONFIG_FILENAME, getAppDir } from '../constants.js';
import { generateConfigWizardPrompt } from '../prompts/wizard-config.js';
import { validateConfig } from '../schemas/config.schema.js';
import { readAsset } from '../utils/assets.js';
import {
  invokeClaudeCode,
  invokeClaudeCodeInteractive,
  isClaudeCodeAvailable,
  resumeClaudeCodeSession,
} from '../utils/claude-code-runner.js';
import { COMMANDS } from '../utils/command-registry.js';
import {
  createRetryPrompt,
  formatValidationErrors,
} from '../utils/error-formatter.js';
import { scanHomeDirectory } from '../utils/file-scanner.js';
import { fileExists } from '../utils/paths.js';
import type { SyncpointConfig } from '../utils/types.js';
import { extractYAML, parseYAML } from '../utils/yaml-parser.js';

type Phase =
  | 'init'
  | 'scanning'
  | 'llm-invoke'
  | 'validating'
  | 'retry'
  | 'writing'
  | 'done'
  | 'error';

interface WizardViewProps {
  printMode: boolean;
}

const MAX_RETRIES = 3;

/**
 * Restore config.yml from backup file
 */
async function restoreBackup(configPath: string): Promise<void> {
  const bakPath = `${configPath}.bak`;
  if (await fileExists(bakPath)) {
    await copyFile(bakPath, configPath);
    // Keep .bak as safety net - don't delete it
  }
}

/**
 * Phase 1: Scan home directory and generate prompt
 */
async function runScanPhase(): Promise<{
  fileStructure: ReturnType<typeof scanHomeDirectory> extends Promise<infer T>
    ? T
    : never;
  prompt: string;
}> {
  const fileStructure = await scanHomeDirectory();
  const defaultConfig = readAsset('config.default.yml');
  const prompt = generateConfigWizardPrompt({
    fileStructure,
    defaultConfig,
  });

  return { fileStructure, prompt };
}

/**
 * Phase 2: Interactive Claude Code execution
 */
async function runInteractivePhase(prompt: string): Promise<void> {
  console.log('\n🤖 Launching Claude Code in interactive mode...');
  console.log(
    'Claude Code will start the conversation automatically. Just respond to the questions!\n',
  );

  await invokeClaudeCodeInteractive(prompt);
}

/**
 * Phase 3: Validation after interactive session
 */
async function runValidationPhase(configPath: string): Promise<void> {
  try {
    if (!(await fileExists(configPath))) {
      await restoreBackup(configPath);
      console.log('⚠️  Config file was not created. Restored backup.');
      return;
    }

    const content = await readFile(configPath, 'utf-8');
    const parsed = parseYAML<SyncpointConfig>(content);
    const validation = validateConfig(parsed);

    if (!validation.valid) {
      await restoreBackup(configPath);
      console.log(
        `❌ Validation failed:\n${formatValidationErrors(validation.errors || [])}`,
      );
      console.log('Restored previous config from backup.');
      return;
    }

    console.log('✅ Config wizard complete! Your config.yml has been created.');
  } catch (err) {
    await restoreBackup(configPath);
    throw err;
  }
}

const WizardView: React.FC<WizardViewProps> = ({ printMode }) => {
  const { exit } = useApp();
  const [phase, setPhase] = useState<Phase>('init');
  const [message, setMessage] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [prompt, setPrompt] = useState<string>('');
  const [sessionId, setSessionId] = useState<string | undefined>(undefined);
  const [attemptNumber, setAttemptNumber] = useState<number>(1);

  useEffect(() => {
    (async () => {
      try {
        const configPath = join(getAppDir(), CONFIG_FILENAME);

        // Check if config already exists
        if (await fileExists(configPath)) {
          const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
          const bakPath = `${configPath}.${timestamp}.bak`;
          await rename(configPath, bakPath);
          setMessage(`Backed up existing config to ${bakPath}`);
        }

        // Phase 1: Scan home directory
        setPhase('scanning');
        setMessage('Scanning home directory for backup targets...');

        const fileStructure = await scanHomeDirectory();
        setMessage(
          `Found ${fileStructure.totalFiles} files in ${fileStructure.categories.length} categories`,
        );

        // Load default config template
        const defaultConfig = readAsset('config.default.yml');

        // Generate prompt
        const generatedPrompt = generateConfigWizardPrompt({
          fileStructure,
          defaultConfig,
        });
        setPrompt(generatedPrompt);

        // Print mode: just output the prompt
        if (printMode) {
          setPhase('done');
          exit();
          return;
        }

        // Check if Claude Code is available
        if (!(await isClaudeCodeAvailable())) {
          throw new Error(
            'Claude Code CLI not found. Install it or use --print mode to get the prompt.',
          );
        }

        // Phase 2: Invoke LLM
        await invokeLLMWithRetry(generatedPrompt, configPath);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
        setPhase('error');
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

    try {
      while (currentAttempt <= MAX_RETRIES) {
        try {
          // Invoke LLM
          setPhase('llm-invoke');
          setMessage(
            `Generating config... (Attempt ${currentAttempt}/${MAX_RETRIES})`,
          );

          const result = currentSessionId
            ? await resumeClaudeCodeSession(currentSessionId, currentPrompt)
            : await invokeClaudeCode(currentPrompt);

          if (!result.success) {
            throw new Error(result.error || 'Failed to invoke Claude Code');
          }

          currentSessionId = result.sessionId;
          setSessionId(currentSessionId);

          // Phase 3: Parse response
          setPhase('validating');
          setMessage('Parsing YAML response...');

          const yamlContent = extractYAML(result.output);
          if (!yamlContent) {
            throw new Error('No valid YAML found in LLM response');
          }

          const parsedConfig = parseYAML<SyncpointConfig>(yamlContent);

          // Phase 4: Validate
          setMessage('Validating config...');
          const validation = validateConfig(parsedConfig);

          if (validation.valid) {
            // Success! Write config with atomic pattern
            setPhase('writing');
            setMessage('Writing config.yml...');

            // Write to temp file first
            const tmpPath = `${configPath}.tmp`;
            await writeFile(tmpPath, yamlContent, 'utf-8');

            // Verify again before atomic rename
            const verification = validateConfig(parseYAML(yamlContent));
            if (verification.valid) {
              await rename(tmpPath, configPath); // Atomic replacement
            } else {
              await unlink(tmpPath);
              throw new Error('Final validation failed');
            }

            setPhase('done');
            setMessage(
              '✓ Config wizard complete! Your config.yml has been created.',
            );
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
          setPhase('retry');
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
    } catch (err) {
      // Restore backup on any unrecoverable failure
      await restoreBackup(configPath);
      throw err;
    }
  }

  if (error) {
    return (
      <Box flexDirection="column">
        <Text color="red">✗ {error}</Text>
      </Box>
    );
  }

  if (printMode && phase === 'done') {
    return (
      <Box flexDirection="column">
        <Text bold>Config Wizard Prompt (Copy and paste to your LLM):</Text>
        <Box marginTop={1} marginBottom={1}>
          <Text dimColor>{'─'.repeat(60)}</Text>
        </Box>
        <Text>{prompt}</Text>
        <Box marginTop={1} marginBottom={1}>
          <Text dimColor>{'─'.repeat(60)}</Text>
        </Box>
        <Text dimColor>
          After getting the YAML response, save it to ~/.syncpoint/config.yml
        </Text>
      </Box>
    );
  }

  if (phase === 'done') {
    return (
      <Box flexDirection="column">
        <Text color="green">{message}</Text>
        <Box marginTop={1}>
          <Text>Next steps:</Text>
          <Text> 1. Review your config: ~/.syncpoint/config.yml</Text>
          <Text> 2. Run: syncpoint backup</Text>
        </Box>
      </Box>
    );
  }

  return (
    <Box flexDirection="column">
      <Text>
        <Text color="cyan">
          <Spinner type="dots" />
        </Text>{' '}
        {message}
      </Text>
      {attemptNumber > 1 && (
        <Text dimColor>
          Attempt {attemptNumber}/{MAX_RETRIES}
        </Text>
      )}
    </Box>
  );
};

export function registerWizardCommand(program: Command): void {
  const cmdInfo = COMMANDS.wizard;
  const cmd = program.command('wizard').description(cmdInfo.description);

  // Register options from central registry
  cmdInfo.options?.forEach((opt) => {
    cmd.option(opt.flag, opt.description);
  });

  cmd.action(async (opts: { print?: boolean }) => {
    if (opts.print) {
      // Print mode: use existing Ink UI
      const { waitUntilExit } = render(<WizardView printMode={true} />);
      await waitUntilExit();
      return;
    }

    // Interactive mode: 3-phase execution
    const configPath = join(getAppDir(), CONFIG_FILENAME);

    try {
      // Backup existing config
      if (await fileExists(configPath)) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const bakPath = `${configPath}.${timestamp}.bak`;
        console.log(`📋 Backing up existing config to ${bakPath}`);
        await rename(configPath, bakPath);
      }

      // Check if Claude Code is available
      if (!(await isClaudeCodeAvailable())) {
        throw new Error(
          'Claude Code CLI not found. Please install it or use --print mode.',
        );
      }

      // Phase 1: Scan
      console.log('🔍 Scanning home directory...');
      const scanResult = await runScanPhase();
      console.log(
        `Found ${scanResult.fileStructure.totalFiles} files in ${scanResult.fileStructure.categories.length} categories`,
      );

      // Phase 2: Interactive
      await runInteractivePhase(scanResult.prompt);

      // Phase 3: Validate
      await runValidationPhase(configPath);
    } catch (err) {
      console.error('❌ Error:', err instanceof Error ? err.message : err);
      process.exit(1);
    }
  });
}
