import { describe, it, expect } from 'vitest';
import { Dictionary } from '../../dictionary/dictionary.js';

describe('Dictionary snapshot/restore', () => {
  it('snapshot returns deep copy — mutation does not affect snapshot', () => {
    const dict = Dictionary.create();
    const entry = dict.addEntity('홍길동', 'PER', 'NER', 0.95);
    const snap = dict.snapshot();

    // Mutate via addEntity (increments occurrenceCount)
    dict.addEntity('홍길동', 'PER', 'NER', 0.95);
    expect(entry.occurrenceCount).toBe(2);
    // Snapshot should have occurrenceCount=1
    expect(snap[0].occurrenceCount).toBe(1);
  });

  it('restore rebuilds forward index', () => {
    const dict = Dictionary.create();
    dict.addEntity('홍길동', 'PER', 'NER', 0.95);
    const snap = dict.snapshot();
    dict.addEntity('김철수', 'PER', 'NER', 0.85);
    dict.restore(snap);
    expect(dict.lookup('김철수', 'PER')).toBeUndefined();
    expect(dict.lookup('홍길동', 'PER')).toBeDefined();
  });

  it('restore rebuilds reverse index', () => {
    const dict = Dictionary.create();
    const entry = dict.addEntity('홍길동', 'PER', 'NER', 0.95);
    const snap = dict.snapshot();
    dict.restore(snap);
    expect(dict.reverseLookup(entry.tokenPlain)).toBeDefined();
  });

  it('restore rebuilds category index', () => {
    const dict = Dictionary.create();
    dict.addEntity('홍길동', 'PER', 'NER', 0.95);
    const snap = dict.snapshot();
    dict.addEntity('삼성전자', 'ORG', 'REGEX', 1.0);
    dict.restore(snap);
    expect(dict.getCategories()).toEqual(['PER']);
    expect(dict.getByCategory('ORG')).toHaveLength(0);
  });

  it('restore resets counter — new entries continue from correct position', () => {
    const dict = Dictionary.create();
    dict.addEntity('A', 'PER', 'MANUAL', 1.0); // PER_001
    dict.addEntity('B', 'PER', 'MANUAL', 1.0); // PER_002
    const snap = dict.snapshot();
    dict.addEntity('C', 'PER', 'MANUAL', 1.0); // PER_003
    dict.restore(snap);
    const next = dict.addEntity('D', 'PER', 'MANUAL', 1.0);
    expect(next.id).toBe('PER_003');
  });

  it('toJSON/fromJSON round-trip preserves all data', () => {
    const dict = Dictionary.create('tag');
    dict.addEntity('홍길동', 'PER', 'NER', 0.95, 'doc-1.txt');
    dict.addEntity('삼성전자', 'ORG', 'REGEX', 1.0, 'doc-1.txt');

    const json = dict.toJSON();
    const restored = Dictionary.fromJSON(json);

    expect(restored.size).toBe(2);
    expect(restored.tokenMode).toBe('tag');

    const per = restored.lookup('홍길동', 'PER');
    expect(per).toBeDefined();
    expect(per?.addedFromDocument).toBe('doc-1.txt');
    expect(per?.method).toBe('NER');

    const org = restored.lookup('삼성전자', 'ORG');
    expect(org).toBeDefined();
    expect(org?.method).toBe('REGEX');
  });
});
