import { describe, it, expect } from 'vitest';
import { decide } from '../../../metrics/decision-tree.js';

describe('decision-tree', () => {
  it('should return "ok" when test count <= 15', () => {
    const result = decide({ testCount: 10, lcom4: 1, cyclomaticComplexity: 5 });
    expect(result.action).toBe('ok');
  });

  it('should return "split" when test count > 15 and LCOM4 >= 2', () => {
    const result = decide({ testCount: 16, lcom4: 2, cyclomaticComplexity: 10 });
    expect(result.action).toBe('split');
    expect(result.reason).toContain('LCOM4');
  });

  it('should return "compress" when test count > 15, LCOM4 = 1, CC > 15', () => {
    const result = decide({ testCount: 20, lcom4: 1, cyclomaticComplexity: 20 });
    expect(result.action).toBe('compress');
    expect(result.reason).toContain('cyclomatic');
  });

  it('should return "parameterize" when test count > 15, LCOM4 = 1, CC <= 15', () => {
    const result = decide({ testCount: 18, lcom4: 1, cyclomaticComplexity: 10 });
    expect(result.action).toBe('parameterize');
    expect(result.reason).toContain('test');
  });

  it('should prioritize split over compress (LCOM4 >= 2 takes precedence)', () => {
    const result = decide({ testCount: 20, lcom4: 3, cyclomaticComplexity: 25 });
    expect(result.action).toBe('split');
  });

  it('should include metrics in the result', () => {
    const metrics = { testCount: 16, lcom4: 2, cyclomaticComplexity: 10 };
    const result = decide(metrics);
    expect(result.metrics).toEqual(metrics);
  });

  it('should return "ok" at exactly 15 test cases', () => {
    const result = decide({ testCount: 15, lcom4: 3, cyclomaticComplexity: 30 });
    expect(result.action).toBe('ok');
  });
});
