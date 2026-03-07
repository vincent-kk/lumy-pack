import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { mkdtemp, rm, mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

// We import after mocking so the module picks up the mock.
vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs')>();
  return { ...actual };
});

import { ModelManager, MODEL_REGISTRY } from '../../../detection/ner/model-manager.js';
import { NERModelError } from '../../../errors/types.js';

// ─── helpers ────────────────────────────────────────────────────────────────

function sha256(data: Buffer | string): string {
  return createHash('sha256').update(data).digest('hex');
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

  it('reports installed + checksumOk when model.onnx and .checksum match', async () => {
    const modelId = 'gliner_multi-v2.1';
    const info = MODEL_REGISTRY[modelId]!;
    const modelDir = join(tmpDir, 'models', modelId);
    await mkdir(modelDir, { recursive: true });

    // Write a fake model.onnx and matching .checksum
    const fakeContent = Buffer.from('fake-model-data');
    await writeFile(join(modelDir, 'model.onnx'), fakeContent);
    // Store the REGISTRY sha256 directly (simulating correct download)
    await writeFile(join(modelDir, '.checksum'), info.sha256, 'utf-8');

    const manager = new ModelManager(tmpDir);
    const statuses = await manager.status();
    const s = statuses.find((x) => x.modelId === modelId)!;

    expect(s.installed).toBe(true);
    expect(s.checksumOk).toBe(true);
  });

  it('reports checksumOk=false on checksum mismatch', async () => {
    const modelId = 'gliner_multi-v2.1';
    const modelDir = join(tmpDir, 'models', modelId);
    await mkdir(modelDir, { recursive: true });

    await writeFile(join(modelDir, 'model.onnx'), Buffer.from('corrupted'));
    await writeFile(join(modelDir, '.checksum'), 'wrong-hash', 'utf-8');

    const manager = new ModelManager(tmpDir);
    const statuses = await manager.status();
    const s = statuses.find((x) => x.modelId === modelId)!;

    expect(s.installed).toBe(true);
    expect(s.checksumOk).toBe(false);
  });
});

describe('ModelManager.ensureModel() — mock download', () => {
  it('returns cached path without downloading when checksum matches', async () => {
    const modelId = 'gliner_multi-v2.1';
    const info = MODEL_REGISTRY[modelId]!;
    const modelDir = join(tmpDir, 'models', modelId);
    await mkdir(modelDir, { recursive: true });

    await writeFile(join(modelDir, 'model.onnx'), Buffer.from('cached'));
    await writeFile(join(modelDir, '.checksum'), info.sha256, 'utf-8');

    // No fetch should be called
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    const manager = new ModelManager(tmpDir);
    const result = await manager.ensureModel(modelId);

    expect(result).toBe(join(modelDir, 'model.onnx'));
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('throws NERModelError for unknown modelId', async () => {
    const manager = new ModelManager(tmpDir);
    await expect(manager.ensureModel('unknown-model')).rejects.toThrow(NERModelError);
  });

  it('downloads and verifies SHA-256 when model not present', async () => {
    const modelId = 'gliner_multi-v2.1';
    const fakeContent = Buffer.from('mock-onnx-model-content');
    const correctHash = sha256(fakeContent);

    // Patch MODEL_REGISTRY sha256 for this test
    const original = MODEL_REGISTRY[modelId]!.sha256;
    MODEL_REGISTRY[modelId]!.sha256 = correctHash;

    // Mock global fetch to return fake model content
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      body: {
        getReader: () => {
          let done = false;
          return {
            read: async () => {
              if (done) return { done: true, value: undefined };
              done = true;
              return { done: false, value: new Uint8Array(fakeContent) };
            },
            releaseLock: () => {},
          };
        },
      },
    }));

    const manager = new ModelManager(tmpDir);
    const result = await manager.ensureModel(modelId);

    expect(result).toContain('model.onnx');

    // Restore
    MODEL_REGISTRY[modelId]!.sha256 = original;
  });

  it('throws NERModelError on SHA-256 mismatch after download', async () => {
    const modelId = 'gliner_multi-v2.1';
    const fakeContent = Buffer.from('bad-content');

    // Patch sha256 to something that won't match fakeContent
    const original = MODEL_REGISTRY[modelId]!.sha256;
    MODEL_REGISTRY[modelId]!.sha256 = 'expected-hash-that-wont-match';

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      body: {
        getReader: () => {
          let done = false;
          return {
            read: async () => {
              if (done) return { done: true, value: undefined };
              done = true;
              return { done: false, value: new Uint8Array(fakeContent) };
            },
            releaseLock: () => {},
          };
        },
      },
    }));

    const manager = new ModelManager(tmpDir);
    await expect(manager.ensureModel(modelId)).rejects.toThrow(NERModelError);

    // Restore
    MODEL_REGISTRY[modelId]!.sha256 = original;
  });
});

describe('ModelManager fallback chain', () => {
  it('returns null and writes warning when all models fail', async () => {
    const stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);

    // Make all downloads fail
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network error')));

    const manager = new ModelManager(tmpDir);
    const result = await manager.ensureWithFallback();

    expect(result).toBeNull();
    const calls = stderrSpy.mock.calls.map((c) => String(c[0]));
    expect(calls.some((m) => m.includes('NER model unavailable'))).toBe(true);
  });
});

describe('ModelManager.list()', () => {
  it('returns only installed models', async () => {
    const modelId = 'gliner_multi-v2.1';
    const info = MODEL_REGISTRY[modelId]!;
    const modelDir = join(tmpDir, 'models', modelId);
    await mkdir(modelDir, { recursive: true });
    await writeFile(join(modelDir, 'model.onnx'), Buffer.from('fake'));
    await writeFile(join(modelDir, '.checksum'), info.sha256, 'utf-8');

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
    const modelDir = join(tmpDir, 'models', modelId);
    await mkdir(modelDir, { recursive: true });
    await writeFile(join(modelDir, 'model.onnx'), Buffer.from('fake'));

    const manager = new ModelManager(tmpDir);
    await manager.removeModel(modelId);

    // After removal, list should show not installed
    const listed = await manager.list();
    expect(listed.find((s) => s.modelId === modelId)).toBeUndefined();
  });

  it('throws NERModelError for unknown model', async () => {
    const manager = new ModelManager(tmpDir);
    await expect(manager.removeModel('unknown-model')).rejects.toThrow(NERModelError);
  });

  it('does not throw if model was not installed (force remove)', async () => {
    const manager = new ModelManager(tmpDir);
    // model not installed — rm with force:true should not throw
    await expect(manager.removeModel('gliner_multi-v2.1')).resolves.toBeUndefined();
  });
});
