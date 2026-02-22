/**
 * Integration test: Fractal Init Pipeline
 * Tests: build tree → classify nodes → validate documents
 */
import { describe, it, expect } from "vitest";
import {
  buildFractalTree,
  findNode,
  getDescendants,
} from "../../core/fractal-tree.js";
import { classifyNode, isOrganDirectory } from "../../core/organ-classifier.js";
import {
  validateClaudeMd,
  validateSpecMd,
} from "../../core/document-validator.js";

describe("fractal-init pipeline", () => {
  // Simulate a project with fractal/organ structure
  const entries = [
    {
      name: "root",
      path: "/project",
      type: "fractal" as const,
      hasClaudeMd: true,
      hasSpecMd: false,
    },
    {
      name: "auth",
      path: "/project/auth",
      type: "fractal" as const,
      hasClaudeMd: true,
      hasSpecMd: true,
    },
    {
      name: "components",
      path: "/project/auth/components",
      type: "organ" as const,
      hasClaudeMd: false,
      hasSpecMd: false,
    },
    {
      name: "utils",
      path: "/project/auth/utils",
      type: "organ" as const,
      hasClaudeMd: false,
      hasSpecMd: false,
    },
    {
      name: "payment",
      path: "/project/payment",
      type: "fractal" as const,
      hasClaudeMd: true,
      hasSpecMd: true,
    },
    {
      name: "helpers",
      path: "/project/payment/helpers",
      type: "organ" as const,
      hasClaudeMd: false,
      hasSpecMd: false,
    },
  ];

  it("should build a fractal tree from directory entries", () => {
    const tree = buildFractalTree(entries);

    expect(tree.root).toBe("/project");
    expect(tree.nodes.size).toBeGreaterThan(0);

    const root = tree.nodes.get("/project");
    expect(root).toBeDefined();
    expect(root!.children.length).toBeGreaterThan(0);
  });

  it("should classify organ directories correctly", () => {
    expect(isOrganDirectory("components")).toBe(true);
    expect(isOrganDirectory("utils")).toBe(true);
    expect(isOrganDirectory("helpers")).toBe(true);
    expect(isOrganDirectory("auth")).toBe(false);
    expect(isOrganDirectory("payment")).toBe(false);
  });

  it("should classify nodes with context", () => {
    const result = classifyNode({
      dirName: "auth",
      hasClaudeMd: true,
      hasSpecMd: false,
      hasFractalChildren: false,
      isLeafDirectory: false,
    });

    expect(result).toBe("fractal");
  });

  it("should validate CLAUDE.md within line limit", () => {
    const validContent = Array.from(
      { length: 50 },
      (_, i) => `Line ${i + 1}`,
    ).join("\n");
    const validation = validateClaudeMd(validContent);

    // valid=true because line-limit is not violated (warnings don't block)
    expect(validation.valid).toBe(true);
    expect(validation.violations.every((v) => v.severity !== "error")).toBe(
      true,
    );
  });

  it("should reject CLAUDE.md exceeding 100 lines", () => {
    const longContent = Array.from(
      { length: 101 },
      (_, i) => `Line ${i + 1}`,
    ).join("\n");
    const validation = validateClaudeMd(longContent);

    expect(validation.valid).toBe(false);
    expect(validation.violations.some((v) => v.rule === "line-limit")).toBe(
      true,
    );
  });

  it("should validate SPEC.md structure", () => {
    const specContent = "# Module Spec\n\n## API\n\n- `function foo(): void`\n";
    const validation = validateSpecMd(specContent);

    expect(validation.valid).toBe(true);
  });

  it("should navigate the tree to find descendants", () => {
    const tree = buildFractalTree(entries);
    const root = findNode(tree, "/project");

    expect(root).toBeDefined();

    const descendants = getDescendants(tree, "/project");
    // auth, payment are fractal descendants
    expect(descendants.length).toBeGreaterThanOrEqual(2);
  });

  it("should verify organ directories lack CLAUDE.md", () => {
    const tree = buildFractalTree(entries);

    // Organ directories should not have CLAUDE.md
    const components = tree.nodes.get("/project/auth/components");
    if (components) {
      expect(components.hasClaudeMd).toBe(false);
    }

    const utils = tree.nodes.get("/project/auth/utils");
    if (utils) {
      expect(utils.hasClaudeMd).toBe(false);
    }
  });
});
