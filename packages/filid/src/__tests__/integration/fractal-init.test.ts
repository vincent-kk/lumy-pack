/**
 * Integration test: Fractal Init Pipeline
 * Tests: build tree → classify nodes → validate documents
 */
import { describe, expect, it } from 'vitest';

import {
  validateClaudeMd,
  validateSpecMd,
} from '../../core/document-validator.js';
import {
  buildFractalTree,
  findNode,
  getDescendants,
} from '../../core/fractal-tree.js';
import { classifyNode } from '../../core/organ-classifier.js';

describe('fractal-init pipeline', () => {
  // Simulate a project with fractal/organ structure
  const entries = [
    {
      name: 'root',
      path: '/project',
      type: 'fractal' as const,
      hasClaudeMd: true,
      hasSpecMd: false,
    },
    {
      name: 'auth',
      path: '/project/auth',
      type: 'fractal' as const,
      hasClaudeMd: true,
      hasSpecMd: true,
    },
    {
      name: 'components',
      path: '/project/auth/components',
      type: 'organ' as const,
      hasClaudeMd: false,
      hasSpecMd: false,
    },
    {
      name: 'utils',
      path: '/project/auth/utils',
      type: 'organ' as const,
      hasClaudeMd: false,
      hasSpecMd: false,
    },
    {
      name: 'payment',
      path: '/project/payment',
      type: 'fractal' as const,
      hasClaudeMd: true,
      hasSpecMd: true,
    },
    {
      name: 'helpers',
      path: '/project/payment/helpers',
      type: 'organ' as const,
      hasClaudeMd: false,
      hasSpecMd: false,
    },
  ];

  it('should build a fractal tree from directory entries', () => {
    const tree = buildFractalTree(entries);

    expect(tree.root).toBe('/project');
    expect(tree.nodes.size).toBeGreaterThan(0);

    const root = tree.nodes.get('/project');
    expect(root).toBeDefined();
    expect(root!.children.length).toBeGreaterThan(0);
  });

  it('should classify organ directories correctly', () => {
    const organInput = (dirName: string) => ({
      dirName,
      hasClaudeMd: false,
      hasSpecMd: false,
      hasFractalChildren: false,
      isLeafDirectory: true,
    });
    expect(classifyNode(organInput('components'))).toBe('organ');
    expect(classifyNode(organInput('utils'))).toBe('organ');
    expect(classifyNode(organInput('helpers'))).toBe('organ');
    expect(classifyNode({ ...organInput('auth'), hasClaudeMd: true })).toBe(
      'fractal',
    );
    expect(
      classifyNode({
        ...organInput('payment'),
        hasFractalChildren: true,
        isLeafDirectory: false,
      }),
    ).toBe('fractal');
  });

  it('should classify nodes with context', () => {
    const result = classifyNode({
      dirName: 'auth',
      hasClaudeMd: true,
      hasSpecMd: false,
      hasFractalChildren: false,
      isLeafDirectory: false,
    });

    expect(result).toBe('fractal');
  });

  it('should validate CLAUDE.md within line limit', () => {
    const validContent = Array.from(
      { length: 50 },
      (_, i) => `Line ${i + 1}`,
    ).join('\n');
    const validation = validateClaudeMd(validContent);

    // valid=true because line-limit is not violated (warnings don't block)
    expect(validation.valid).toBe(true);
    expect(validation.violations.every((v) => v.severity !== 'error')).toBe(
      true,
    );
  });

  it('should reject CLAUDE.md exceeding 100 lines', () => {
    const longContent = Array.from(
      { length: 101 },
      (_, i) => `Line ${i + 1}`,
    ).join('\n');
    const validation = validateClaudeMd(longContent);

    expect(validation.valid).toBe(false);
    expect(validation.violations.some((v) => v.rule === 'line-limit')).toBe(
      true,
    );
  });

  it('should validate SPEC.md structure', () => {
    const specContent = '# Module Spec\n\n## API\n\n- `function foo(): void`\n';
    const validation = validateSpecMd(specContent);

    expect(validation.valid).toBe(true);
  });

  it('should navigate the tree to find descendants', () => {
    const tree = buildFractalTree(entries);
    const root = findNode(tree, '/project');

    expect(root).toBeDefined();

    const descendants = getDescendants(tree, '/project');
    // auth, payment are fractal descendants
    expect(descendants.length).toBeGreaterThanOrEqual(2);
  });

  it('should verify organ directories lack CLAUDE.md', () => {
    const tree = buildFractalTree(entries);

    // Organ directories should not have CLAUDE.md
    const components = tree.nodes.get('/project/auth/components');
    if (components) {
      expect(components.hasClaudeMd).toBe(false);
    }

    const utils = tree.nodes.get('/project/auth/utils');
    if (utils) {
      expect(utils.hasClaudeMd).toBe(false);
    }
  });

  describe('post-correction loop — hasIndex nested fractal detection', () => {
    it('fractal → organ → fractal: organ 내부 hasIndex=true 디렉토리는 fractal로 분류', () => {
      // auth(fractal) → helpers(organ) → login(hasIndex=true) → fractal
      const nestedEntries = [
        {
          name: 'auth',
          path: '/project2/auth',
          type: 'fractal' as const,
          hasClaudeMd: true,
          hasSpecMd: false,
        },
        {
          name: 'helpers',
          path: '/project2/auth/helpers',
          type: 'organ' as const,
          hasClaudeMd: false,
          hasSpecMd: false,
        },
        {
          name: 'login',
          path: '/project2/auth/helpers/login',
          type: 'fractal' as const,
          hasClaudeMd: false,
          hasSpecMd: false,
          hasIndex: true,
        },
      ];

      const tree = buildFractalTree(nestedEntries);
      const login = tree.nodes.get('/project2/auth/helpers/login');
      expect(login).toBeDefined();
      expect(login!.type).toBe('fractal');
    });

    it('fractal → organ → organ → fractal: 깊은 중첩에서 hasIndex=true 디렉토리는 fractal로 분류', () => {
      const deepEntries = [
        {
          name: 'auth',
          path: '/project3/auth',
          type: 'fractal' as const,
          hasClaudeMd: true,
          hasSpecMd: false,
        },
        {
          name: 'helpers',
          path: '/project3/auth/helpers',
          type: 'organ' as const,
          hasClaudeMd: false,
          hasSpecMd: false,
        },
        {
          name: 'impl',
          path: '/project3/auth/helpers/impl',
          type: 'organ' as const,
          hasClaudeMd: false,
          hasSpecMd: false,
        },
        {
          name: 'login',
          path: '/project3/auth/helpers/impl/login',
          type: 'fractal' as const,
          hasClaudeMd: false,
          hasSpecMd: false,
          hasIndex: true,
        },
      ];

      const tree = buildFractalTree(deepEntries);
      const login = tree.nodes.get('/project3/auth/helpers/impl/login');
      expect(login).toBeDefined();
      expect(login!.type).toBe('fractal');
    });

    it('organ 내부 non-fractal 디렉토리: 자손에 fractal 없고 hasIndex=false → organ 유지', () => {
      const organOnlyEntries = [
        {
          name: 'auth',
          path: '/project4/auth',
          type: 'fractal' as const,
          hasClaudeMd: true,
          hasSpecMd: false,
        },
        {
          name: 'utils',
          path: '/project4/auth/utils',
          type: 'organ' as const,
          hasClaudeMd: false,
          hasSpecMd: false,
        },
        {
          name: 'string-helpers',
          path: '/project4/auth/utils/string-helpers',
          type: 'organ' as const,
          hasClaudeMd: false,
          hasSpecMd: false,
          hasIndex: false,
        },
      ];

      const tree = buildFractalTree(organOnlyEntries);
      const stringHelpers = tree.nodes.get(
        '/project4/auth/utils/string-helpers',
      );
      expect(stringHelpers).toBeDefined();
      expect(stringHelpers!.type).toBe('organ');
    });

    it('깊은 중첩 CLAUDE.md 생성 대상에 nested fractal 포함 확인', () => {
      // hasIndex=true leaf가 fractal이면, getDescendants가 이를 포함해야 함
      const mixedEntries = [
        {
          name: 'root',
          path: '/project5',
          type: 'fractal' as const,
          hasClaudeMd: true,
          hasSpecMd: false,
        },
        {
          name: 'feature',
          path: '/project5/feature',
          type: 'fractal' as const,
          hasClaudeMd: false,
          hasSpecMd: false,
          hasIndex: true,
        },
        {
          name: 'sub',
          path: '/project5/feature/sub',
          type: 'fractal' as const,
          hasClaudeMd: false,
          hasSpecMd: false,
          hasIndex: true,
        },
      ];

      const tree = buildFractalTree(mixedEntries);
      const descendants = getDescendants(tree, '/project5');
      // feature와 sub 모두 fractal descendants로 포함되어야 함
      expect(descendants.length).toBeGreaterThanOrEqual(2);
      const paths = descendants.map((d) => d.path);
      expect(paths).toContain('/project5/feature');
      expect(paths).toContain('/project5/feature/sub');
    });
  });
});
