import { describe, it, expect } from "vitest";
import { validateMetadata } from "../../schemas/metadata.schema.js";
import { makeMetadata, makeFileEntry } from "../helpers/fixtures.js";

describe("validateMetadata", () => {
  it("validates a complete valid metadata object", () => {
    const metadata = makeMetadata();
    const result = validateMetadata(metadata);
    expect(result.valid).toBe(true);
    expect(result.errors).toBeUndefined();
  });

  it("validates metadata with multiple files", () => {
    const metadata = makeMetadata({
      files: [
        makeFileEntry({ path: "file1.txt" }),
        makeFileEntry({ path: "file2.txt" }),
      ],
      summary: {
        fileCount: 2,
        totalSize: 2048,
      },
    });
    const result = validateMetadata(metadata);
    expect(result.valid).toBe(true);
  });

  it("validates metadata with empty files array", () => {
    const metadata = makeMetadata({
      files: [],
      summary: {
        fileCount: 0,
        totalSize: 0,
      },
    });
    const result = validateMetadata(metadata);
    expect(result.valid).toBe(true);
  });

  it("fails when version is missing", () => {
    const metadata = makeMetadata();
    delete (metadata as any).version;
    const result = validateMetadata(metadata);
    expect(result.valid).toBe(false);
    expect(result.errors?.some((e) => e.includes("version"))).toBe(true);
  });

  it("fails when toolVersion is missing", () => {
    const metadata = makeMetadata();
    delete (metadata as any).toolVersion;
    const result = validateMetadata(metadata);
    expect(result.valid).toBe(false);
    expect(result.errors?.some((e) => e.includes("toolVersion"))).toBe(true);
  });

  it("fails when createdAt is missing", () => {
    const metadata = makeMetadata();
    delete (metadata as any).createdAt;
    const result = validateMetadata(metadata);
    expect(result.valid).toBe(false);
    expect(result.errors?.some((e) => e.includes("createdAt"))).toBe(true);
  });

  it("fails when hostname is missing", () => {
    const metadata = makeMetadata();
    delete (metadata as any).hostname;
    const result = validateMetadata(metadata);
    expect(result.valid).toBe(false);
    expect(result.errors?.some((e) => e.includes("hostname"))).toBe(true);
  });

  it("fails when system is missing", () => {
    const metadata = makeMetadata();
    delete (metadata as any).system;
    const result = validateMetadata(metadata);
    expect(result.valid).toBe(false);
    expect(result.errors?.some((e) => e.includes("system"))).toBe(true);
  });

  it("fails when system.platform is missing", () => {
    const metadata = makeMetadata({
      system: { release: "5.10.0", arch: "x64" } as any,
    });
    const result = validateMetadata(metadata);
    expect(result.valid).toBe(false);
  });

  it("fails when config is missing", () => {
    const metadata = makeMetadata();
    delete (metadata as any).config;
    const result = validateMetadata(metadata);
    expect(result.valid).toBe(false);
    expect(result.errors?.some((e) => e.includes("config"))).toBe(true);
  });

  it("fails when files is missing", () => {
    const metadata = makeMetadata();
    delete (metadata as any).files;
    const result = validateMetadata(metadata);
    expect(result.valid).toBe(false);
    expect(result.errors?.some((e) => e.includes("files"))).toBe(true);
  });

  it("fails when summary is missing", () => {
    const metadata = makeMetadata();
    delete (metadata as any).summary;
    const result = validateMetadata(metadata);
    expect(result.valid).toBe(false);
    expect(result.errors?.some((e) => e.includes("summary"))).toBe(true);
  });

  it("fails when file entry is missing required fields", () => {
    const metadata = makeMetadata({
      files: [{ path: "test.txt" } as any],
    });
    const result = validateMetadata(metadata);
    expect(result.valid).toBe(false);
  });

  it("fails when file entry has invalid size (negative)", () => {
    const metadata = makeMetadata({
      files: [makeFileEntry({ size: -1 })],
    });
    const result = validateMetadata(metadata);
    expect(result.valid).toBe(false);
    expect(result.errors?.some((e) => e.includes("size"))).toBe(true);
  });

  it("fails when summary.fileCount is negative", () => {
    const metadata = makeMetadata({
      summary: { fileCount: -1, totalSize: 1024 },
    });
    const result = validateMetadata(metadata);
    expect(result.valid).toBe(false);
  });

  it("fails when summary.totalSize is negative", () => {
    const metadata = makeMetadata({
      summary: { fileCount: 1, totalSize: -1 },
    });
    const result = validateMetadata(metadata);
    expect(result.valid).toBe(false);
  });

  it("fails when version is not a string", () => {
    const metadata = makeMetadata({ version: 1 as any });
    const result = validateMetadata(metadata);
    expect(result.valid).toBe(false);
  });

  it("fails when files is not an array", () => {
    const metadata = makeMetadata({ files: "not-an-array" as any });
    const result = validateMetadata(metadata);
    expect(result.valid).toBe(false);
  });

  it("fails with additional properties in file entry", () => {
    const metadata = makeMetadata({
      files: [{ ...makeFileEntry(), extraProp: "value" } as any],
    });
    const result = validateMetadata(metadata);
    expect(result.valid).toBe(false);
  });

  it("fails with additional properties in system", () => {
    const metadata = makeMetadata({
      system: {
        platform: "linux",
        release: "5.10.0",
        arch: "x64",
        extraProp: "value",
      } as any,
    });
    const result = validateMetadata(metadata);
    expect(result.valid).toBe(false);
  });

  it("accepts file entry with optional type field", () => {
    const metadata = makeMetadata({
      files: [makeFileEntry({ type: "file" })],
    });
    const result = validateMetadata(metadata);
    expect(result.valid).toBe(true);
  });

  it("validates config with optional destination", () => {
    const metadata = makeMetadata({
      config: {
        filename: "backup.tar.gz",
        destination: "/backups",
      },
    });
    const result = validateMetadata(metadata);
    expect(result.valid).toBe(true);
  });
});
