import { describe, it, expect } from "vitest";
import JSZip from "jszip";
import { DocxParser } from "../../../document/parsers/docx.js";

async function makeDocx(bodyXml: string): Promise<Buffer> {
  const zip = new JSZip();
  zip.file(
    "[Content_Types].xml",
    `<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`,
  );
  zip.folder("_rels")!.file(
    ".rels",
    `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`,
  );
  zip.folder("word")!.file(
    "document.xml",
    `<?xml version="1.0" encoding="UTF-8"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>${bodyXml}</w:body>
</w:document>`,
  );
  return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
}

describe("DocxParser — Tier 2", () => {
  const parser = new DocxParser();

  it("tier is 2", async () => {
    const buf = await makeDocx("<w:p><w:r><w:t>hello</w:t></w:r></w:p>");
    const parsed = await parser.parse(buf);
    expect(parsed.tier).toBe("2");
  });

  it("extracts text from w:t nodes", async () => {
    const buf = await makeDocx(
      "<w:p><w:r><w:t>홍길동</w:t></w:r><w:r><w:t>삼성전자</w:t></w:r></w:p>",
    );
    const parsed = await parser.parse(buf);
    const texts = parsed.segments.map((s) => s.text);
    expect(texts).toContain("홍길동");
    expect(texts).toContain("삼성전자");
  });

  it("reconstruct replaces w:t text content", async () => {
    const buf = await makeDocx("<w:p><w:r><w:t>홍길동</w:t></w:r></w:p>");
    const parsed = await parser.parse(buf);

    // Replace the first segment
    parsed.segments[0].text = "PER_001";
    const reconstructed = await parser.reconstruct(parsed);

    // Re-parse and verify replacement
    const reParsed = await parser.parse(reconstructed);
    const texts = reParsed.segments.map((s) => s.text);
    expect(texts).toContain("PER_001");
    expect(texts).not.toContain("홍길동");
  });

  it("non-text XML structure is not corrupted", async () => {
    const buf = await makeDocx(
      '<w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:t>내용</w:t></w:r></w:p>',
    );
    const parsed = await parser.parse(buf);
    expect(parsed.segments.map((s) => s.text)).toContain("내용");
    // Reconstruct without modification should still be valid ZIP
    const reconstructed = await parser.reconstruct(parsed);
    expect(reconstructed.length).toBeGreaterThan(0);
    // Re-loadable as zip
    const zip = await JSZip.loadAsync(reconstructed);
    expect(zip.file("word/document.xml")).not.toBeNull();
  });
});
