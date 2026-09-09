import { EventEmitter } from 'node:events';
import { Worker } from 'node:worker_threads';

import { describe, expect, it, vi } from 'vitest';

import { runPipelineInWorker } from '../../core/orchestrator/worker/run-in-worker.js';

vi.mock('node:url', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:url')>();
  return {
    ...actual,
    fileURLToPath: (url: string | URL) =>
      String(url).includes('/core/orchestrator/worker/run-in-worker.ts')
        ? '/bundle/run-in-worker.mjs'
        : actual.fileURLToPath(url),
  };
});
vi.mock('node:worker_threads', () => ({ Worker: vi.fn() }));

describe('runPipelineInWorker settlement', () => {
  it.each([0, 1, 2])('rejects exit %s without a result', async (code) => {
    const worker = Object.assign(new EventEmitter(), { terminate: vi.fn() });
    vi.mocked(Worker).mockImplementation(() => worker as unknown as Worker);
    let outcome: unknown = 'pending';
    const result = runPipelineInWorker(
      { mode: 'frames', inputFrames: [] },
      vi.fn(),
    );
    void result.then(
      (value) => {
        outcome = value;
      },
      (error: unknown) => {
        outcome = error;
      },
    );
    worker.emit('exit', code);
    await new Promise<void>((resolve) => setImmediate(resolve));
    expect(outcome).toBeInstanceOf(Error);
    expect((outcome as Error).message).toContain(
      `Worker exited with code ${code}`,
    );
  });

  it('keeps a received result when termination emits exit 1', async () => {
    const worker = Object.assign(new EventEmitter(), { terminate: vi.fn() });
    vi.mocked(Worker).mockImplementation(() => worker as unknown as Worker);
    const result = runPipelineInWorker(
      { mode: 'frames', inputFrames: [] },
      vi.fn(),
    );
    const value = { success: true };
    worker.emit('message', { type: 'result', result: value });
    worker.emit('exit', 1);
    await expect(result).resolves.toBe(value);
    expect(worker.terminate).toHaveBeenCalledOnce();
  });
});
