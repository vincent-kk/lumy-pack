import { parentPort, workerData } from 'node:worker_threads';

import type { ProgressPhase, SieveOptions } from '../types/index.js';

import { runPipeline } from './orchestrator.js';

interface WorkerMessage {
  type: 'progress' | 'result' | 'error';
  phase?: ProgressPhase;
  percent?: number;
  result?: unknown;
  message?: string;
}

const options = workerData as Omit<SieveOptions, 'onProgress'>;

runPipeline({
  ...options,
  onProgress: (phase: ProgressPhase, percent: number) => {
    parentPort?.postMessage({
      type: 'progress',
      phase,
      percent,
    } satisfies WorkerMessage);
  },
} as SieveOptions)
  .then((result) => {
    parentPort?.postMessage({
      type: 'result',
      result,
    } satisfies WorkerMessage);
  })
  .catch((error: unknown) => {
    parentPort?.postMessage({
      type: 'error',
      message: error instanceof Error ? error.message : String(error),
    } satisfies WorkerMessage);
  });
