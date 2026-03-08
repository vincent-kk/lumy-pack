import { existsSync, readFileSync } from 'node:fs';
import { mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { MODEL_REGISTRY } from './model-registry.js';

const MODEL_KEY_FILE = 'sj.morph';

/** Validate model name to prevent path traversal and command injection. */
function validateModelName(model: string): void {
  if (!/^[a-zA-Z0-9_-]+$/.test(model)) {
    throw new Error(`Invalid model name '${model}'. Only alphanumeric, hyphen, and underscore allowed.`);
  }
}

/** Resolve default model directory path for a given model name. */
export function resolveModelDir(model: string): string {
  validateModelName(model);
  return join(homedir(), '.ink-veil', 'models', model, 'base');
}

/** Check if a model is installed at the given directory. */
export function isModelInstalled(modelOrPath: string): boolean {
  // If it looks like an absolute path, check directly
  if (modelOrPath.startsWith('/')) {
    return existsSync(join(modelOrPath, MODEL_KEY_FILE));
  }
  return existsSync(join(resolveModelDir(modelOrPath), MODEL_KEY_FILE));
}

/**
 * Download and extract model to a specific target directory.
 * Verifies SHA256 to prevent supply-chain attacks.
 * Returns targetDir on success, null on failure.
 */
async function downloadTo(model: string, targetDir: string): Promise<string | null> {
  const entry = MODEL_REGISTRY[model];
  if (!entry) {
    process.stderr.write(`ink-veil: Unknown model '${model}'. Available: ${Object.keys(MODEL_REGISTRY).join(', ')}\n`);
    return null;
  }

  if (!entry.url.startsWith('https://')) {
    process.stderr.write(`ink-veil: Refusing non-HTTPS model URL: ${entry.url}\n`);
    return null;
  }

  const tarballPath = join(targetDir, '.download.tgz');

  try {
    await mkdir(targetDir, { recursive: true });
    process.stderr.write(`ink-veil: Downloading Kiwi model (${entry.sizeLabel})...\n`);

    execFileSync('curl', ['-sL', entry.url, '-o', tarballPath], {
      stdio: ['pipe', 'pipe', 'inherit'],
      timeout: 120_000,
    });

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

    execFileSync('tar', [
      '-xzf', tarballPath,
      `--strip-components=${entry.stripComponents}`,
      '-C', targetDir,
    ], {
      stdio: ['pipe', 'pipe', 'inherit'],
    });

    await rm(tarballPath, { force: true });

    process.stderr.write(`ink-veil: Kiwi model installed at ${targetDir} (SHA256 verified).\n`);
    return targetDir;
  } catch (err) {
    await rm(tarballPath, { force: true }).catch(() => {});
    process.stderr.write(
      `ink-veil: model auto-download failed — ${err instanceof Error ? err.message : String(err)}. Use 'ink-veil model download' manually.\n`,
    );
    return null;
  }
}

/**
 * Ensure model exists at the default location (~/.ink-veil/models/{model}/base/).
 * Downloads if not present. Returns model directory or null.
 */
export async function ensureModel(model: string): Promise<string | null> {
  const modelDir = resolveModelDir(model);
  if (existsSync(join(modelDir, MODEL_KEY_FILE))) return modelDir;

  // downloadTo expects the parent dir (model files go into base/ via strip-components)
  const parentDir = join(homedir(), '.ink-veil', 'models', model);
  return downloadTo(model, parentDir);
}

/**
 * Ensure model exists at a user-specified path.
 * If the path already contains model files, returns it as-is.
 * Otherwise downloads the model to that path.
 */
export async function ensureModelAt(model: string, targetPath: string): Promise<string | null> {
  if (existsSync(join(targetPath, MODEL_KEY_FILE))) return targetPath;

  process.stderr.write(`ink-veil: Model not found at ${targetPath}, downloading...\n`);
  return downloadTo(model, targetPath);
}
