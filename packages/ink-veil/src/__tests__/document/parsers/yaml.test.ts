import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { isDeepStrictEqual } from "node:util";
import { YamlParser } from "../../../document/parsers/yaml.js";
import yaml from "js-yaml";

describe("YamlParser — Tier 1b (semantic equality + comment loss warning)", () => {
  const parser = new YamlParser();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let stderrSpy: any;

  beforeEach(() => {
    stderrSpy = vi
      .spyOn(process.stderr, "write")
      .mockImplementation(() => true);
  });

  afterEach(() => {
    stderrSpy.mockRestore();
  });

  it("parse → reconstruct: parsed content is deep equal", async () => {
    const yamlContent = `name: 홍길동\nphone: "010-1234-5678"\naddress:\n  city: 서울\n  district: 강남구\n`;
    const original = Buffer.from(yamlContent, "utf-8");

    const parsed = await parser.parse(original);
    const reconstructed = await parser.reconstruct(parsed);

    const origObj = yaml.load(original.toString("utf-8")) as unknown;
    const reconObj = yaml.load(reconstructed.toString("utf-8")) as unknown;
    expect(isDeepStrictEqual(origObj, reconObj)).toBe(true);
  });

  it("emits stderr warning about comment loss on parse", async () => {
    const yamlContent = `# 개인정보\nname: 홍길동\n`;
    const original = Buffer.from(yamlContent, "utf-8");
    await parser.parse(original);
    expect(stderrSpy).toHaveBeenCalled();
    const calls = stderrSpy.mock.calls.map((c: unknown[]) => String(c[0]));
    expect(
      calls.some(
        (msg: string) =>
          msg.toLowerCase().includes("comment") || msg.includes("주석"),
      ),
    ).toBe(true);
  });

  it("text segments extracted correctly", async () => {
    const yamlContent = `name: 홍길동\ncity: 서울\n`;
    const original = Buffer.from(yamlContent, "utf-8");
    const parsed = await parser.parse(original);
    const texts = parsed.segments.map((s) => s.text);
    expect(texts).toContain("홍길동");
    expect(texts).toContain("서울");
  });

  it("modified segments reconstruct with changes", async () => {
    const yamlContent = `name: 홍길동\n`;
    const original = Buffer.from(yamlContent, "utf-8");
    const parsed = await parser.parse(original);
    parsed.segments[0].text = "PER_001";
    const reconstructed = await parser.reconstruct(parsed);
    const reconObj = yaml.load(reconstructed.toString("utf-8")) as Record<
      string,
      unknown
    >;
    expect(reconObj["name"]).toBe("PER_001");
  });

  it("tier is 1b", async () => {
    const original = Buffer.from("key: value\n", "utf-8");
    const parsed = await parser.parse(original);
    expect(parsed.tier).toBe("1b");
  });
});
