import { describe, it, expect } from 'vitest';
import JSZip from 'jszip';
import { PptxParser } from '../../../document/parsers/pptx.js';

async function makePptx(slideXmls: string[]): Promise<Buffer> {
  const zip = new JSZip();

  zip.file('[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  ${slideXmls.map((_, i) => `<Override PartName="/ppt/slides/slide${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`).join('\n  ')}
</Types>`);

  zip.folder('_rels')!.file('.rels', `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"/>`);

  const slidesFolder = zip.folder('ppt')!.folder('slides')!;
  for (let i = 0; i < slideXmls.length; i++) {
    slidesFolder.file(`slide${i + 1}.xml`, slideXmls[i]);
  }

  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
}

function makeSlideXml(texts: string[]): string {
  const runs = texts.map(t =>
    `<a:r><a:t>${t}</a:t></a:r>`
  ).join('');
  return `<?xml version="1.0" encoding="UTF-8"?>
<p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"
       xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
  <p:cSld><p:spTree>
    <p:sp><p:txBody><a:bodyPr/><a:p>${runs}</a:p></p:txBody></p:sp>
  </p:spTree></p:cSld>
</p:sld>`;
}

describe('PptxParser — Tier 3', () => {
  const parser = new PptxParser();

  it('tier is 3', async () => {
    const buf = await makePptx([makeSlideXml(['hello'])]);
    const parsed = await parser.parse(buf);
    expect(parsed.tier).toBe('3');
  });

  it('extracts a:t text from slide XML', async () => {
    const buf = await makePptx([makeSlideXml(['홍길동', '삼성전자'])]);
    const parsed = await parser.parse(buf);
    const texts = parsed.segments.map(s => s.text);
    expect(texts).toContain('홍길동');
    expect(texts).toContain('삼성전자');
  });

  it('extracts text from multiple slides', async () => {
    const buf = await makePptx([
      makeSlideXml(['슬라이드 1 내용']),
      makeSlideXml(['슬라이드 2 내용']),
    ]);
    const parsed = await parser.parse(buf);
    const texts = parsed.segments.map(s => s.text);
    expect(texts.some(t => t.includes('슬라이드 1'))).toBe(true);
    expect(texts.some(t => t.includes('슬라이드 2'))).toBe(true);
  });

  it('reconstruct replaces a:t text content', async () => {
    const buf = await makePptx([makeSlideXml(['홍길동'])]);
    const parsed = await parser.parse(buf);
    parsed.segments[0].text = 'PER_001';
    const reconstructed = await parser.reconstruct(parsed);

    const reParsed = await parser.parse(reconstructed);
    const texts = reParsed.segments.map(s => s.text);
    expect(texts).toContain('PER_001');
    expect(texts).not.toContain('홍길동');
  });

  it('reconstructed output is valid ZIP', async () => {
    const buf = await makePptx([makeSlideXml(['내용'])]);
    const parsed = await parser.parse(buf);
    const reconstructed = await parser.reconstruct(parsed);
    const zip = await JSZip.loadAsync(reconstructed);
    expect(zip.file('ppt/slides/slide1.xml')).not.toBeNull();
  });
});
