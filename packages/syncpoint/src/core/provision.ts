import { exec } from 'node:child_process';
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';

import YAML from 'yaml';

import { TEMPLATES_DIR, getSubDir } from '../constants.js';
import { validateTemplate } from '../schemas/template.schema.js';
import { logger } from '../utils/logger.js';
import { fileExists } from '../utils/paths.js';
import type {
  ProvisionOptions,
  StepResult,
  TemplateConfig,
  TemplateStep,
} from '../utils/types.js';

const REMOTE_SCRIPT_PATTERNS = [
  /curl\s.*\|\s*(ba)?sh/,
  /wget\s.*\|\s*(ba)?sh/,
  /curl\s.*\|\s*python/,
  /wget\s.*\|\s*python/,
];

function containsRemoteScriptPattern(command: string): boolean {
  return REMOTE_SCRIPT_PATTERNS.some((p) => p.test(command));
}

function sanitizeErrorOutput(output: string): string {
  return output
    .replace(/\/Users\/[^\s/]+/g, '/Users/***')
    .replace(/\/home\/[^\s/]+/g, '/home/***')
    .replace(/(password|token|key|secret)[=:]\s*\S+/gi, '$1=***')
    .slice(0, 500);
}

/**
 * Load and validate a template from a YAML file.
 */
export async function loadTemplate(
  templatePath: string,
): Promise<TemplateConfig> {
  const exists = await fileExists(templatePath);
  if (!exists) {
    throw new Error(`Template not found: ${templatePath}`);
  }

  const raw = await readFile(templatePath, 'utf-8');
  const data = YAML.parse(raw) as unknown;

  const result = validateTemplate(data);
  if (!result.valid) {
    throw new Error(
      `Invalid template ${templatePath}:\n${(result.errors ?? []).join('\n')}`,
    );
  }

  return data as TemplateConfig;
}

/**
 * List all available templates from ~/.syncpoint/templates/.
 */
export async function listTemplates(): Promise<
  Array<{ name: string; path: string; config: TemplateConfig }>
> {
  const templatesDir = getSubDir(TEMPLATES_DIR);
  const exists = await fileExists(templatesDir);
  if (!exists) return [];

  const entries = await readdir(templatesDir, { withFileTypes: true });
  const templates: Array<{
    name: string;
    path: string;
    config: TemplateConfig;
  }> = [];

  for (const entry of entries) {
    if (
      !entry.isFile() ||
      (!entry.name.endsWith('.yml') && !entry.name.endsWith('.yaml'))
    ) {
      continue;
    }

    const fullPath = join(templatesDir, entry.name);
    try {
      const config = await loadTemplate(fullPath);
      templates.push({
        name: entry.name.replace(/\.ya?ml$/, ''),
        path: fullPath,
        config,
      });
    } catch {
      logger.warn(`Skipping invalid template: ${entry.name}`);
    }
  }

  return templates;
}

/**
 * Execute a shell command and return a Promise.
 */
function execAsync(
  command: string,
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    exec(
      command,
      { shell: '/bin/bash', timeout: 300_000 },
      (error, stdout, stderr) => {
        if (error) {
          reject(
            Object.assign(error, {
              stdout: stdout?.toString() ?? '',
              stderr: stderr?.toString() ?? '',
            }),
          );
        } else {
          resolve({
            stdout: stdout?.toString() ?? '',
            stderr: stderr?.toString() ?? '',
          });
        }
      },
    );
  });
}

/**
 * Evaluate a skip_if condition.
 * Returns true if the command exits with code 0 (meaning: skip this step).
 */
export async function evaluateSkipIf(
  command: string,
  stepName: string,
): Promise<boolean> {
  if (containsRemoteScriptPattern(command)) {
    throw new Error(
      `Blocked dangerous remote script pattern in skip_if: ${stepName}`,
    );
  }
  try {
    await execAsync(command);
    return true; // exit 0 → condition met → skip
  } catch {
    return false; // non-zero → condition not met → do not skip
  }
}

/**
 * Execute a single provisioning step.
 */
export async function executeStep(step: TemplateStep): Promise<StepResult> {
  const startTime = Date.now();

  // Block dangerous remote script patterns
  if (containsRemoteScriptPattern(step.command)) {
    throw new Error(
      `Blocked dangerous remote script pattern in command: ${step.name}`,
    );
  }

  // Evaluate skip_if
  if (step.skip_if) {
    const shouldSkip = await evaluateSkipIf(step.skip_if, step.name);
    if (shouldSkip) {
      return {
        name: step.name,
        status: 'skipped',
        duration: Date.now() - startTime,
      };
    }
  }

  // Execute the command
  try {
    const { stdout, stderr } = await execAsync(step.command);
    const output = [stdout, stderr].filter(Boolean).join('\n').trim();
    return {
      name: step.name,
      status: 'success',
      duration: Date.now() - startTime,
      output: output || undefined,
    };
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    const stdout = (err as { stdout?: string })?.stdout ?? '';
    const stderr = (err as { stderr?: string })?.stderr ?? '';
    const errorOutput = [stdout, stderr, error.message]
      .filter(Boolean)
      .join('\n')
      .trim();

    return {
      name: step.name,
      status: 'failed',
      duration: Date.now() - startTime,
      error: sanitizeErrorOutput(errorOutput),
    };
  }
}

/**
 * Run a provisioning template, yielding step results for real-time UI.
 *
 * Stops on failure unless the step has continue_on_error: true.
 */
export async function* runProvision(
  templatePath: string,
  options: ProvisionOptions = {},
): AsyncGenerator<StepResult> {
  const template = await loadTemplate(templatePath);

  for (const step of template.steps) {
    if (options.dryRun) {
      // In dry-run mode, show what would happen
      let status: StepResult['status'] = 'pending';
      if (step.skip_if) {
        const shouldSkip = await evaluateSkipIf(step.skip_if, step.name);
        if (shouldSkip) status = 'skipped';
      }
      yield {
        name: step.name,
        status,
      };
      continue;
    }

    // Yield "running" status
    yield {
      name: step.name,
      status: 'running',
    };

    const result = await executeStep(step);
    yield result;

    // Stop if step failed and continue_on_error is not set
    if (result.status === 'failed' && !step.continue_on_error) {
      logger.error(`Step "${step.name}" failed. Stopping provisioning.`);
      return;
    }
  }
}
