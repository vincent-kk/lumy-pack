import { createHash } from 'node:crypto';
import { createWriteStream, existsSync } from 'node:fs';
import { mkdir, readFile, writeFile, unlink, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { NERModelError } from '../../errors/types.js';

export interface ModelInfo {
  name: string;
  version: string;
  url: string;
  sha256: string;
  sizeBytes: number;
  license: string;
}

// Hardcoded registry — no remote fetch. SHA-256 pinned at release time.
export const MODEL_REGISTRY: Record<string, ModelInfo> = {
  'gliner_multi-v2.1': {
    name: 'vincent-kk/gliner_multi-v2.1-onnx',
    version: '2.1.0',
    url: 'https://huggingface.co/vincent-kk/gliner_multi-v2.1-onnx/resolve/main/onnx/model_int8.onnx',
    // Updated: 2026-03-07 | Source: vincent-kk/gliner_multi-v2.1-onnx@main
    sha256: '995058c82c5f570601dd8a0ba74ee60a392f764268bc5f628455e44dd3b476ec',
    sizeBytes: 349120924,
    license: 'Apache-2.0',
  },
};

/** Fallback chain order. */
const FALLBACK_CHAIN: string[] = ['gliner_multi-v2.1'];

export interface ModelStatus {
  modelId: string;
  installed: boolean;
  checksumOk: boolean | null;
  sizeBytes: number;
  path: string | null;
}

export class ModelManager {
  private readonly modelsDir: string;

  constructor(baseDir?: string) {
    this.modelsDir = join(baseDir ?? join(homedir(), '.ink-veil'), 'models');
  }

  /** Return the path to model.onnx if the model is installed and checksum valid. */
  async ensureModel(modelId: string): Promise<string> {
    const info = MODEL_REGISTRY[modelId];
    if (!info) {
      throw new NERModelError(`Unknown model: ${modelId}`, { modelId });
    }

    const modelDir = join(this.modelsDir, modelId);
    const modelPath = join(modelDir, 'model.onnx');
    const checksumPath = join(modelDir, '.checksum');

    if (existsSync(modelPath)) {
      const stored = await this.readChecksum(checksumPath);
      if (stored === info.sha256) {
        return modelPath;
      }
      // Checksum mismatch — delete and re-download.
      process.stderr.write(`ink-veil: checksum mismatch for ${modelId}, re-downloading\n`);
      await rm(modelDir, { recursive: true, force: true });
    }

    return this.download(modelId, info, modelDir, modelPath, checksumPath);
  }

  /**
   * Try each model in the fallback chain. On complete failure returns null
   * and the caller should switch to regex-only mode.
   */
  async ensureWithFallback(): Promise<string | null> {
    for (const modelId of FALLBACK_CHAIN) {
      try {
        const path = await this.ensureModel(modelId);
        return path;
      } catch {
        process.stderr.write(`ink-veil: model ${modelId} unavailable, trying next\n`);
      }
    }
    process.stderr.write('ink-veil: WARNING — NER model unavailable. Using regex-only detection.\n');
    return null;
  }

  /** Get installation status for all registry models. */
  async status(): Promise<ModelStatus[]> {
    const results: ModelStatus[] = [];
    for (const [modelId, info] of Object.entries(MODEL_REGISTRY)) {
      const modelDir = join(this.modelsDir, modelId);
      const modelPath = join(modelDir, 'model.onnx');
      const checksumPath = join(modelDir, '.checksum');

      if (!existsSync(modelPath)) {
        results.push({ modelId, installed: false, checksumOk: null, sizeBytes: info.sizeBytes, path: null });
        continue;
      }

      const stored = await this.readChecksum(checksumPath);
      results.push({
        modelId,
        installed: true,
        checksumOk: stored === info.sha256,
        sizeBytes: info.sizeBytes,
        path: modelPath,
      });
    }
    return results;
  }

  private async download(
    modelId: string,
    info: ModelInfo,
    modelDir: string,
    modelPath: string,
    checksumPath: string,
  ): Promise<string> {
    await mkdir(modelDir, { recursive: true });

    process.stderr.write(`ink-veil: Downloading GLiNER model ${modelId} (${Math.round(info.sizeBytes / 1_048_576)}MB)...\n`);

    const response = await fetch(info.url);
    if (!response.ok || !response.body) {
      throw new NERModelError(`Download failed for ${modelId}: HTTP ${response.status}`, { modelId, status: response.status });
    }

    const tmpPath = modelPath + '.tmp';
    const hash = createHash('sha256');
    const out = createWriteStream(tmpPath);

    const total = info.sizeBytes;
    let received = 0;

    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        hash.update(value);
        received += value.length;
        const pct = Math.round((received / total) * 100);
        process.stderr.write(`\r  ${pct}% (${Math.round(received / 1_048_576)}MB / ${Math.round(total / 1_048_576)}MB)`);
      }
      process.stderr.write('\n');
    } finally {
      reader.releaseLock();
    }

    // Write to tmp file.
    await new Promise<void>((resolve, reject) => {
      for (const chunk of chunks) out.write(chunk);
      out.end();
      out.on('finish', resolve);
      out.on('error', reject);
    });

    const digest = hash.digest('hex');
    if (digest !== info.sha256) {
      await unlink(tmpPath).catch(() => {});
      throw new NERModelError(
        `SHA-256 mismatch for ${modelId}: expected ${info.sha256}, got ${digest}`,
        { modelId, expected: info.sha256, actual: digest },
      );
    }

    // Atomic rename.
    const { rename } = await import('node:fs/promises');
    await rename(tmpPath, modelPath);
    await writeFile(checksumPath, digest, 'utf-8');

    process.stderr.write(`ink-veil: Model ${modelId} installed successfully.\n`);
    return modelPath;
  }

  /**
   * List only installed models with their actual disk size.
   */
  async list(): Promise<ModelStatus[]> {
    const all = await this.status();
    return all.filter((s) => s.installed);
  }

  /**
   * Remove a cached model directory from ~/.ink-veil/models/{modelId}/.
   * Throws if the model is not in the registry.
   */
  async removeModel(modelId: string): Promise<void> {
    if (!MODEL_REGISTRY[modelId]) {
      throw new NERModelError(`Unknown model: ${modelId}`, { modelId });
    }
    const modelDir = join(this.modelsDir, modelId);
    await rm(modelDir, { recursive: true, force: true });
  }

  private async readChecksum(checksumPath: string): Promise<string | null> {
    if (!existsSync(checksumPath)) return null;
    try {
      return (await readFile(checksumPath, 'utf-8')).trim();
    } catch {
      return null;
    }
  }
}
