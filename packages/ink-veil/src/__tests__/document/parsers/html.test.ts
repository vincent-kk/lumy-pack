import { describe, it, expect } from "vitest";
import { HtmlParser } from "../../../document/parsers/html.js";

describe("HtmlParser — Tier 2", () => {
  const parser = new HtmlParser();

  it("tier is 2", async () => {
    const buf = Buffer.from("<html><body><p>hello</p></body></html>", "utf-8");
    const parsed = await parser.parse(buf);
    expect(parsed.tier).toBe("2");
  });

  it("extracts text nodes from HTML body", async () => {
    const html = `<html><body><h1>홍길동</h1><p>이메일: test@example.com</p></body></html>`;
    const buf = Buffer.from(html, "utf-8");
    const parsed = await parser.parse(buf);
    const texts = parsed.segments.map((s) => s.text);
    expect(texts.some((t) => t.includes("홍길동"))).toBe(true);
    expect(texts.some((t) => t.includes("test@example.com"))).toBe(true);
  });

  it("script and style content is skipped", async () => {
    const html = `<html><body><script>var secret="PII";</script><p>내용</p></body></html>`;
    const buf = Buffer.from(html, "utf-8");
    const parsed = await parser.parse(buf);
    const texts = parsed.segments.map((s) => s.text);
    expect(texts.some((t) => t.includes("PII"))).toBe(false);
    expect(texts.some((t) => t.includes("내용"))).toBe(true);
  });

  it("reconstruct replaces text node content", async () => {
    const html = `<html><body><p>홍길동</p></body></html>`;
    const buf = Buffer.from(html, "utf-8");
    const parsed = await parser.parse(buf);
    parsed.segments[0].text = "PER_001";
    const reconstructed = await parser.reconstruct(parsed);
    const text = reconstructed.toString("utf-8");
    expect(text).toContain("PER_001");
    expect(text).not.toContain("홍길동");
  });

  it("tag structure is preserved after reconstruct", async () => {
    const html = `<html><body><div class="container"><h1>제목</h1><p>내용</p></div></body></html>`;
    const buf = Buffer.from(html, "utf-8");
    const parsed = await parser.parse(buf);
    const reconstructed = await parser.reconstruct(parsed);
    const text = reconstructed.toString("utf-8");
    expect(text).toContain('class="container"');
    expect(text).toContain("<h1>");
    expect(text).toContain("<p>");
  });

  it("DOM text node comparison works for Tier 2 verification", async () => {
    const html = `<html><body><p>홍길동</p><p>서울시</p></body></html>`;
    const buf = Buffer.from(html, "utf-8");
    const parsed = await parser.parse(buf);
    const reParsed = await parser.parse(buf);
    const textsA = parsed.segments
      .filter((s) => !s.skippable)
      .map((s) => s.text);
    const textsB = reParsed.segments
      .filter((s) => !s.skippable)
      .map((s) => s.text);
    expect(textsA).toEqual(textsB);
  });
});
