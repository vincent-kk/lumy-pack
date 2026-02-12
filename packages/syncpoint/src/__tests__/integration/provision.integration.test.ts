import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { listTemplates, runProvision } from '../../core/provision.js';
import type { StepResult } from '../../utils/types.js';
import { type Sandbox, createInitializedSandbox } from '../helpers/sandbox.js';

vi.mock('../../utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    success: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('Provision Integration Tests', () => {
  let sandbox: Sandbox;

  beforeEach(async () => {
    sandbox = await createInitializedSandbox();
  });

  afterEach(async () => {
    await sandbox.cleanup();
  });

  it('should run template with echo command successfully', async () => {
    // Create template with safe echo command
    const templatePath = join(sandbox.templatesDir, 'test-echo.yml');
    const templateContent = `
name: test-echo
description: Test template with echo
steps:
  - name: Echo hello
    command: echo "hello world"
  - name: Echo goodbye
    command: echo "goodbye"
`;
    await writeFile(templatePath, templateContent, 'utf-8');

    // Run provision
    const results: StepResult[] = [];
    for await (const result of runProvision(templatePath)) {
      results.push(result);
    }

    // Filter out "running" status results
    const finalResults = results.filter((r) => r.status !== 'running');

    // Verify all steps succeeded
    expect(finalResults.length).toBe(2);
    expect(finalResults[0].status).toBe('success');
    expect(finalResults[0].name).toBe('Echo hello');
    expect(finalResults[1].status).toBe('success');
    expect(finalResults[1].name).toBe('Echo goodbye');
  });

  it('should skip step when skip_if condition is true', async () => {
    // Create template with skip_if using "true" command
    const templatePath = join(sandbox.templatesDir, 'test-skip.yml');
    const templateContent = `
name: test-skip
description: Test skip_if functionality
steps:
  - name: Should run
    command: echo "running"
  - name: Should skip
    command: echo "should not run"
    skip_if: "true"
  - name: Should run after skip
    command: echo "running after skip"
`;
    await writeFile(templatePath, templateContent, 'utf-8');

    // Run provision
    const results: StepResult[] = [];
    for await (const result of runProvision(templatePath)) {
      results.push(result);
    }

    // Filter out "running" status results
    const finalResults = results.filter((r) => r.status !== 'running');

    // Verify results
    expect(finalResults.length).toBe(3);
    expect(finalResults[0].status).toBe('success');
    expect(finalResults[0].name).toBe('Should run');

    expect(finalResults[1].status).toBe('skipped');
    expect(finalResults[1].name).toBe('Should skip');

    expect(finalResults[2].status).toBe('success');
    expect(finalResults[2].name).toBe('Should run after skip');
  });

  it('should stop on failure by default', async () => {
    // Create template with failing command
    const templatePath = join(sandbox.templatesDir, 'test-fail.yml');
    const templateContent = `
name: test-fail
description: Test failure handling
steps:
  - name: First step
    command: echo "first"
  - name: Failing step
    command: "false"
  - name: Should not run
    command: echo "should not run"
`;
    await writeFile(templatePath, templateContent, 'utf-8');

    // Run provision
    const results: StepResult[] = [];
    for await (const result of runProvision(templatePath)) {
      results.push(result);
    }

    // Filter out "running" status results
    const finalResults = results.filter((r) => r.status !== 'running');

    // Verify only first two steps ran
    expect(finalResults.length).toBe(2);
    expect(finalResults[0].status).toBe('success');
    expect(finalResults[0].name).toBe('First step');

    expect(finalResults[1].status).toBe('failed');
    expect(finalResults[1].name).toBe('Failing step');

    // Verify third step didn't run
    const thirdStep = finalResults.find((r) => r.name === 'Should not run');
    expect(thirdStep).toBeUndefined();
  });

  it('should continue on error when continue_on_error is true', async () => {
    // Create template with continue_on_error
    const templatePath = join(sandbox.templatesDir, 'test-continue.yml');
    const templateContent = `
name: test-continue
description: Test continue_on_error
steps:
  - name: First step
    command: echo "first"
  - name: Failing step with continue
    command: "false"
    continue_on_error: true
  - name: Should still run
    command: echo "still running"
`;
    await writeFile(templatePath, templateContent, 'utf-8');

    // Run provision
    const results: StepResult[] = [];
    for await (const result of runProvision(templatePath)) {
      results.push(result);
    }

    // Filter out "running" status results
    const finalResults = results.filter((r) => r.status !== 'running');

    // Verify all three steps ran
    expect(finalResults.length).toBe(3);
    expect(finalResults[0].status).toBe('success');
    expect(finalResults[0].name).toBe('First step');

    expect(finalResults[1].status).toBe('failed');
    expect(finalResults[1].name).toBe('Failing step with continue');

    expect(finalResults[2].status).toBe('success');
    expect(finalResults[2].name).toBe('Should still run');
  });

  it('should support dry-run mode', async () => {
    // Create template
    const templatePath = join(sandbox.templatesDir, 'test-dryrun.yml');
    const templateContent = `
name: test-dryrun
description: Test dry-run
steps:
  - name: Echo step
    command: echo "hello"
  - name: Skip step
    command: echo "world"
    skip_if: "true"
`;
    await writeFile(templatePath, templateContent, 'utf-8');

    // Run provision in dry-run mode
    const results: StepResult[] = [];
    for await (const result of runProvision(templatePath, { dryRun: true })) {
      results.push(result);
    }

    // Verify results show what would happen
    expect(results.length).toBe(2);
    expect(results[0].name).toBe('Echo step');
    expect(results[0].status).toBe('pending');

    expect(results[1].name).toBe('Skip step');
    expect(results[1].status).toBe('skipped');

    // Verify no duration (commands didn't run)
    expect(results[0].duration).toBeUndefined();
    expect(results[1].duration).toBeUndefined();
  });

  it('should list all templates in templates directory', async () => {
    // Create multiple templates
    const template1Path = join(sandbox.templatesDir, 'template1.yml');
    const template1Content = `
name: template1
description: First template
steps:
  - name: Step 1
    command: echo "test"
`;
    await writeFile(template1Path, template1Content, 'utf-8');

    const template2Path = join(sandbox.templatesDir, 'template2.yaml');
    const template2Content = `
name: template2
description: Second template
steps:
  - name: Step 1
    command: echo "test"
`;
    await writeFile(template2Path, template2Content, 'utf-8');

    // Create a non-template file (should be ignored)
    const readmePath = join(sandbox.templatesDir, 'README.md');
    await writeFile(readmePath, '# Templates', 'utf-8');

    // List templates
    const templates = await listTemplates();

    // Verify count (should find 2 templates, ignore README)
    expect(templates.length).toBe(2);

    // Verify template names
    const names = templates.map((t) => t.name);
    expect(names).toContain('template1');
    expect(names).toContain('template2');

    // Verify template configs
    const template1 = templates.find((t) => t.name === 'template1');
    expect(template1).toBeDefined();
    expect(template1?.config.name).toBe('template1');
    expect(template1?.config.description).toBe('First template');
    expect(template1?.config.steps.length).toBe(1);
  });

  it('should handle skip_if with false condition (step runs)', async () => {
    // Create template with skip_if that evaluates to false
    const templatePath = join(sandbox.templatesDir, 'test-skip-false.yml');
    const templateContent = `
name: test-skip-false
description: Test skip_if with false condition
steps:
  - name: Should run because condition is false
    command: echo "running"
    skip_if: "false"
`;
    await writeFile(templatePath, templateContent, 'utf-8');

    // Run provision
    const results: StepResult[] = [];
    for await (const result of runProvision(templatePath)) {
      results.push(result);
    }

    // Filter out "running" status results
    const finalResults = results.filter((r) => r.status !== 'running');

    // Verify step ran (not skipped)
    expect(finalResults.length).toBe(1);
    expect(finalResults[0].status).toBe('success');
    expect(finalResults[0].name).toBe('Should run because condition is false');
  });
});
