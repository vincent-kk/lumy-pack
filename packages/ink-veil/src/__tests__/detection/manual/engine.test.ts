import { describe, it, expect } from "vitest";
import { ManualEngine } from "../../../detection/manual/engine.js";

describe("ManualEngine", () => {
  const engine = new ManualEngine();

  describe("string pattern rules", () => {
    it("detects a single string occurrence at correct offset", () => {
      const text = "Report for Project-Alpha this quarter.";
      const spans = engine.detect(text, [
        { pattern: "Project-Alpha", category: "PROJECT" },
      ]);

      expect(spans).toHaveLength(1);
      expect(spans[0]).toMatchObject({
        start: 11,
        end: 24,
        text: "Project-Alpha",
        category: "PROJECT",
        method: "MANUAL",
        confidence: 1.0,
      });
    });

    it("detects multiple occurrences of the same string pattern", () => {
      const text = "Project-Alpha and Project-Alpha are distinct entries.";
      const spans = engine.detect(text, [
        { pattern: "Project-Alpha", category: "PROJECT" },
      ]);

      expect(spans).toHaveLength(2);
      expect(spans[0].start).toBe(0);
      expect(spans[1].start).toBe(18);
    });

    it("returns empty array when pattern not found", () => {
      const spans = engine.detect("Hello world", [
        { pattern: "Project-Alpha", category: "PROJECT" },
      ]);
      expect(spans).toHaveLength(0);
    });

    it("ignores empty string patterns", () => {
      const spans = engine.detect("Hello world", [
        { pattern: "", category: "PROJECT" },
      ]);
      expect(spans).toHaveLength(0);
    });
  });

  describe("regex pattern rules", () => {
    it("matches invoice number pattern", () => {
      const text = "Invoice INV-20260307 received.";
      const spans = engine.detect(text, [
        { pattern: /INV-\d{8}/g, category: "INVOICE" },
      ]);

      expect(spans).toHaveLength(1);
      expect(spans[0]).toMatchObject({
        start: 8,
        end: 20,
        text: "INV-20260307",
        category: "INVOICE",
        method: "MANUAL",
        confidence: 1.0,
      });
    });

    it("matches multiple invoice numbers", () => {
      const text = "INV-20260307 and INV-20260308 were processed.";
      const spans = engine.detect(text, [
        { pattern: /INV-\d{8}/g, category: "INVOICE" },
      ]);

      expect(spans).toHaveLength(2);
      expect(spans[0].text).toBe("INV-20260307");
      expect(spans[1].text).toBe("INV-20260308");
    });

    it("works with non-global regex (auto-adds global flag)", () => {
      const text = "Code: 특수코드-A1 and 특수코드-A1 again.";
      const spans = engine.detect(text, [
        { pattern: /특수코드-A\d/, category: "SERIAL" },
      ]);

      expect(spans).toHaveLength(2);
    });

    it("returns empty array when regex has no match", () => {
      const spans = engine.detect("no match here", [
        { pattern: /INV-\d{8}/g, category: "INVOICE" },
      ]);
      expect(spans).toHaveLength(0);
    });
  });

  describe("multiple rules", () => {
    it("applies multiple rules and merges results sorted by start offset", () => {
      const text = "Project-Alpha invoice INV-20260307 submitted.";
      const spans = engine.detect(text, [
        { pattern: "Project-Alpha", category: "PROJECT" },
        { pattern: /INV-\d{8}/g, category: "INVOICE" },
      ]);

      expect(spans).toHaveLength(2);
      expect(spans[0].category).toBe("PROJECT");
      expect(spans[0].start).toBeLessThan(spans[1].start);
      expect(spans[1].category).toBe("INVOICE");
    });
  });
});
