/**
 * Integration test: Sync Pipeline
 * Tests: code change → AST diff → dependency extraction → metrics
 */
import { describe, expect, it } from 'vitest';

import { calculateCC } from '../../ast/cyclomatic-complexity.js';
import { extractDependencies } from '../../ast/dependency-extractor.js';
import { calculateLCOM4 } from '../../ast/lcom4.js';
import { computeTreeDiff } from '../../ast/tree-diff.js';
import { decide } from '../../metrics/decision-tree.js';

describe('sync pipeline', () => {
  const oldSource = `
    import { readFile } from 'fs/promises';

    export class DataService {
      private cache: Map<string, string> = new Map();

      async get(key: string): Promise<string | undefined> {
        return this.cache.get(key);
      }

      async set(key: string, value: string): Promise<void> {
        this.cache.set(key, value);
      }
    }
  `;

  const newSource = `
    import { readFile } from 'fs/promises';
    import { Logger } from './logger.js';

    export class DataService {
      private cache: Map<string, string> = new Map();
      private logger: Logger;

      constructor(logger: Logger) {
        this.logger = logger;
      }

      async get(key: string): Promise<string | undefined> {
        this.logger.info('get', key);
        return this.cache.get(key);
      }

      async set(key: string, value: string): Promise<void> {
        this.logger.info('set', key);
        this.cache.set(key, value);
      }

      async delete(key: string): Promise<boolean> {
        this.logger.warn('delete', key);
        return this.cache.delete(key);
      }
    }

    export function createService(logger: Logger): DataService {
      return new DataService(logger);
    }
  `;

  it('should detect semantic changes between versions', async () => {
    const diff = await computeTreeDiff(oldSource, newSource);

    expect(diff.hasSemanticChanges).toBe(true);
    // DataService modified + createService added
    const modified = diff.changes.filter((c) => c.type === 'modified');
    const added = diff.changes.filter((c) => c.type === 'added');

    expect(modified.some((c) => c.name === 'DataService')).toBe(true);
    expect(added.some((c) => c.name === 'createService')).toBe(true);
  });

  it('should extract updated dependencies from new version', async () => {
    const deps = await extractDependencies(newSource, 'data-service.ts');

    expect(deps.imports).toHaveLength(2);
    expect(deps.imports.some((i) => i.source === './logger.js')).toBe(true);
    expect(deps.exports.some((e) => e.name === 'DataService')).toBe(true);
    expect(deps.exports.some((e) => e.name === 'createService')).toBe(true);
  });

  it('should measure LCOM4 for the updated class', async () => {
    const lcom4 = await calculateLCOM4(newSource, 'DataService');

    // All methods share logger and/or cache → expect LCOM4 = 1
    expect(lcom4.value).toBe(1);
    expect(lcom4.methodCount).toBeGreaterThanOrEqual(3);
    expect(lcom4.fieldCount).toBe(2);
  });

  it('should calculate cyclomatic complexity', async () => {
    const cc = await calculateCC(newSource, 'data-service.ts');

    expect(cc.fileTotal).toBeGreaterThan(0);
    expect(cc.perFunction.has('createService')).toBe(true);
  });

  it('should produce a decision based on combined metrics', async () => {
    const lcom4 = await calculateLCOM4(newSource, 'DataService');
    const cc = await calculateCC(newSource, 'data-service.ts');

    const decision = decide({
      testCount: 10,
      lcom4: lcom4.value,
      cyclomaticComplexity: cc.fileTotal,
    });

    // With LCOM4=1 and moderate CC, expect 'ok' or 'parameterize'
    expect(['ok', 'parameterize', 'compress']).toContain(decision.action);
    expect(decision.reason).toBeTruthy();
  });

  it('should detect when a class becomes fragmented after changes', async () => {
    const fragmentedSource = `
      export class MixedService {
        private db: any;
        private mailer: any;

        connect() { this.db = {}; }
        disconnect() { this.db = null; }
        sendEmail(to: string) { this.mailer.send(to); }
        getMailer() { return this.mailer; }
      }
    `;

    const lcom4 = await calculateLCOM4(fragmentedSource, 'MixedService');
    expect(lcom4.value).toBe(2);

    // testCount must exceed 15 to trigger LCOM4 check in decision tree
    const decision = decide({
      testCount: 20,
      lcom4: lcom4.value,
      cyclomaticComplexity: 4,
    });

    expect(decision.action).toBe('split');
  });
});
