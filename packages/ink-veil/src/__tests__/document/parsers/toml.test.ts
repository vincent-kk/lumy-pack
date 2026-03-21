import { describe, it, expect } from "vitest";
import { isDeepStrictEqual } from "node:util";
import TOML from "@ltd/j-toml";
import { TomlParser } from "../../../document/parsers/toml.js";

describe("TomlParser — Tier 1b (semantic equality)", () => {
  const parser = new TomlParser();

  const sampleToml = `[person]
name = "홍길동"
rrn = "901231-1234567"

[contact]
email = "hong@example.com"
phone = "010-1234-5678"

[tags]
list = ["개인정보", "PII"]
`;

  it("parse → reconstruct: parsed content is deep equal", async () => {
    const original = Buffer.from(sampleToml, "utf-8");
    const parsed = await parser.parse(original);
    const reconstructed = await parser.reconstruct(parsed);

    const origObj = TOML.parse(original.toString("utf-8"), {
      joiner: "\n",
      bigint: false,
    });
    const reconObj = TOML.parse(reconstructed.toString("utf-8"), {
      joiner: "\n",
      bigint: false,
    });
    expect(isDeepStrictEqual(origObj, reconObj)).toBe(true);
  });

  it("text segments are extracted from nested tables", async () => {
    const original = Buffer.from(sampleToml, "utf-8");
    const parsed = await parser.parse(original);
    const texts = parsed.segments.map((s) => s.text);

    expect(texts).toContain("홍길동");
    expect(texts).toContain("901231-1234567");
    expect(texts).toContain("hong@example.com");
  });

  it("array string values are extracted", async () => {
    const original = Buffer.from(sampleToml, "utf-8");
    const parsed = await parser.parse(original);
    const texts = parsed.segments.map((s) => s.text);

    expect(texts).toContain("개인정보");
    expect(texts).toContain("PII");
  });

  it("modified segments reconstruct with changes", async () => {
    const simple = Buffer.from('[user]\nname = "홍길동"\n', "utf-8");
    const parsed = await parser.parse(simple);

    const nameSeg = parsed.segments.find((s) => s.text === "홍길동");
    expect(nameSeg).toBeDefined();
    nameSeg!.text = "PER_001";

    const reconstructed = await parser.reconstruct(parsed);
    const reconObj = TOML.parse(reconstructed.toString("utf-8"), {
      joiner: "\n",
      bigint: false,
    }) as Record<string, Record<string, string>>;
    expect(reconObj["user"]?.["name"]).toBe("PER_001");
  });

  it("tier is 1b", async () => {
    const original = Buffer.from('[x]\nk = "v"\n', "utf-8");
    const parsed = await parser.parse(original);
    expect(parsed.tier).toBe("1b");
  });

  it("format is toml", async () => {
    const original = Buffer.from('[x]\nk = "v"\n', "utf-8");
    const parsed = await parser.parse(original);
    expect(parsed.format).toBe("toml");
  });
});
