import { Worker } from 'node:worker_threads';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';
import type { DetectionSpan } from '../types.js';
import { NERModelError } from '../../errors/types.js';

export interface NEREngineOptions {
  /** Full path to the model directory (e.g. ~/.ink-veil/models/gliner_multi-v2.1) */
  modelDir: string;
  /** Model ID (directory basename, e.g. "gliner_multi-v2.1") */
  modelId: string;
  /** Default labels for detection. */
  labels?: string[];
  /** Minimum confidence threshold (default: 0.5). */
  threshold?: number;
}

interface PendingRequest {
  resolve: (spans: DetectionSpan[]) => void;
  reject: (err: Error) => void;
}

/**
 * NER detection engine.
 *
 * Spawns a Worker Thread with the ONNX model loaded. Inference requests
 * are sent via IPC and responses are returned as DetectionSpan[].
 * Call dispose() when done to terminate the worker thread.
 */
export class NEREngine {
  private worker: Worker | null = null;
  private pending = new Map<string, PendingRequest>();
  private reqCounter = 0;
  private ready = false;
  private readonly options: Required<NEREngineOptions>;

  constructor(options: NEREngineOptions) {
    this.options = {
      labels: ['PER', 'ORG', 'LOC', 'DATE', 'PRODUCT'],
      threshold: 0.5,
      ...options,
    };
  }

  /** Spawn the worker thread and wait for the 'ready' signal. */
  async init(): Promise<void> {
    if (this.ready) return;

    const workerPath = join(dirname(fileURLToPath(import.meta.url)), 'worker.mjs');

    return new Promise((resolve, reject) => {
      const worker = new Worker(workerPath, {
        workerData: { modelDir: this.options.modelDir, modelId: this.options.modelId },
      });

      worker.on('message', (msg: { type: string; id?: string; spans?: unknown[]; message?: string }) => {
        if (msg.type === 'ready') {
          this.ready = true;
          resolve();
          return;
        }

        if (msg.type === 'result' && msg.id) {
          const req = this.pending.get(msg.id);
          if (req) {
            this.pending.delete(msg.id);
            req.resolve(this.toDetectionSpans(msg.spans ?? []));
          }
          return;
        }

        if (msg.type === 'error') {
          if (msg.id) {
            const req = this.pending.get(msg.id);
            if (req) {
              this.pending.delete(msg.id);
              req.reject(new NERModelError(msg.message ?? 'NER inference error', { id: msg.id }));
            }
          } else {
            reject(new NERModelError(msg.message ?? 'NER worker init error'));
          }
        }
      });

      worker.on('error', (err) => {
        if (!this.ready) reject(new NERModelError(`Worker thread error: ${err.message}`));
        for (const [, req] of this.pending) {
          req.reject(new NERModelError(`Worker thread error: ${err.message}`));
        }
        this.pending.clear();
      });

      worker.on('exit', (code) => {
        if (!this.ready) reject(new NERModelError(`Worker exited prematurely with code ${code}`));
        for (const [, req] of this.pending) {
          req.reject(new NERModelError(`Worker exited with code ${code}`));
        }
        this.pending.clear();
        this.worker = null;
        this.ready = false;
      });

      this.worker = worker;
    });
  }

  /**
   * Detect entities in `text`.
   * @param text    Source text.
   * @param labels  Entity labels (overrides constructor default).
   */
  async detect(
    text: string,
    labels?: string[],
    threshold?: number,
  ): Promise<DetectionSpan[]> {
    if (!this.ready || !this.worker) {
      throw new NERModelError('NEREngine not initialised. Call init() first.');
    }

    const id = String(++this.reqCounter);
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.worker!.postMessage({
        type: 'detect',
        id,
        text,
        labels: labels ?? this.options.labels,
        threshold: threshold ?? this.options.threshold,
      });
    });
  }

  /** Terminate the worker thread and release model memory. */
  async dispose(): Promise<void> {
    if (!this.worker) return;
    this.worker.postMessage({ type: 'shutdown' });
    await this.worker.terminate();
    this.worker = null;
    this.ready = false;
  }

  private toDetectionSpans(raw: unknown[]): DetectionSpan[] {
    return (raw as Array<{ start: number; end: number; text: string; label: string; score: number }>)
      .map((item) => ({
        start: item.start,
        end: item.end,
        text: item.text,
        category: item.label,
        method: 'NER' as const,
        confidence: item.score,
      }));
  }
}
