import { filter, forEach } from "@winglet/common-utils";

import JSZip from "jszip";
import { JSDOM } from "jsdom";
import type { FidelityTier } from "../../types.js";
import type { FormatParser, ParsedDocument, TextSegment } from "../types.js";

const SKIP_TAGS = new Set(["script", "style", "code", "pre"]);

function collectTextNodes(
  node: Node,
  chapterPath: string,
  segments: TextSegment[],
  index: { n: number },
): void {
  if (node.nodeType === node.TEXT_NODE) {
    const text = node.textContent ?? "";
    if (text.trim()) {
      segments.push({
        text,
        position: { type: "node", nodeId: `${chapterPath}::${index.n++}` },
        skippable: false,
      });
    } else {
      index.n++;
    }
    return;
  }
  if (node.nodeType === node.ELEMENT_NODE) {
    const el = node as Element;
    if (SKIP_TAGS.has(el.tagName.toLowerCase())) {
      index.n++;
      return;
    }
  }
  for (const child of Array.from(node.childNodes)) {
    collectTextNodes(child, chapterPath, segments, index);
  }
}

function applyTextNodes(
  node: Node,
  chapterPath: string,
  segmentMap: Map<string, string>,
  index: { n: number },
): void {
  if (node.nodeType === node.TEXT_NODE) {
    const text = node.textContent ?? "";
    const id = `${chapterPath}::${index.n++}`;
    if (text.trim() && segmentMap.has(id)) {
      node.textContent = segmentMap.get(id)!;
    }
    return;
  }
  if (node.nodeType === node.ELEMENT_NODE) {
    const el = node as Element;
    if (SKIP_TAGS.has(el.tagName.toLowerCase())) {
      index.n++;
      return;
    }
  }
  for (const child of Array.from(node.childNodes)) {
    applyTextNodes(child, chapterPath, segmentMap, index);
  }
}

async function findChapterPaths(zip: JSZip): Promise<string[]> {
  // Read OPF manifest to find spine items in order
  const opfCandidates = filter(
    Object.keys(zip.files),
    (name) => name.endsWith(".opf") || name === "content.opf",
  );

  if (opfCandidates.length === 0) {
    // Fallback: any HTML/XHTML files in OEBPS or similar
    return filter(Object.keys(zip.files), (name) =>
      /\.(html|xhtml|htm)$/i.test(name),
    ).sort();
  }

  const opfFile = zip.file(opfCandidates[0]);
  if (!opfFile) return [];

  const opfText = await opfFile.async("string");
  const dom = new JSDOM(opfText, { contentType: "application/xml" });
  const doc = dom.window.document;

  // Get manifest item hrefs in spine order
  const spineItems = Array.from(doc.querySelectorAll("spine itemref"));
  const manifest = new Map<string, string>();
  doc.querySelectorAll("manifest item").forEach((item) => {
    const id = item.getAttribute("id");
    const href = item.getAttribute("href");
    const mediaType = item.getAttribute("media-type") ?? "";
    if (
      id &&
      href &&
      (mediaType.includes("html") || mediaType.includes("xhtml"))
    ) {
      manifest.set(id, href);
    }
  });

  const basePath = opfCandidates[0].includes("/")
    ? opfCandidates[0].substring(0, opfCandidates[0].lastIndexOf("/") + 1)
    : "";

  const paths: string[] = [];
  forEach(spineItems, (item) => {
    const idref = item.getAttribute("idref") ?? "";
    const href = manifest.get(idref);
    if (href) paths.push(`${basePath}${href}`);
  });
  return paths;
}

export class EpubParser implements FormatParser {
  readonly tier: FidelityTier = "3";

  async parse(buffer: Buffer, _encoding?: string): Promise<ParsedDocument> {
    const zip = await JSZip.loadAsync(buffer);
    const chapters = await findChapterPaths(zip);
    const segments: TextSegment[] = [];
    const chapterContents: Record<string, string> = {};

    for (const chapterPath of chapters) {
      const file = zip.file(chapterPath);
      if (!file) continue;
      const html = await file.async("string");
      chapterContents[chapterPath] = html;

      const dom = new JSDOM(html, { contentType: "text/html" });
      const index = { n: 0 };
      collectTextNodes(
        dom.window.document.body ?? dom.window.document,
        chapterPath,
        segments,
        index,
      );
    }

    return {
      format: "epub",
      tier: this.tier,
      encoding: "utf-8",
      segments,
      metadata: { chapterContents, chapters, originalBuffer: buffer },
      originalBuffer: buffer,
    };
  }

  async reconstruct(parsedDoc: ParsedDocument): Promise<Buffer> {
    const segmentMap = new Map<string, string>();
    for (const seg of parsedDoc.segments) {
      if (seg.position.type === "node") {
        segmentMap.set(seg.position.nodeId, seg.text);
      }
    }

    const chapterContents = parsedDoc.metadata["chapterContents"] as Record<
      string,
      string
    >;
    const originalBuffer = parsedDoc.metadata["originalBuffer"] as Buffer;
    const zip = await JSZip.loadAsync(originalBuffer);

    for (const [chapterPath, html] of Object.entries(chapterContents)) {
      const dom = new JSDOM(html, { contentType: "text/html" });
      const index = { n: 0 };
      applyTextNodes(
        dom.window.document.body ?? dom.window.document,
        chapterPath,
        segmentMap,
        index,
      );
      zip.file(chapterPath, dom.serialize());
    }

    return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
  }
}
