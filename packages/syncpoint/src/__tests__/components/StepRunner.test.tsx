import React from "react";
import { render } from "ink-testing-library";
import { describe, it, expect, vi } from "vitest";
import { StepRunner } from "../../components/StepRunner.js";
import type { StepResult } from "../../utils/types.js";

// Mock ink-spinner to avoid animation issues in tests
vi.mock("ink-spinner", () => ({
  default: () => React.createElement("text", null, "⠋"),
}));

describe("StepRunner", () => {
  it("shows check mark for success steps", () => {
    const steps: StepResult[] = [
      {
        name: "Install package",
        status: "success",
        output: "Package installed",
      },
    ];
    const { lastFrame } = render(<StepRunner steps={steps} currentStep={1} total={1} />);
    const frame = lastFrame() || "";
    expect(frame).toContain("✓");
    expect(frame).toContain("Install package");
    expect(frame).toContain("Done");
  });

  it("shows X mark for failed steps", () => {
    const steps: StepResult[] = [
      {
        name: "Build project",
        status: "failed",
        error: "Build error",
        output: "Build output",
      },
    ];
    const { lastFrame } = render(<StepRunner steps={steps} currentStep={1} total={1} />);
    const frame = lastFrame() || "";
    expect(frame).toContain("✗");
    expect(frame).toContain("Build project");
    expect(frame).toContain("Failed");
  });

  it("shows skip indicator for skipped steps", () => {
    const steps: StepResult[] = [
      {
        name: "Optional step",
        status: "skipped",
        output: "Already done",
      },
    ];
    const { lastFrame } = render(<StepRunner steps={steps} currentStep={1} total={1} />);
    const frame = lastFrame() || "";
    expect(frame).toContain("⏭");
    expect(frame).toContain("Optional step");
    expect(frame).toContain("Skipped");
  });

  it("shows step name and description", () => {
    const steps: StepResult[] = [
      {
        name: "Test step",
        status: "pending",
        output: "Test description",
      },
    ];
    const { lastFrame } = render(<StepRunner steps={steps} currentStep={0} total={1} />);
    const frame = lastFrame() || "";
    expect(frame).toContain("Step 1/1");
    expect(frame).toContain("Test step");
  });

  it("shows error message for failed steps", () => {
    const steps: StepResult[] = [
      {
        name: "Failed step",
        status: "failed",
        error: "Something went wrong",
        output: "Error details",
      },
    ];
    const { lastFrame } = render(<StepRunner steps={steps} currentStep={1} total={1} />);
    const frame = lastFrame() || "";
    expect(frame).toContain("Something went wrong");
  });

  it("shows duration when available", () => {
    const steps: StepResult[] = [
      {
        name: "Timed step",
        status: "success",
        duration: 5500, // 5.5 seconds
        output: "Completed",
      },
    ];
    const { lastFrame } = render(<StepRunner steps={steps} currentStep={1} total={1} />);
    const frame = lastFrame() || "";
    expect(frame).toContain("Done");
    expect(frame).toContain("(6s)"); // Rounded to 6s
  });
});
