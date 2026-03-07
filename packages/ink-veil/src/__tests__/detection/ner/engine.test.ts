import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ─── Hoisted state shared between vi.mock factory and tests ─────────────────

const { behaviorRef } = vi.hoisted(() => ({
  behaviorRef: { current: 'normal' as 'normal' | 'init-error' | 'exit-early' },
}));

// ─── Mock node:worker_threads ────────────────────────────────────────────────
// The class must be defined INSIDE the vi.mock factory to avoid hoisting issues.

vi.mock('node:worker_threads', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:worker_threads')>();
  const { EventEmitter } = await import('node:events');

  class MockWorker extends EventEmitter {
    private _terminated = false;

    constructor(_path: string, _opts: { workerData: unknown }) {
      super();
      setImmediate(() => this._simulateStart());
    }

    private _simulateStart(): void {
      const b = behaviorRef.current;
      if (b === 'init-error') {
        this.emit('message', { type: 'error', message: 'Model load failed' });
      } else if (b === 'exit-early') {
        this.emit('exit', 1);
      } else {
        this.emit('message', { type: 'ready' });
      }
    }

    postMessage(msg: { type: string; id?: string; text?: string; labels?: string[]; threshold?: number }): void {
      if (this._terminated) return;
      if (msg.type === 'shutdown') {
        setImmediate(() => this.emit('exit', 0));
        return;
      }
      if (msg.type === 'detect' && msg.id) {
        const id = msg.id;
        setImmediate(() => {
          const spans = this._mockInference(msg.text ?? '', msg.labels ?? [], msg.threshold ?? 0.2);
          this.emit('message', { type: 'result', id, spans });
        });
      }
    }

    async terminate(): Promise<void> {
      this._terminated = true;
      this.emit('exit', 0);
    }

    private _mockInference(text: string, labels: string[], threshold: number) {
      const results: Array<{ start: number; end: number; text: string; label: string; score: number }> = [];
      if (text.includes('홍길동') && labels.includes('PER')) {
        const s = text.indexOf('홍길동');
        results.push({ start: s, end: s + 3, text: '홍길동', label: 'PER', score: 0.95 });
      }
      if (text.includes('삼성전자') && labels.includes('ORG')) {
        const s = text.indexOf('삼성전자');
        results.push({ start: s, end: s + 4, text: '삼성전자', label: 'ORG', score: 0.88 });
      }
      return results.filter((r) => r.score >= threshold);
    }
  }

  return { ...actual, Worker: MockWorker };
});

// ─── Imports after mock ───────────────────────────────────────────────────────

import { NEREngine } from '../../../detection/ner/engine.js';
import { NERModelError } from '../../../errors/types.js';

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('NEREngine', () => {
  let engine: NEREngine;

  beforeEach(() => {
    behaviorRef.current = 'normal';
    engine = new NEREngine({ modelDir: '/fake/models/test-model', modelId: 'test-model', labels: ['PER', 'ORG', 'LOC'] });
  });

  afterEach(async () => {
    await engine.dispose();
    vi.restoreAllMocks();
  });

  describe('init()', () => {
    it('initialises successfully', async () => {
      await expect(engine.init()).resolves.toBeUndefined();
    });

    it('is idempotent — second init() is a no-op', async () => {
      await engine.init();
      await expect(engine.init()).resolves.toBeUndefined();
    });

    it('throws NERModelError when worker emits init error', async () => {
      behaviorRef.current = 'init-error';
      const errEngine = new NEREngine({ modelDir: '/fake/models/test-model', modelId: 'test-model' });
      await expect(errEngine.init()).rejects.toThrow(NERModelError);
    });

    it('throws NERModelError when worker exits early', async () => {
      behaviorRef.current = 'exit-early';
      const errEngine = new NEREngine({ modelDir: '/fake/models/test-model', modelId: 'test-model' });
      await expect(errEngine.init()).rejects.toThrow(NERModelError);
    });
  });

  describe('detect()', () => {
    it('throws if called before init()', async () => {
      await expect(engine.detect('test')).rejects.toThrow(NERModelError);
    });

    it('returns PER span for "홍길동"', async () => {
      await engine.init();
      const spans = await engine.detect('홍길동은 삼성전자에 다닌다', ['PER', 'ORG']);
      const per = spans.find((s) => s.category === 'PER');
      expect(per).toBeDefined();
      expect(per!.text).toBe('홍길동');
      expect(per!.start).toBe(0);
      expect(per!.end).toBe(3);
      expect(per!.method).toBe('NER');
      expect(per!.confidence).toBeCloseTo(0.95);
    });

    it('returns ORG span for "삼성전자"', async () => {
      await engine.init();
      const spans = await engine.detect('홍길동은 삼성전자에 다닌다', ['PER', 'ORG']);
      const org = spans.find((s) => s.category === 'ORG');
      expect(org).toBeDefined();
      expect(org!.text).toBe('삼성전자');
      expect(org!.method).toBe('NER');
    });

    it('returns both PER and ORG spans', async () => {
      await engine.init();
      const spans = await engine.detect('홍길동은 삼성전자에 다닌다', ['PER', 'ORG']);
      expect(spans.length).toBe(2);
    });

    it('filters spans below threshold', async () => {
      await engine.init();
      const spans = await engine.detect('홍길동은 삼성전자에 다닌다', ['PER', 'ORG'], 0.99);
      expect(spans.length).toBe(0);
    });
  });

  describe('dispose()', () => {
    it('terminates the worker thread', async () => {
      await engine.init();
      await expect(engine.dispose()).resolves.toBeUndefined();
    });

    it('is safe to call multiple times', async () => {
      await engine.init();
      await engine.dispose();
      await expect(engine.dispose()).resolves.toBeUndefined();
    });
  });
});
