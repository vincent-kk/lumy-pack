import { describe, expect, it } from 'vitest';

import { check312Rule } from '../../../metrics/three-plus-twelve.js';
import type { TestCaseCount } from '../../../types/metrics.js';

const specFile = (
  filePath: string,
  total: number,
  basic = 3,
  complex = total - 3,
): TestCaseCount => ({
  filePath,
  fileType: 'spec',
  total,
  basic: Math.min(basic, total),
  complex: Math.max(0, complex),
});

describe('three-plus-twelve', () => {
  it('should pass when all spec files are within limit', () => {
    const files = [
      specFile('/app/auth.spec.ts', 10),
      specFile('/app/user.spec.ts', 15),
    ];
    const result = check312Rule(files);
    expect(result.violated).toBe(false);
    expect(result.violatingFiles).toHaveLength(0);
  });

  it('should fail when a spec file exceeds 15 test cases', () => {
    const files = [
      specFile('/app/auth.spec.ts', 16),
      specFile('/app/user.spec.ts', 10),
    ];
    const result = check312Rule(files);
    expect(result.violated).toBe(true);
    expect(result.violatingFiles).toContain('/app/auth.spec.ts');
    expect(result.violatingFiles).toHaveLength(1);
  });

  it('should pass at exactly 15 test cases', () => {
    const files = [specFile('/app/auth.spec.ts', 15)];
    const result = check312Rule(files);
    expect(result.violated).toBe(false);
  });

  it('should report multiple violating files', () => {
    const files = [
      specFile('/app/a.spec.ts', 20),
      specFile('/app/b.spec.ts', 18),
      specFile('/app/c.spec.ts', 5),
    ];
    const result = check312Rule(files);
    expect(result.violated).toBe(true);
    expect(result.violatingFiles).toHaveLength(2);
  });

  it('should only check spec files, ignore test files', () => {
    const files: TestCaseCount[] = [
      {
        filePath: '/app/a.test.ts',
        fileType: 'test',
        total: 50,
        basic: 10,
        complex: 40,
      },
      specFile('/app/b.spec.ts', 5),
    ];
    const result = check312Rule(files);
    expect(result.violated).toBe(false);
    expect(result.files).toHaveLength(1); // only spec files
  });

  it('should return empty result for no files', () => {
    const result = check312Rule([]);
    expect(result.violated).toBe(false);
    expect(result.files).toHaveLength(0);
    expect(result.violatingFiles).toHaveLength(0);
  });
});
