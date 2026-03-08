import { describe, it, expect } from 'vitest';
import JSZip from 'jszip';
import { EpubParser } from '../../../document/parsers/epub.js';

async function makeEpub(chapters: { path: string; html: string }[]): Promise<Buffer> {
  const zip = new JSZip();

  zip.file('mimetype', 'application/epub+zip');
  zip.file('META-INF/container.xml', `<?xml version="1.0"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`);

  const spineItems = chapters.map((_c, i) => `<itemref idref="chapter${i + 1}"/>`).join('\n    ');
  const manifestItems = chapters.map((_c, i) =>
    `<item id="chapter${i + 1}" href="${_c.path.replace('OEBPS/', '')}" media-type="application/xhtml+xml"/>`
  ).join('\n    ');

  zip.file('OEBPS/content.opf', `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="2.0">
  <metadata/>
  <manifest>
    ${manifestItems}
  </manifest>
  <spine>
    ${spineItems}
  </spine>
</package>`);

  for (const chapter of chapters) {
    zip.file(chapter.path, chapter.html);
  }

  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
}

describe('EpubParser — Tier 3', () => {
  const parser = new EpubParser();

  it('tier is 3', async () => {
    const buf = await makeEpub([{
      path: 'OEBPS/chapter1.html',
      html: '<html><body><p>hello</p></body></html>',
    }]);
    const parsed = await parser.parse(buf);
    expect(parsed.tier).toBe('3');
  });

  it('extracts text from HTML chapters', async () => {
    const buf = await makeEpub([{
      path: 'OEBPS/chapter1.html',
      html: '<html><body><h1>홍길동</h1><p>이야기 내용</p></body></html>',
    }]);
    const parsed = await parser.parse(buf);
    const texts = parsed.segments.map(s => s.text);
    expect(texts.some(t => t.includes('홍길동'))).toBe(true);
    expect(texts.some(t => t.includes('이야기 내용'))).toBe(true);
  });

  it('extracts text from multiple chapters', async () => {
    const buf = await makeEpub([
      { path: 'OEBPS/chapter1.html', html: '<html><body><p>챕터 1</p></body></html>' },
      { path: 'OEBPS/chapter2.html', html: '<html><body><p>챕터 2</p></body></html>' },
    ]);
    const parsed = await parser.parse(buf);
    const texts = parsed.segments.map(s => s.text);
    expect(texts.some(t => t.includes('챕터 1'))).toBe(true);
    expect(texts.some(t => t.includes('챕터 2'))).toBe(true);
  });

  it('reconstruct replaces text node content', async () => {
    const buf = await makeEpub([{
      path: 'OEBPS/chapter1.html',
      html: '<html><body><p>홍길동</p></body></html>',
    }]);
    const parsed = await parser.parse(buf);
    parsed.segments[0].text = 'PER_001';
    const reconstructed = await parser.reconstruct(parsed);

    const reParsed = await parser.parse(reconstructed);
    const texts = reParsed.segments.map(s => s.text);
    expect(texts.some(t => t.includes('PER_001'))).toBe(true);
    expect(texts.some(t => t.includes('홍길동'))).toBe(false);
  });
});
