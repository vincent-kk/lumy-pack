import React from "react";
import { render } from "ink-testing-library";
import { describe, it, expect } from "vitest";
import { Table } from "../../components/Table.js";

describe("Table", () => {
  it("renders header row", () => {
    const { lastFrame } = render(
      <Table headers={["Name", "Age"]} rows={[["Alice", "30"]]} />
    );
    const frame = lastFrame() || "";
    expect(frame).toContain("Name");
    expect(frame).toContain("Age");
  });

  it("renders data rows", () => {
    const { lastFrame } = render(
      <Table
        headers={["Name", "Age"]}
        rows={[
          ["Alice", "30"],
          ["Bob", "25"],
        ]}
      />
    );
    const frame = lastFrame() || "";
    expect(frame).toContain("Alice");
    expect(frame).toContain("30");
    expect(frame).toContain("Bob");
    expect(frame).toContain("25");
  });

  it("renders separator", () => {
    const { lastFrame } = render(
      <Table headers={["Name", "Age"]} rows={[["Alice", "30"]]} />
    );
    const frame = lastFrame() || "";
    // Separator should contain dashes (─)
    expect(frame).toContain("─");
  });

  it("handles empty rows", () => {
    const { lastFrame } = render(<Table headers={["Name", "Age"]} rows={[]} />);
    const frame = lastFrame() || "";
    expect(frame).toContain("Name");
    expect(frame).toContain("Age");
    expect(frame).toContain("─");
  });

  it("renders all columns", () => {
    const { lastFrame } = render(
      <Table
        headers={["Col1", "Col2", "Col3"]}
        rows={[["A", "B", "C"]]}
      />
    );
    const frame = lastFrame() || "";
    expect(frame).toContain("Col1");
    expect(frame).toContain("Col2");
    expect(frame).toContain("Col3");
    expect(frame).toContain("A");
    expect(frame).toContain("B");
    expect(frame).toContain("C");
  });
});
