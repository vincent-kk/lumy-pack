import { describe, it, expect } from 'vitest';
import {
  checkPromotionEligibility,
  type PromotionInput,
} from '../../../metrics/promotion-tracker.js';

describe('promotion-tracker', () => {
  it('should mark eligible when stable for >= 90 days with no failures', () => {
    const input: PromotionInput = {
      testFilePath: '/app/auth/__tests__/login.test.ts',
      specFilePath: '/app/auth/__tests__/login.spec.ts',
      stableDays: 90,
      lastFailure: null,
      caseCount: 5,
    };
    const result = checkPromotionEligibility(input);
    expect(result.eligible).toBe(true);
  });

  it('should not be eligible when stable for < 90 days', () => {
    const input: PromotionInput = {
      testFilePath: '/app/auth/__tests__/login.test.ts',
      specFilePath: '/app/auth/__tests__/login.spec.ts',
      stableDays: 60,
      lastFailure: null,
      caseCount: 5,
    };
    const result = checkPromotionEligibility(input);
    expect(result.eligible).toBe(false);
  });

  it('should not be eligible when there is a recent failure', () => {
    const input: PromotionInput = {
      testFilePath: '/app/auth/__tests__/login.test.ts',
      specFilePath: '/app/auth/__tests__/login.spec.ts',
      stableDays: 100,
      lastFailure: '2026-01-15T00:00:00Z',
      caseCount: 5,
    };
    const result = checkPromotionEligibility(input);
    expect(result.eligible).toBe(false);
  });

  it('should be eligible at exactly 90 days', () => {
    const input: PromotionInput = {
      testFilePath: '/app/x.test.ts',
      specFilePath: '/app/x.spec.ts',
      stableDays: 90,
      lastFailure: null,
      caseCount: 3,
    };
    expect(checkPromotionEligibility(input).eligible).toBe(true);
  });

  it('should preserve input fields in the result', () => {
    const input: PromotionInput = {
      testFilePath: '/app/x.test.ts',
      specFilePath: '/app/x.spec.ts',
      stableDays: 120,
      lastFailure: null,
      caseCount: 8,
    };
    const result = checkPromotionEligibility(input);
    expect(result.testFilePath).toBe('/app/x.test.ts');
    expect(result.specFilePath).toBe('/app/x.spec.ts');
    expect(result.stableDays).toBe(120);
    expect(result.caseCount).toBe(8);
  });

  it('should accept custom stability threshold', () => {
    const input: PromotionInput = {
      testFilePath: '/app/x.test.ts',
      specFilePath: '/app/x.spec.ts',
      stableDays: 60,
      lastFailure: null,
      caseCount: 3,
    };
    const result = checkPromotionEligibility(input, 30);
    expect(result.eligible).toBe(true);
  });
});
