import { describe, it, expect } from "vitest";
import { isDeepStrictEqual } from "node:util";
import { JsonParser } from "../../../document/parsers/json.js";

describe("JsonParser — Tier 1b (semantic equality)", () => {
  const parser = new JsonParser();

  it("parse → reconstruct: parsed content is deep equal", async () => {
    const original = Buffer.from(
      JSON.stringify(
        {
          name: "홍길동",
          rrn: "901231-1234567",
          contact: { email: "hong@example.com", phone: "010-1234-5678" },
          tags: ["개인정보", "PII"],
        },
        null,
        2,
      ),
      "utf-8",
    );

    const parsed = await parser.parse(original);
    const reconstructed = await parser.reconstruct(parsed);

    const origObj = JSON.parse(original.toString("utf-8")) as unknown;
    const reconObj = JSON.parse(reconstructed.toString("utf-8")) as unknown;
    expect(isDeepStrictEqual(origObj, reconObj)).toBe(true);
  });

  it("text segments extracted correctly", async () => {
    const original = Buffer.from(
      JSON.stringify({ greeting: "hello", name: "홍길동" }),
      "utf-8",
    );
    const parsed = await parser.parse(original);
    const texts = parsed.segments.map((s) => s.text);
    expect(texts).toContain("hello");
    expect(texts).toContain("홍길동");
  });

  it("nested arrays extracted correctly", async () => {
    const original = Buffer.from(
      JSON.stringify({ items: ["a", "b", "c"] }),
      "utf-8",
    );
    const parsed = await parser.parse(original);
    const texts = parsed.segments.map((s) => s.text);
    expect(texts).toContain("a");
    expect(texts).toContain("b");
    expect(texts).toContain("c");
  });

  it("modified segments reconstruct with changes", async () => {
    const original = Buffer.from(JSON.stringify({ name: "홍길동" }), "utf-8");
    const parsed = await parser.parse(original);
    // Simulate veil: change the name segment
    parsed.segments[0].text = "PER_001";
    const reconstructed = await parser.reconstruct(parsed);
    const reconObj = JSON.parse(reconstructed.toString("utf-8")) as Record<
      string,
      unknown
    >;
    expect(reconObj["name"]).toBe("PER_001");
  });

  it("tier is 1b", async () => {
    const original = Buffer.from("{}", "utf-8");
    const parsed = await parser.parse(original);
    expect(parsed.tier).toBe("1b");
  });
});
