import { describe, it, expect } from 'vitest';
import { TokenGenerator } from '../../dictionary/token-generator.js';

describe('TokenGenerator', () => {
  it('generates sequential IDs starting at 001', () => {
    const gen = new TokenGenerator();
    expect(gen.next('PER')).toBe('PER_001');
    expect(gen.next('PER')).toBe('PER_002');
    expect(gen.next('PER')).toBe('PER_003');
  });

  it('each category has independent counter', () => {
    const gen = new TokenGenerator();
    expect(gen.next('PER')).toBe('PER_001');
    expect(gen.next('ORG')).toBe('ORG_001');
    expect(gen.next('PER')).toBe('PER_002');
  });

  it('dynamic width: IDs 001-999 use 3 digits', () => {
    const gen = new TokenGenerator();
    for (let i = 1; i < 999; i++) gen.next('CAT');
    const id999 = gen.next('CAT');
    expect(id999).toBe('CAT_999');
  });

  it('dynamic width: ID 1000 uses 4 digits', () => {
    const gen = new TokenGenerator();
    for (let i = 0; i < 999; i++) gen.next('CAT');
    const id1000 = gen.next('CAT');
    expect(id1000).toBe('CAT_1000');
  });

  it('initFromExisting sets counter to max ID', () => {
    const gen = new TokenGenerator();
    gen.initFromExisting('PER', 5);
    expect(gen.next('PER')).toBe('PER_006');
  });

  it('initFromExisting does not downgrade existing counter', () => {
    const gen = new TokenGenerator();
    gen.initFromExisting('PER', 10);
    gen.initFromExisting('PER', 3); // lower — should not override
    expect(gen.next('PER')).toBe('PER_011');
  });

  it('exportCounters / importCounters round-trip', () => {
    const gen = new TokenGenerator();
    gen.next('PER');
    gen.next('PER');
    gen.next('ORG');
    const counters = gen.exportCounters();

    const gen2 = new TokenGenerator();
    gen2.importCounters(counters);
    expect(gen2.next('PER')).toBe('PER_003');
    expect(gen2.next('ORG')).toBe('ORG_002');
  });

  it('getCounter returns 0 for unused category', () => {
    const gen = new TokenGenerator();
    expect(gen.getCounter('UNKNOWN')).toBe(0);
  });
});
