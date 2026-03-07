import { existsSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { execSync } from 'node:child_process';

const KIWI_MODEL_URL = 'https://github.com/bab2min/Kiwi/releases/download/v0.22.2/kiwi_model_v0.22.2_base.tgz';

/** Resolve model directory path for a given model name. */
export function resolveModelDir(model: string): string {
  return join(homedir(), '.ink-veil', 'models', model, 'base');
}

/** Check if a model is installed by looking for a key file. */
export function isModelInstalled(model: string): boolean {
  return existsSync(join(resolveModelDir(model), 'sj.morph'));
}

/**
 * Download and extract the Kiwi model if not already installed.
 * Returns the model directory path on success, or null on failure.
 */
export async function ensureModel(model: string): Promise<string | null> {
  const modelDir = resolveModelDir(model);

  if (isModelInstalled(model)) return modelDir;

  const parentDir = join(homedir(), '.ink-veil', 'models', model);
  try {
    await mkdir(parentDir, { recursive: true });
    process.stderr.write('ink-veil: Downloading Kiwi model (~16MB)...\n');
    execSync(
      `curl -sL "${KIWI_MODEL_URL}" | tar -xzf - --strip-components=2 -C "${parentDir}"`,
      { stdio: ['pipe', 'pipe', 'inherit'], timeout: 60_000 },
    );
    process.stderr.write('ink-veil: Kiwi model installed.\n');
    return modelDir;
  } catch (err) {
    process.stderr.write(
      `ink-veil: model auto-download failed — ${err instanceof Error ? err.message : String(err)}. Use 'ink-veil model download' manually.\n`,
    );
    return null;
  }
}
