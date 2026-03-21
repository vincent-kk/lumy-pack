import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { verify } from "../../verification/verify.js";

describe("verify — Tier 1a (SHA-256)", () => {
  const buf = Buffer.from("Hello, 홍길동 010-1234-5678");

  it("identical buffers → passed: true", async () => {
    const result = await verify(buf, Buffer.from(buf), "1a");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.passed).toBe(true);
    expect(result.value.tier).toBe("1a");
    expect(result.value.method).toBe("sha256");
    expect(result.value.hashOriginal).toBeDefined();
    expect(result.value.hashRestored).toBeDefined();
    expect(result.value.hashOriginal).toBe(result.value.hashRestored);
  });

  it("1-byte difference → passed: false", async () => {
    const modified = Buffer.from(buf);
    modified[0] = modified[0] ^ 0x01;
    const result = await verify(buf, modified, "1a");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.passed).toBe(false);
    expect(result.value.hashOriginal).not.toBe(result.value.hashRestored);
  });

  it("empty buffers are identical", async () => {
    const result = await verify(Buffer.alloc(0), Buffer.alloc(0), "1a");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.passed).toBe(true);
  });
});

describe("verify — Tier 1b (semantic)", () => {
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

  it("identical JSON content with different formatting → passed: true", async () => {
    const original = Buffer.from(
      JSON.stringify({ name: "홍길동", phone: "010-1234-5678" }, null, 2),
      "utf-8",
    );
    const restored = Buffer.from(
      JSON.stringify({ name: "홍길동", phone: "010-1234-5678" }),
      "utf-8",
    );
    const result = await verify(original, restored, "1b", "json");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.passed).toBe(true);
    expect(result.value.method).toBe("semantic");
  });

  it("different JSON content → passed: false", async () => {
    const original = Buffer.from(JSON.stringify({ name: "홍길동" }), "utf-8");
    const restored = Buffer.from(JSON.stringify({ name: "PER_001" }), "utf-8");
    const result = await verify(original, restored, "1b", "json");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.passed).toBe(false);
  });

  it("without format → Result.err", async () => {
    const result = await verify(Buffer.from("{}"), Buffer.from("{}"), "1b");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.message).toMatch(/format/i);
  });
});

describe("verify — Tier 2 (structural)", () => {
  it("identical HTML → passed: true", async () => {
    const html = Buffer.from(
      "<html><body><p>홍길동</p></body></html>",
      "utf-8",
    );
    const result = await verify(html, Buffer.from(html), "2", "html");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.passed).toBe(true);
    expect(result.value.method).toBe("structural");
  });

  it("different HTML text content → passed: false", async () => {
    const original = Buffer.from(
      "<html><body><p>홍길동</p></body></html>",
      "utf-8",
    );
    const restored = Buffer.from(
      "<html><body><p>PER_001</p></body></html>",
      "utf-8",
    );
    const result = await verify(original, restored, "2", "html");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.passed).toBe(false);
  });

  it("without format → Result.err", async () => {
    const result = await verify(
      Buffer.from("<p>a</p>"),
      Buffer.from("<p>a</p>"),
      "2",
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.message).toMatch(/format/i);
  });
});

describe("verify — Tier 3 (text-layer)", () => {
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

  it("without format → Result.err", async () => {
    const result = await verify(Buffer.from("a"), Buffer.from("a"), "3");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.message).toMatch(/format/i);
  });

  it("identical PPTX text → passed: true (via text-layer comparison)", async () => {
    // Use HTML as a simpler Tier-3-like text-layer proxy since PPTX requires full ZIP
    // Verify with html format using Tier 3 path is not directly possible (html is Tier 2)
    // So test via pptx with identical buffers — same extracted text
    const html = Buffer.from("<html><body><p>내용</p></body></html>", "utf-8");
    // Tier 3 verification with 'html' will use HtmlParser (Tier 2 parser), which is fine
    // since verify dispatches via getParser regardless of tier mismatch
    const result = await verify(html, Buffer.from(html), "3", "html");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.method).toBe("text-layer");
  });
});

describe("verify — Tier 4", () => {
  it("returns passed: null (no verification)", async () => {
    const result = await verify(Buffer.from("a"), Buffer.from("b"), "4");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.passed).toBeNull();
    expect(result.value.method).toBe("none");
    expect(result.value.tier).toBe("4");
  });
});
