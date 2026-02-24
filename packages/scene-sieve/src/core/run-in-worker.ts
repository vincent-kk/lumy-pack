import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Worker } from 'node:worker_threads';

import type {
  ProgressPhase,
  SieveInput,
  SieveOptions,
  SieveOptionsBase,
  SieveResult,
} from '../types/index.js';

export type SieveWorkerOptions = Omit<SieveOptionsBase, 'onProgress'> &
  SieveInput;

/**
 * Run the pipeline, choosing the best execution strategy:
 *
 * - Production (bundled .mjs): Worker thread — spinner never freezes
 * - Dev mode (tsx .ts): Main thread — simpler, spinner may stutter during CPU work
 */
export async function runPipelineInWorker(
  options: SieveWorkerOptions,
  onProgress: (phase: ProgressPhase, percent: number) => void,
): Promise<SieveResult> {
  const currentFile = fileURLToPath(import.meta.url);

  // Dev mode: run directly in main thread
  if (!currentFile.endsWith('.mjs')) {
    const { runPipeline } = await import('./orchestrator.js');
    return runPipeline({ ...options, onProgress } as SieveOptions);
  }

  // Production: run in worker thread
  const workerPath = join(dirname(currentFile), 'pipeline-worker.mjs');

  return new Promise((resolve, reject) => {
    const worker = new Worker(workerPath, { workerData: options });

    worker.on(
      'message',
      (msg: {
        type: string;
        phase?: ProgressPhase;
        percent?: number;
        result?: SieveResult;
        message?: string;
      }) => {
        if (msg.type === 'progress' && msg.phase && msg.percent !== undefined) {
          onProgress(msg.phase, msg.percent);
        } else if (msg.type === 'result') {
          resolve(msg.result!);
          worker.terminate();
        } else if (msg.type === 'error') {
          reject(new Error(msg.message));
          worker.terminate();
        }
      },
    );

    worker.on('error', reject);

    worker.on('exit', (code) => {
      if (code !== 0 && code !== 1) {
        reject(new Error(`Worker exited with code ${code}`));
      }
    });
  });
}
