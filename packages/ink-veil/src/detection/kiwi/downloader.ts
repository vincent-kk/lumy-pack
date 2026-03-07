import { existsSync } from 'node:fs';
import { readFileSync } from 'node:fs';
import { mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { execSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { MODEL_REGISTRY } from './model-registry.js';

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
 * Verifies SHA256 of the downloaded tarball to prevent supply-chain attacks.
 * Returns the model directory path on success, or null on failure.
 */
export async function ensureModel(model: string): Promise<string | null> {
  const modelDir = resolveModelDir(model);

  if (isModelInstalled(model)) return modelDir;

  const entry = MODEL_REGISTRY[model];
  if (!entry) {
    process.stderr.write(`ink-veil: Unknown model '${model}'. Available: ${Object.keys(MODEL_REGISTRY).join(', ')}\n`);
    return null;
  }

  const parentDir = join(homedir(), '.ink-veil', 'models', model);
  const tarballPath = join(parentDir, '.download.tgz');

  try {
    await mkdir(parentDir, { recursive: true });
    process.stderr.write(`ink-veil: Downloading Kiwi model (${entry.sizeLabel})...\n`);

    // Download to temp file first for hash verification
    execSync(
      `curl -sL "${entry.url}" -o "${tarballPath}"`,
      { stdio: ['pipe', 'pipe', 'inherit'], timeout: 120_000 },
    );

    // Verify SHA256
    const fileBuffer = readFileSync(tarballPath);
    const actualHash = createHash('sha256').update(fileBuffer).digest('hex');

    if (actualHash !== entry.sha256) {
      await rm(tarballPath, { force: true });
      process.stderr.write(
        `ink-veil: SHA256 mismatch! Expected ${entry.sha256}, got ${actualHash}. ` +
        `Download may be corrupted or tampered. Aborting.\n`,
      );
      return null;
    }

    // Extract verified tarball
    execSync(
      `tar -xzf "${tarballPath}" --strip-components=${entry.stripComponents} -C "${parentDir}"`,
      { stdio: ['pipe', 'pipe', 'inherit'] },
    );

    // Clean up tarball
    await rm(tarballPath, { force: true });

    process.stderr.write('ink-veil: Kiwi model installed (SHA256 verified).\n');
    return modelDir;
  } catch (err) {
    await rm(tarballPath, { force: true }).catch(() => {});
    process.stderr.write(
      `ink-veil: model auto-download failed — ${err instanceof Error ? err.message : String(err)}. Use 'ink-veil model download' manually.\n`,
    );
    return null;
  }
}
