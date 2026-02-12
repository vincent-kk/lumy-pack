import React from "react";
import { render } from "ink-testing-library";
import { describe, it, expect } from "vitest";
import { ProgressBar } from "../../components/ProgressBar.js";

describe("ProgressBar", () => {
  it("renders 0% with empty blocks", () => {
    const { lastFrame } = render(<ProgressBar percent={0} width={10} />);
    expect(lastFrame()).toContain("░░░░░░░░░░");
    expect(lastFrame()).toContain("0%");
  });

  it("renders 50% with half filled", () => {
    const { lastFrame } = render(<ProgressBar percent={50} width={10} />);
    const frame = lastFrame() || "";
    expect(frame).toContain("50%");
    // Should have 5 filled (█) and 5 empty (░)
    expect(frame).toMatch(/█{5}░{5}/);
  });

  it("renders 100% with all filled", () => {
    const { lastFrame } = render(<ProgressBar percent={100} width={10} />);
    const frame = lastFrame() || "";
    expect(frame).toContain("100%");
    expect(frame).toContain("██████████");
  });

  it("shows percentage text", () => {
    const { lastFrame } = render(<ProgressBar percent={33} />);
    expect(lastFrame()).toContain("33%");
  });

  it("clamps value above 100", () => {
    const { lastFrame } = render(<ProgressBar percent={150} width={10} />);
    const frame = lastFrame() || "";
    expect(frame).toContain("100%");
    expect(frame).toContain("██████████");
  });

  it("clamps value below 0", () => {
    const { lastFrame } = render(<ProgressBar percent={-50} width={10} />);
    const frame = lastFrame() || "";
    expect(frame).toContain("0%");
    expect(frame).toContain("░░░░░░░░░░");
  });
});
