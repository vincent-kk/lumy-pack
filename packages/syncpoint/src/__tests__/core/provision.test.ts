import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  executeStep,
  listTemplates,
  loadTemplate,
  runProvision,
} from '../../core/provision.js';
import { makeTemplate } from '../helpers/fixtures.js';
import { type Sandbox, createInitializedSandbox } from '../helpers/sandbox.js';

vi.mock('../../utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    success: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('../../utils/sudo.js', () => ({
  isSudoCached: vi.fn(() => true),
  ensureSudo: vi.fn(),
}));

vi.mock('node:child_process', () => ({
  exec: vi.fn(
    (
      cmd: string,
      _opts: unknown,
      cb: (err: Error | null, stdout: string, stderr: string) => void,
    ) => {
      if (cmd.includes('echo')) {
        cb(null, 'hello', '');
      } else if (cmd.includes('fail')) {
        cb(new Error('command failed'), '', 'error');
      } else if (cmd.includes('which')) {
        cb(null, '/usr/bin/node', '');
      } else {
        cb(null, '', '');
      }
    },
  ),
}));

describe('core/provision', () => {
  let sandbox: Sandbox;

  beforeEach(async () => {
    sandbox = await createInitializedSandbox();
  });

  afterEach(async () => {
    await sandbox.cleanup();
    vi.clearAllMocks();
  });

  describe('loadTemplate', () => {
    it('valid YAML returns TemplateConfig', async () => {
      const templatePath = join(sandbox.templatesDir, 'test.yml');
      const templateContent = `
name: test-template
description: A test template
steps:
  - name: step1
    command: echo hello
`;
      await writeFile(templatePath, templateContent, 'utf-8');

      const config = await loadTemplate(templatePath);

      expect(config.name).toBe('test-template');
      expect(config.description).toBe('A test template');
      expect(config.steps).toHaveLength(1);
      expect(config.steps[0].name).toBe('step1');
      expect(config.steps[0].command).toBe('echo hello');
    });

    it('invalid YAML throws', async () => {
      const templatePath = join(sandbox.templatesDir, 'invalid.yml');
      const templateContent = `
name: invalid
# missing required fields
`;
      await writeFile(templatePath, templateContent, 'utf-8');

      await expect(loadTemplate(templatePath)).rejects.toThrow(
        'Invalid template',
      );
    });
  });

  describe('listTemplates', () => {
    it('lists .yml files from templates dir', async () => {
      const template1 = join(sandbox.templatesDir, 'template1.yml');
      const template2 = join(sandbox.templatesDir, 'template2.yaml');
      const notTemplate = join(sandbox.templatesDir, 'readme.txt');

      await writeFile(
        template1,
        `name: t1\ndescription: Template 1\nsteps:\n  - name: s1\n    command: echo t1`,
        'utf-8',
      );
      await writeFile(
        template2,
        `name: t2\ndescription: Template 2\nsteps:\n  - name: s2\n    command: echo t2`,
        'utf-8',
      );
      await writeFile(notTemplate, 'Not a template', 'utf-8');

      const templates = await listTemplates();

      expect(templates).toHaveLength(2);
      expect(templates.map((t) => t.name)).toContain('template1');
      expect(templates.map((t) => t.name)).toContain('template2');
      expect(templates.map((t) => t.config.name)).toContain('t1');
      expect(templates.map((t) => t.config.name)).toContain('t2');
    });

    it('empty dir returns empty array', async () => {
      const templates = await listTemplates();

      expect(templates).toEqual([]);
    });
  });

  describe('executeStep', () => {
    it('executes successful command', async () => {
      const step = makeTemplate().steps[0];
      step.command = 'echo hello';

      const result = await executeStep(step);

      expect(result.status).toBe('success');
      expect(result.name).toBe(step.name);
      expect(result.duration).toBeGreaterThanOrEqual(0);
      expect(result.output).toContain('hello');
    });

    it('returns failed status for failed command', async () => {
      const step = { name: 'fail-step', command: 'fail' };

      const result = await executeStep(step);

      expect(result.status).toBe('failed');
      expect(result.error).toBeDefined();
    });

    it('skips step when skip_if evaluates true', async () => {
      const step = {
        name: 'conditional',
        command: 'echo should-not-run',
        skip_if: 'which node', // This will succeed (return true)
      };

      const result = await executeStep(step);

      expect(result.status).toBe('skipped');
    });
  });

  describe('runProvision', () => {
    it('yields running then success for good steps', async () => {
      const templatePath = join(sandbox.templatesDir, 'success.yml');
      await writeFile(
        templatePath,
        `name: success\ndescription: Success test\nsteps:\n  - name: echo-step\n    command: echo hello`,
        'utf-8',
      );

      const results: Array<{ name: string; status: string }> = [];
      for await (const result of runProvision(templatePath)) {
        results.push({ name: result.name, status: result.status });
      }

      expect(results).toHaveLength(2); // running + success
      expect(results[0].status).toBe('running');
      expect(results[1].status).toBe('success');
    });

    it('stops on failed step without continue_on_error', async () => {
      const templatePath = join(sandbox.templatesDir, 'fail.yml');
      await writeFile(
        templatePath,
        `name: fail
description: Fail test
steps:
  - name: fail-step
    command: fail
  - name: should-not-run
    command: echo hello`,
        'utf-8',
      );

      const results: Array<{ name: string; status: string }> = [];
      for await (const result of runProvision(templatePath)) {
        results.push({ name: result.name, status: result.status });
      }

      // Should have running + failed for first step only
      expect(
        results.some((r) => r.name === 'fail-step' && r.status === 'failed'),
      ).toBe(true);
      expect(results.some((r) => r.name === 'should-not-run')).toBe(false);
    });

    it('continues past failed step with continue_on_error', async () => {
      const templatePath = join(sandbox.templatesDir, 'continue.yml');
      await writeFile(
        templatePath,
        `name: continue
description: Continue test
steps:
  - name: fail-step
    command: fail
    continue_on_error: true
  - name: should-run
    command: echo hello`,
        'utf-8',
      );

      const results: Array<{ name: string; status: string }> = [];
      for await (const result of runProvision(templatePath)) {
        results.push({ name: result.name, status: result.status });
      }

      expect(
        results.some((r) => r.name === 'fail-step' && r.status === 'failed'),
      ).toBe(true);
      expect(
        results.some((r) => r.name === 'should-run' && r.status === 'success'),
      ).toBe(true);
    });

    it('skips step when skip_if evaluates true', async () => {
      const templatePath = join(sandbox.templatesDir, 'skip.yml');
      await writeFile(
        templatePath,
        `name: skip
description: Skip test
steps:
  - name: conditional
    command: echo should-not-run
    skip_if: which node`,
        'utf-8',
      );

      const results: Array<{ name: string; status: string }> = [];
      for await (const result of runProvision(templatePath)) {
        results.push({ name: result.name, status: result.status });
      }

      // Should yield running + skipped (2 results)
      expect(results).toHaveLength(2);
      expect(results[0].status).toBe('running');
      expect(results[1].status).toBe('skipped');
    });

    it('dry-run yields pending without executing', async () => {
      const templatePath = join(sandbox.templatesDir, 'dryrun.yml');
      await writeFile(
        templatePath,
        `name: dryrun
description: Dry run test
steps:
  - name: echo-step
    command: echo hello`,
        'utf-8',
      );

      const results: Array<{ name: string; status: string }> = [];
      for await (const result of runProvision(templatePath, { dryRun: true })) {
        results.push({ name: result.name, status: result.status });
      }

      expect(results).toHaveLength(1);
      expect(results[0].status).toBe('pending');
    });
  });
});
