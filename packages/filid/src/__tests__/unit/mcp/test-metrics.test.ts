import { describe, it, expect } from 'vitest';
import { handleTestMetrics } from '../../../mcp/tools/test-metrics.js';

describe('test-metrics tool', () => {
  describe('action: count', () => {
    it('should count test cases from source content', () => {
      const result = handleTestMetrics({
        action: 'count',
        files: [
          {
            filePath: '/app/src/__tests__/auth.spec.ts',
            content: [
              "it('should login', () => {});",
              "it('should logout', () => {});",
              "it('should validate', () => {});",
            ].join('\n'),
          },
        ],
      });
      expect(result.counts).toBeDefined();
      expect(result.counts![0].total).toBe(3);
    });
  });

  describe('action: check-312', () => {
    it('should detect 3+12 rule violation', () => {
      const lines = Array.from({ length: 16 }, (_, i) =>
        `it('test ${i}', () => {});`
      ).join('\n');
      const result = handleTestMetrics({
        action: 'check-312',
        files: [{ filePath: '/app/x.spec.ts', content: lines }],
      });
      expect(result.violations).toBeDefined();
      expect(result.violations!.length).toBeGreaterThan(0);
    });

    it('should pass when under threshold', () => {
      const lines = Array.from({ length: 10 }, (_, i) =>
        `it('test ${i}', () => {});`
      ).join('\n');
      const result = handleTestMetrics({
        action: 'check-312',
        files: [{ filePath: '/app/x.spec.ts', content: lines }],
      });
      expect(result.violations).toHaveLength(0);
    });
  });

  describe('action: decide', () => {
    it('should recommend split when LCOM4 >= 2', () => {
      const result = handleTestMetrics({
        action: 'decide',
        decisionInput: {
          testCount: 20,
          lcom4: 3,
          cyclomaticComplexity: 10,
        },
      });
      expect(result.decision?.action).toBe('split');
    });

    it('should recommend compress when CC > 15', () => {
      const result = handleTestMetrics({
        action: 'decide',
        decisionInput: {
          testCount: 20,
          lcom4: 1,
          cyclomaticComplexity: 20,
        },
      });
      expect(result.decision?.action).toBe('compress');
    });
  });

  describe('error handling', () => {
    it('should return error for unknown action', () => {
      const result = handleTestMetrics({
        action: 'unknown' as any,
      });
      expect(result.error).toBeDefined();
    });
  });
});
