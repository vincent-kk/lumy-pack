import { describe, it, expect } from 'vitest';
import { countTestCases, type RawTestFile } from '../../../metrics/test-counter.js';

describe('test-counter', () => {
  it('should count top-level it() calls as basic tests', () => {
    const file: RawTestFile = {
      filePath: '/app/auth/__tests__/auth.spec.ts',
      content: `
describe('auth', () => {
  it('should login', () => {});
  it('should logout', () => {});
  test('should refresh token', () => {});
});
`,
    };
    const result = countTestCases(file);
    expect(result.total).toBe(3);
    expect(result.basic).toBe(3);
    expect(result.complex).toBe(0);
    expect(result.fileType).toBe('spec');
  });

  it('should count nested describe it() calls as complex tests', () => {
    const file: RawTestFile = {
      filePath: '/app/auth/__tests__/auth.spec.ts',
      content: `
describe('auth', () => {
  it('should login', () => {});
  describe('edge cases', () => {
    it('should handle timeout', () => {});
    it('should handle network error', () => {});
  });
});
`,
    };
    const result = countTestCases(file);
    expect(result.total).toBe(3);
    expect(result.basic).toBe(1);
    expect(result.complex).toBe(2);
  });

  it('should detect .test.ts as test file type', () => {
    const file: RawTestFile = {
      filePath: '/app/auth/__tests__/auth.test.ts',
      content: `
describe('auth regression', () => {
  it('should not regress', () => {});
});
`,
    };
    const result = countTestCases(file);
    expect(result.fileType).toBe('test');
  });

  it('should detect .spec.ts as spec file type', () => {
    const file: RawTestFile = {
      filePath: '/app/auth/__tests__/auth.spec.ts',
      content: `describe('x', () => { it('y', () => {}); });`,
    };
    expect(countTestCases(file).fileType).toBe('spec');
  });

  it('should handle deeply nested describes', () => {
    const file: RawTestFile = {
      filePath: '/app/x.spec.ts',
      content: `
describe('a', () => {
  it('basic', () => {});
  describe('b', () => {
    it('complex1', () => {});
    describe('c', () => {
      it('complex2', () => {});
    });
  });
});
`,
    };
    const result = countTestCases(file);
    expect(result.basic).toBe(1);
    expect(result.complex).toBe(2);
    expect(result.total).toBe(3);
  });

  it('should handle file with no tests', () => {
    const file: RawTestFile = {
      filePath: '/app/x.spec.ts',
      content: `// empty file`,
    };
    const result = countTestCases(file);
    expect(result.total).toBe(0);
    expect(result.basic).toBe(0);
    expect(result.complex).toBe(0);
  });

  it('should handle it.each and test.each as single test', () => {
    const file: RawTestFile = {
      filePath: '/app/x.spec.ts',
      content: `
describe('math', () => {
  it.each([1,2,3])('should compute %i', (n) => {});
  test.each([4,5])('should handle %i', (n) => {});
});
`,
    };
    const result = countTestCases(file);
    expect(result.total).toBe(2);
  });
});
