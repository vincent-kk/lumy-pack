import { describe, it, expect } from "vitest";
import { isDeepStrictEqual } from "node:util";
import { XmlParser } from "../../../document/parsers/xml.js";

describe("XmlParser — Tier 1b (semantic equality)", () => {
  const parser = new XmlParser();

  it("parse → reconstruct: parsed content is deep equal", async () => {
    const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>\n<root>\n  <person>\n    <name>홍길동</name>\n    <phone>010-1234-5678</phone>\n  </person>\n</root>`;
    const original = Buffer.from(xmlContent, "utf-8");

    const parsed = await parser.parse(original);
    const reconstructed = await parser.reconstruct(parsed);

    // Re-parse both and compare structure
    const { XMLParser } = await import("fast-xml-parser");
    const p = new XMLParser({ ignoreAttributes: false });
    const origObj = p.parse(original.toString("utf-8")) as unknown;
    const reconObj = p.parse(reconstructed.toString("utf-8")) as unknown;
    expect(isDeepStrictEqual(origObj, reconObj)).toBe(true);
  });

  it("text segments extracted from text nodes", async () => {
    const xmlContent = `<root><name>홍길동</name><city>서울</city></root>`;
    const original = Buffer.from(xmlContent, "utf-8");
    const parsed = await parser.parse(original);
    const texts = parsed.segments.map((s) => s.text);
    expect(texts).toContain("홍길동");
    expect(texts).toContain("서울");
  });

  it("tier is 1b", async () => {
    const original = Buffer.from("<root/>", "utf-8");
    const parsed = await parser.parse(original);
    expect(parsed.tier).toBe("1b");
  });
});
