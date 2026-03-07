import { createHash } from 'node:crypto';
import { createWriteStream, existsSync } from 'node:fs';
import { mkdir, readFile, writeFile, unlink, rm, rename } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { homedir } from 'node:os';
import { NERModelError } from '../../errors/types.js';

export interface ModelFile {
  /** Repo-relative path (e.g. "onnx/model_int8.onnx") */
  repoPath: string;
  /** Local path relative to model dir (e.g. "onnx/model_int8.onnx") */
  localPath: string;
  /** SHA-256 hash for integrity verification */
  sha256: string;
  /** File size in bytes */
  sizeBytes: number;
}

export interface ModelInfo {
  name: string;
  version: string;
  /** HuggingFace repo base URL */
  baseUrl: string;
  /** Files to download */
  files: ModelFile[];
  /** Total size in bytes */
  totalSizeBytes: number;
  license: string;
}

// Hardcoded registry — no remote fetch. SHA-256 pinned at release time.
// Updated: 2026-03-07 | Source: vincent-kk/gliner_multi-v2.1-onnx@main
export const MODEL_REGISTRY: Record<string, ModelInfo> = {
  'gliner_multi-v2.1': {
    name: 'vincent-kk/gliner_multi-v2.1-onnx',
    version: '2.1.0',
    baseUrl: 'https://huggingface.co/vincent-kk/gliner_multi-v2.1-onnx/resolve/main',
    files: [
      { repoPath: 'onnx/model_int8.onnx', localPath: 'onnx/model_int8.onnx', sha256: '995058c82c5f570601dd8a0ba74ee60a392f764268bc5f628455e44dd3b476ec', sizeBytes: 349120924 },
      { repoPath: 'config.json', localPath: 'config.json', sha256: '8aece71b73ca0fbd6dd121ad755deb736e7757d053ced523c2e4959ff446d3f5', sizeBytes: 28 },
      { repoPath: 'gliner_config.json', localPath: 'gliner_config.json', sha256: '1ef59c57fe6816a155697a5670ca8d0faf0babe13f199a2c2b5b65113399ed72', sizeBytes: 731 },
      { repoPath: 'tokenizer.json', localPath: 'tokenizer.json', sha256: '914bd3c8fb7b525af9e23b60d0ec7b1248ddb2b99014efd9c02ebeb022f8cab7', sizeBytes: 16331948 },
      { repoPath: 'tokenizer_config.json', localPath: 'tokenizer_config.json', sha256: '78f866883daf7ee2bc400200a155cdbe9116ed0a6ed597ff573ea2c9862a89a6', sizeBytes: 1806 },
      { repoPath: 'special_tokens_map.json', localPath: 'special_tokens_map.json', sha256: '9463f61e1b109a8eb4688b829260d7c6b1e6dff04c98ff7269bb89e2b92369b9', sizeBytes: 286 },
      { repoPath: 'added_tokens.json', localPath: 'added_tokens.json', sha256: '030e747c4ca7992a3ac794c6fda9919352c88ae722e85178217cd083b450078d', sizeBytes: 86 },
      { repoPath: 'spm.model', localPath: 'spm.model', sha256: '13c8d666d62a7bc4ac8f040aab68e942c861f93303156cc28f5c7e885d86d6e3', sizeBytes: 4305025 },
    ],
    totalSizeBytes: 369760834,
    license: 'Apache-2.0',
  },
};

/** Fallback chain order. */
const FALLBACK_CHAIN: string[] = ['gliner_multi-v2.1'];

export interface ModelResult {
  /** Model directory path (pass to worker as modelsBaseDir parent) */
  modelDir: string;
  modelId: string;
}

export interface ModelStatus {
  modelId: string;
  installed: boolean;
  checksumOk: boolean | null;
  sizeBytes: number;
  path: string | null;
}

export class ModelManager {
  readonly modelsDir: string;

  constructor(baseDir?: string) {
    this.modelsDir = join(baseDir ?? join(homedir(), '.ink-veil'), 'models');
  }

  /** Ensure all model files are downloaded and verified. Returns model directory. */
  async ensureModel(modelId: string): Promise<ModelResult> {
    const info = MODEL_REGISTRY[modelId];
    if (!info) {
      throw new NERModelError(`Unknown model: ${modelId}`, { modelId });
    }

    const modelDir = join(this.modelsDir, modelId);
    const manifestPath = join(modelDir, '.manifest.json');

    // Fast path: manifest exists and matches registry
    if (await this.verifyManifest(manifestPath, info)) {
      return { modelDir, modelId };
    }

    // Legacy cleanup: old single-file .checksum format
    const legacyChecksum = join(modelDir, '.checksum');
    if (existsSync(legacyChecksum)) {
      process.stderr.write(`ink-veil: Upgrading model cache format for ${modelId}, re-downloading...\n`);
      await rm(modelDir, { recursive: true, force: true });
    }

    // Determine which files need downloading
    const filesToDownload = await this.getFilesToDownload(modelDir, info);

    if (filesToDownload.length > 0) {
      await this.downloadFiles(modelId, info, modelDir, filesToDownload);
    }

    // Write manifest after all files verified
    await this.writeManifest(manifestPath, info);

    return { modelDir, modelId };
  }

  /**
   * Try each model in the fallback chain. On complete failure returns null
   * and the caller should switch to regex-only mode.
   */
  async ensureWithFallback(): Promise<ModelResult | null> {
    for (const modelId of FALLBACK_CHAIN) {
      try {
        return await this.ensureModel(modelId);
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
      const manifestPath = join(modelDir, '.manifest.json');

      const manifestOk = await this.verifyManifest(manifestPath, info);
      results.push({
        modelId,
        installed: manifestOk,
        checksumOk: manifestOk ? true : existsSync(modelDir) ? false : null,
        sizeBytes: info.totalSizeBytes,
        path: manifestOk ? modelDir : null,
      });
    }
    return results;
  }

  /** List only installed models. */
  async list(): Promise<ModelStatus[]> {
    const all = await this.status();
    return all.filter((s) => s.installed);
  }

  /** Remove a cached model directory. */
  async removeModel(modelId: string): Promise<void> {
    if (!MODEL_REGISTRY[modelId]) {
      throw new NERModelError(`Unknown model: ${modelId}`, { modelId });
    }
    await rm(join(this.modelsDir, modelId), { recursive: true, force: true });
  }

  /** Check which files need downloading by computing SHA-256 of existing files. */
  private async getFilesToDownload(modelDir: string, info: ModelInfo): Promise<ModelFile[]> {
    const needed: ModelFile[] = [];
    for (const file of info.files) {
      const filePath = join(modelDir, file.localPath);
      if (!existsSync(filePath)) {
        needed.push(file);
        continue;
      }
      const hash = await this.computeFileHash(filePath);
      if (hash !== file.sha256) {
        needed.push(file);
      }
    }
    return needed;
  }

  /** Download files in parallel with per-file SHA-256 streaming verification. */
  private async downloadFiles(
    modelId: string,
    info: ModelInfo,
    modelDir: string,
    files: ModelFile[],
  ): Promise<void> {
    const totalBytes = files.reduce((sum, f) => sum + f.sizeBytes, 0);
    process.stderr.write(
      `ink-veil: Downloading ${files.length} file(s) for ${modelId} (${Math.round(totalBytes / 1_048_576)}MB)...\n`,
    );

    // Download all files in parallel
    const results = await Promise.allSettled(
      files.map((file) => this.downloadSingleFile(info.baseUrl, file, modelDir)),
    );

    // Check for failures
    const failures: string[] = [];
    for (let i = 0; i < results.length; i++) {
      const result = results[i]!;
      if (result.status === 'rejected') {
        failures.push(`${files[i]!.localPath}: ${result.reason}`);
      }
    }

    if (failures.length > 0) {
      throw new NERModelError(
        `Download failed for ${modelId}: ${failures.length} file(s) failed:\n  ${failures.join('\n  ')}`,
        { modelId, failures },
      );
    }

    process.stderr.write(`ink-veil: Model ${modelId} installed successfully.\n`);
  }

  /** Download a single file with streaming hash verification. */
  private async downloadSingleFile(
    baseUrl: string,
    file: ModelFile,
    modelDir: string,
  ): Promise<void> {
    const url = `${baseUrl}/${file.repoPath}`;
    const destPath = join(modelDir, file.localPath);
    const tmpPath = destPath + '.tmp';

    // Ensure parent directory exists (for onnx/ subdirectory)
    await mkdir(dirname(destPath), { recursive: true });

    const response = await fetch(url);
    if (!response.ok || !response.body) {
      throw new NERModelError(
        `HTTP ${response.status} for ${file.repoPath}`,
        { file: file.repoPath, status: response.status },
      );
    }

    const hash = createHash('sha256');
    const out = createWriteStream(tmpPath);
    const reader = response.body.getReader();

    // Show progress only for large files (>1MB)
    const showProgress = file.sizeBytes > 1_048_576;
    let received = 0;

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        hash.update(value);
        received += value.length;

        // Stream directly to file with backpressure
        const canContinue = out.write(value);
        if (!canContinue) {
          await new Promise<void>((resolve) => out.once('drain', resolve));
        }

        if (showProgress) {
          const pct = Math.round((received / file.sizeBytes) * 100);
          process.stderr.write(`\r  ${file.localPath}: ${pct}% (${Math.round(received / 1_048_576)}MB / ${Math.round(file.sizeBytes / 1_048_576)}MB)`);
        }
      }
      if (showProgress) process.stderr.write('\n');
    } finally {
      reader.releaseLock();
    }

    // Wait for write stream to finish
    await new Promise<void>((resolve, reject) => {
      out.end();
      out.on('finish', resolve);
      out.on('error', reject);
    });

    // Verify SHA-256
    const digest = hash.digest('hex');
    if (digest !== file.sha256) {
      await unlink(tmpPath).catch(() => {});
      throw new NERModelError(
        `SHA-256 mismatch for ${file.localPath}: expected ${file.sha256}, got ${digest}`,
        { file: file.localPath, expected: file.sha256, actual: digest },
      );
    }

    // Atomic rename
    await rename(tmpPath, destPath);
  }

  /** Verify manifest matches registry (fast path). */
  private async verifyManifest(manifestPath: string, info: ModelInfo): Promise<boolean> {
    if (!existsSync(manifestPath)) return false;
    try {
      const manifest = JSON.parse(await readFile(manifestPath, 'utf-8')) as Record<string, string>;
      // Check all registry files are in manifest with matching hashes
      for (const file of info.files) {
        if (manifest[file.localPath] !== file.sha256) return false;
        // Also verify file exists on disk
        if (!existsSync(join(dirname(manifestPath), file.localPath))) return false;
      }
      return true;
    } catch {
      return false;
    }
  }

  /** Write manifest after successful download. */
  private async writeManifest(manifestPath: string, info: ModelInfo): Promise<void> {
    const manifest: Record<string, string> = {};
    for (const file of info.files) {
      manifest[file.localPath] = file.sha256;
    }
    await writeFile(manifestPath, JSON.stringify(manifest, null, 2), 'utf-8');
  }

  /** Compute SHA-256 of a file on disk. */
  private async computeFileHash(filePath: string): Promise<string> {
    const content = await readFile(filePath);
    return createHash('sha256').update(content).digest('hex');
  }
}
