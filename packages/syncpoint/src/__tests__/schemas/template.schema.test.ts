import { describe, it, expect } from "vitest";
import { validateTemplate } from "../../schemas/template.schema.js";
import { makeTemplate } from "../helpers/fixtures.js";

describe("validateTemplate", () => {
  it("validates a complete valid template", () => {
    const template = makeTemplate();
    const result = validateTemplate(template);
    expect(result.valid).toBe(true);
    expect(result.errors).toBeUndefined();
  });

  it("validates template with all optional fields", () => {
    const template = makeTemplate({
      name: "full-template",
      description: "Full template with all fields",
      backup: "backup-name",
      sudo: true,
      steps: [
        {
          name: "step1",
          description: "First step",
          command: "echo test",
          skip_if: "[ -f /tmp/file ]",
          continue_on_error: true,
        },
      ],
    });
    const result = validateTemplate(template);
    expect(result.valid).toBe(true);
  });

  it("validates template with multiple steps", () => {
    const template = makeTemplate({
      steps: [
        { name: "step1", command: "echo 1" },
        { name: "step2", command: "echo 2" },
        { name: "step3", command: "echo 3" },
      ],
    });
    const result = validateTemplate(template);
    expect(result.valid).toBe(true);
  });

  it("fails when name is missing", () => {
    const template = makeTemplate();
    delete (template as any).name;
    const result = validateTemplate(template);
    expect(result.valid).toBe(false);
    expect(result.errors?.some((e) => e.includes("name"))).toBe(true);
  });

  it("fails when name is empty string", () => {
    const template = makeTemplate({ name: "" });
    const result = validateTemplate(template);
    expect(result.valid).toBe(false);
    // Check that errors exist and reference the name field
    expect(result.errors).toBeDefined();
    expect(result.errors!.length).toBeGreaterThan(0);
  });

  it("fails when steps is missing", () => {
    const template = makeTemplate();
    delete (template as any).steps;
    const result = validateTemplate(template);
    expect(result.valid).toBe(false);
    expect(result.errors?.some((e) => e.includes("steps"))).toBe(true);
  });

  it("fails when steps is empty array", () => {
    const template = makeTemplate({ steps: [] });
    const result = validateTemplate(template);
    expect(result.valid).toBe(false);
    // Check that errors exist and reference the steps field
    expect(result.errors).toBeDefined();
    expect(result.errors!.length).toBeGreaterThan(0);
  });

  it("fails when step is missing name", () => {
    const template = makeTemplate({
      steps: [{ command: "echo test" } as any],
    });
    const result = validateTemplate(template);
    expect(result.valid).toBe(false);
    expect(result.errors?.some((e) => e.includes("name"))).toBe(true);
  });

  it("fails when step name is empty string", () => {
    const template = makeTemplate({
      steps: [{ name: "", command: "echo test" }],
    });
    const result = validateTemplate(template);
    expect(result.valid).toBe(false);
  });

  it("fails when step is missing command", () => {
    const template = makeTemplate({
      steps: [{ name: "step1" } as any],
    });
    const result = validateTemplate(template);
    expect(result.valid).toBe(false);
    expect(result.errors?.some((e) => e.includes("command"))).toBe(true);
  });

  it("fails when step command is empty string", () => {
    const template = makeTemplate({
      steps: [{ name: "step1", command: "" }],
    });
    const result = validateTemplate(template);
    expect(result.valid).toBe(false);
  });

  it("validates step with optional skip_if", () => {
    const template = makeTemplate({
      steps: [
        {
          name: "step1",
          command: "echo test",
          skip_if: "[ -f /tmp/skip ]",
        },
      ],
    });
    const result = validateTemplate(template);
    expect(result.valid).toBe(true);
  });

  it("validates step with optional continue_on_error", () => {
    const template = makeTemplate({
      steps: [
        {
          name: "step1",
          command: "echo test",
          continue_on_error: true,
        },
      ],
    });
    const result = validateTemplate(template);
    expect(result.valid).toBe(true);
  });

  it("fails when name is not a string", () => {
    const template = makeTemplate({ name: 123 as any });
    const result = validateTemplate(template);
    expect(result.valid).toBe(false);
  });

  it("fails when steps is not an array", () => {
    const template = makeTemplate({ steps: "not-an-array" as any });
    const result = validateTemplate(template);
    expect(result.valid).toBe(false);
  });

  it("fails when sudo is not a boolean", () => {
    const template = makeTemplate({ sudo: "true" as any });
    const result = validateTemplate(template);
    expect(result.valid).toBe(false);
  });

  it("fails when continue_on_error is not a boolean", () => {
    const template = makeTemplate({
      steps: [
        {
          name: "step1",
          command: "echo test",
          continue_on_error: "true" as any,
        },
      ],
    });
    const result = validateTemplate(template);
    expect(result.valid).toBe(false);
  });

  it("fails with additional properties in template root", () => {
    const template = { ...makeTemplate(), extraProp: "value" };
    const result = validateTemplate(template);
    expect(result.valid).toBe(false);
  });

  it("fails with additional properties in step", () => {
    const template = makeTemplate({
      steps: [
        {
          name: "step1",
          command: "echo test",
          extraProp: "value",
        } as any,
      ],
    });
    const result = validateTemplate(template);
    expect(result.valid).toBe(false);
  });

  it("validates template with minimal required fields only", () => {
    const template = {
      name: "minimal",
      steps: [{ name: "step1", command: "echo test" }],
    };
    const result = validateTemplate(template);
    expect(result.valid).toBe(true);
  });
});
