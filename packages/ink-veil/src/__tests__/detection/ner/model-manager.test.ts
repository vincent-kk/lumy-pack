import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { mkdtemp, rm, mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';

vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs')>();
  return { ...actual };
});

import { ModelManager, MODEL_REGISTRY } from '../../../detection/ner/model-manager.js';
import type { ModelInfo } from '../../../detection/ner/model-manager.js';
import { NERModelError } from '../../../errors/types.js';

// ─── helpers ────────────────────────────────────────────────────────────────

function sha256(data: Buffer | string): string {
  return createHash('sha256').update(data).digest('hex');
}

/** Create a fake model directory with all files matching a given ModelInfo. */
async function createFakeModelFiles(
  modelDir: string,
  info: ModelInfo,
  overrides?: Partial<Record<string, Buffer>>,
): Promise<void> {
  for (const file of info.files) {
    const filePath = join(modelDir, file.localPath);
    const dir = join(filePath, '..');
    await mkdir(dir, { recursive: true });
    const content = overrides?.[file.localPath] ?? Buffer.from(`fake-${file.localPath}`);
    await writeFile(filePath, content);
  }
}

/** Create a manifest that matches registry hashes. */
async function createMatchingManifest(modelDir: string, info: ModelInfo): Promise<void> {
  const manifest: Record<string, string> = {};
  for (const file of info.files) {
    manifest[file.localPath] = file.sha256;
  }
  await writeFile(join(modelDir, '.manifest.json'), JSON.stringify(manifest), 'utf-8');
}

/** Mock fetch to return specific content for each file URL. */
function mockFetchForFiles(info: ModelInfo, fileContents: Record<string, Buffer>) {
  vi.stubGlobal('fetch', vi.fn().mockImplementation(async (url: string) => {
    const file = info.files.find((f) => url.endsWith('/' + f.repoPath));
    if (!file) {
      return { ok: false, status: 404, body: null };
    }
    const content = fileContents[file.localPath] ?? Buffer.from(`content-${file.localPath}`);
    let done = false;
    return {
      ok: true,
      status: 200,
      body: {
        getReader: () => ({
          read: async () => {
            if (done) return { done: true, value: undefined };
            done = true;
            return { done: false, value: new Uint8Array(content) };
          },
          releaseLock: () => {},
        }),
      },
    };
  }));
}

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await mkdtemp(join(tmpdir(), 'ink-veil-test-'));
});

afterEach(async () => {
  await rm(tmpDir, { recursive: true, force: true });
  vi.restoreAllMocks();
});

// ─── tests ──────────────────────────────────────────────────────────────────

describe('ModelManager.status()', () => {
  it('reports not-installed when model directory is empty', async () => {
    const manager = new ModelManager(tmpDir);
    const statuses = await manager.status();

    for (const s of statuses) {
      expect(s.installed).toBe(false);
      expect(s.checksumOk).toBeNull();
      expect(s.path).toBeNull();
    }
  });

  it('reports installed when manifest matches registry', async () => {
    const modelId = 'gliner_multi-v2.1';
    const info = MODEL_REGISTRY[modelId]!;
    const modelDir = join(tmpDir, 'models', modelId);

    await createFakeModelFiles(modelDir, info);
    await createMatchingManifest(modelDir, info);

    const manager = new ModelManager(tmpDir);
    const statuses = await manager.status();
    const s = statuses.find((x) => x.modelId === modelId)!;

    expect(s.installed).toBe(true);
    expect(s.checksumOk).toBe(true);
    expect(s.path).toBe(modelDir);
  });

  it('reports checksumOk=false when manifest hash mismatches', async () => {
    const modelId = 'gliner_multi-v2.1';
    const info = MODEL_REGISTRY[modelId]!;
    const modelDir = join(tmpDir, 'models', modelId);

    await createFakeModelFiles(modelDir, info);
    // Write manifest with wrong hashes
    const badManifest: Record<string, string> = {};
    for (const file of info.files) {
      badManifest[file.localPath] = 'wrong-hash';
    }
    await writeFile(join(modelDir, '.manifest.json'), JSON.stringify(badManifest), 'utf-8');

    const manager = new ModelManager(tmpDir);
    const statuses = await manager.status();
    const s = statuses.find((x) => x.modelId === modelId)!;

    expect(s.installed).toBe(false);
    expect(s.checksumOk).toBe(false);
  });
});

describe('ModelManager.ensureModel() — mock download', () => {
  it('returns cached ModelResult without downloading when manifest matches', async () => {
    const modelId = 'gliner_multi-v2.1';
    const info = MODEL_REGISTRY[modelId]!;
    const modelDir = join(tmpDir, 'models', modelId);

    await createFakeModelFiles(modelDir, info);
    await createMatchingManifest(modelDir, info);

    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    const manager = new ModelManager(tmpDir);
    const result = await manager.ensureModel(modelId);

    expect(result.modelDir).toBe(modelDir);
    expect(result.modelId).toBe(modelId);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('throws NERModelError for unknown modelId', async () => {
    const manager = new ModelManager(tmpDir);
    await expect(manager.ensureModel('unknown-model')).rejects.toThrow(NERModelError);
  });

  it('downloads all files in parallel and verifies SHA-256', async () => {
    const modelId = 'gliner_multi-v2.1';
    const info = MODEL_REGISTRY[modelId]!;

    // Create file contents and patch registry hashes to match
    const fileContents: Record<string, Buffer> = {};
    const originalHashes: Record<string, string> = {};

    for (const file of info.files) {
      const content = Buffer.from(`test-content-${file.localPath}`);
      fileContents[file.localPath] = content;
      originalHashes[file.localPath] = file.sha256;
      file.sha256 = sha256(content);
    }

    mockFetchForFiles(info, fileContents);

    const manager = new ModelManager(tmpDir);
    const result = await manager.ensureModel(modelId);

    expect(result.modelDir).toContain(modelId);
    expect(result.modelId).toBe(modelId);

    // Verify all files exist
    for (const file of info.files) {
      expect(existsSync(join(result.modelDir, file.localPath))).toBe(true);
    }

    // Verify manifest was written
    expect(existsSync(join(result.modelDir, '.manifest.json'))).toBe(true);

    // Verify fetch was called for each file
    expect(globalThis.fetch).toHaveBeenCalledTimes(info.files.length);

    // Restore original hashes
    for (const file of info.files) {
      file.sha256 = originalHashes[file.localPath]!;
    }
  });

  it('throws NERModelError on SHA-256 mismatch after download', async () => {
    const modelId = 'gliner_multi-v2.1';
    const info = MODEL_REGISTRY[modelId]!;

    // Don't patch hashes — content won't match registry hashes
    const fileContents: Record<string, Buffer> = {};
    for (const file of info.files) {
      fileContents[file.localPath] = Buffer.from('bad-content');
    }

    mockFetchForFiles(info, fileContents);

    const manager = new ModelManager(tmpDir);
    await expect(manager.ensureModel(modelId)).rejects.toThrow(NERModelError);
  });

  it('skips already-downloaded files with matching hash (incremental)', async () => {
    const modelId = 'gliner_multi-v2.1';
    const info = MODEL_REGISTRY[modelId]!;
    const modelDir = join(tmpDir, 'models', modelId);

    // Create file contents matching registry hashes
    const fileContents: Record<string, Buffer> = {};
    const originalHashes: Record<string, string> = {};

    for (const file of info.files) {
      const content = Buffer.from(`incremental-${file.localPath}`);
      fileContents[file.localPath] = content;
      originalHashes[file.localPath] = file.sha256;
      file.sha256 = sha256(content);
    }

    // Pre-write half the files to disk with correct content
    const halfCount = Math.floor(info.files.length / 2);
    for (let i = 0; i < halfCount; i++) {
      const file = info.files[i]!;
      const filePath = join(modelDir, file.localPath);
      await mkdir(join(filePath, '..'), { recursive: true });
      await writeFile(filePath, fileContents[file.localPath]!);
    }

    mockFetchForFiles(info, fileContents);

    const manager = new ModelManager(tmpDir);
    await manager.ensureModel(modelId);

    // Only the missing files should have been fetched
    const expectedDownloads = info.files.length - halfCount;
    expect(globalThis.fetch).toHaveBeenCalledTimes(expectedDownloads);

    // Restore
    for (const file of info.files) {
      file.sha256 = originalHashes[file.localPath]!;
    }
  });

  it('triggers full redownload when legacy .checksum exists (backward compat)', async () => {
    const modelId = 'gliner_multi-v2.1';
    const info = MODEL_REGISTRY[modelId]!;
    const modelDir = join(tmpDir, 'models', modelId);

    // Simulate old format: model.onnx + .checksum
    await mkdir(modelDir, { recursive: true });
    await writeFile(join(modelDir, 'model.onnx'), Buffer.from('old-model'));
    await writeFile(join(modelDir, '.checksum'), 'old-hash', 'utf-8');

    // Prepare mock content
    const fileContents: Record<string, Buffer> = {};
    const originalHashes: Record<string, string> = {};
    for (const file of info.files) {
      const content = Buffer.from(`upgrade-${file.localPath}`);
      fileContents[file.localPath] = content;
      originalHashes[file.localPath] = file.sha256;
      file.sha256 = sha256(content);
    }

    mockFetchForFiles(info, fileContents);

    const manager = new ModelManager(tmpDir);
    await manager.ensureModel(modelId);

    // Old files should be gone, new manifest should exist
    expect(existsSync(join(modelDir, '.checksum'))).toBe(false);
    expect(existsSync(join(modelDir, '.manifest.json'))).toBe(true);

    // All files should be downloaded (full redownload after legacy cleanup)
    expect(globalThis.fetch).toHaveBeenCalledTimes(info.files.length);

    // Restore
    for (const file of info.files) {
      file.sha256 = originalHashes[file.localPath]!;
    }
  });
});

describe('ModelManager fallback chain', () => {
  it('returns null and writes warning when all models fail', async () => {
    const stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);

    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network error')));

    const manager = new ModelManager(tmpDir);
    const result = await manager.ensureWithFallback();

    expect(result).toBeNull();
    const calls = stderrSpy.mock.calls.map((c) => String(c[0]));
    expect(calls.some((m) => m.includes('NER model unavailable'))).toBe(true);
  });

  it('returns ModelResult on success', async () => {
    const modelId = 'gliner_multi-v2.1';
    const info = MODEL_REGISTRY[modelId]!;
    const modelDir = join(tmpDir, 'models', modelId);

    await createFakeModelFiles(modelDir, info);
    await createMatchingManifest(modelDir, info);

    const manager = new ModelManager(tmpDir);
    const result = await manager.ensureWithFallback();

    expect(result).not.toBeNull();
    expect(result!.modelDir).toBe(modelDir);
    expect(result!.modelId).toBe(modelId);
  });
});

describe('ModelManager.list()', () => {
  it('returns only installed models', async () => {
    const modelId = 'gliner_multi-v2.1';
    const info = MODEL_REGISTRY[modelId]!;
    const modelDir = join(tmpDir, 'models', modelId);

    await createFakeModelFiles(modelDir, info);
    await createMatchingManifest(modelDir, info);

    const manager = new ModelManager(tmpDir);
    const listed = await manager.list();

    expect(listed.length).toBe(1);
    expect(listed[0]!.modelId).toBe(modelId);
    expect(listed[0]!.installed).toBe(true);
  });

  it('returns empty array when no models installed', async () => {
    const manager = new ModelManager(tmpDir);
    const listed = await manager.list();
    expect(listed).toHaveLength(0);
  });
});

describe('ModelManager.removeModel()', () => {
  it('removes installed model directory', async () => {
    const modelId = 'gliner_multi-v2.1';
    const info = MODEL_REGISTRY[modelId]!;
    const modelDir = join(tmpDir, 'models', modelId);

    await createFakeModelFiles(modelDir, info);
    await createMatchingManifest(modelDir, info);

    const manager = new ModelManager(tmpDir);
    await manager.removeModel(modelId);

    const listed = await manager.list();
    expect(listed.find((s) => s.modelId === modelId)).toBeUndefined();
  });

  it('throws NERModelError for unknown model', async () => {
    const manager = new ModelManager(tmpDir);
    await expect(manager.removeModel('unknown-model')).rejects.toThrow(NERModelError);
  });

  it('does not throw if model was not installed (force remove)', async () => {
    const manager = new ModelManager(tmpDir);
    await expect(manager.removeModel('gliner_multi-v2.1')).resolves.toBeUndefined();
  });
});
