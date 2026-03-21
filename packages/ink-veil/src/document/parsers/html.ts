import { JSDOM } from "jsdom";
import type { FidelityTier } from "../../types.js";
import type { FormatParser, ParsedDocument, TextSegment } from "../types.js";

const SKIP_TAGS = new Set(["script", "style", "code", "pre"]);

function collectTextNodes(
  node: Node,
  segments: TextSegment[],
  index: { n: number },
): void {
  if (node.nodeType === node.TEXT_NODE) {
    const text = node.textContent ?? "";
    if (text.trim()) {
      segments.push({
        text,
        position: { type: "node", nodeId: String(index.n++) },
        skippable: false,
      });
    } else {
      // Whitespace-only text nodes: still track with empty marker
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
    collectTextNodes(child, segments, index);
  }
}

function applyTextNodes(
  node: Node,
  segmentMap: Map<string, string>,
  index: { n: number },
): void {
  if (node.nodeType === node.TEXT_NODE) {
    const text = node.textContent ?? "";
    const id = String(index.n++);
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
    applyTextNodes(child, segmentMap, index);
  }
}

export class HtmlParser implements FormatParser {
  readonly tier: FidelityTier = "2";

  async parse(buffer: Buffer, _encoding?: string): Promise<ParsedDocument> {
    const html = buffer.toString("utf-8");
    const dom = new JSDOM(html);
    const segments: TextSegment[] = [];
    const index = { n: 0 };
    collectTextNodes(
      dom.window.document.body ?? dom.window.document,
      segments,
      index,
    );

    return {
      format: "html",
      tier: this.tier,
      encoding: "utf-8",
      segments,
      metadata: { originalHtml: html },
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

    const html = parsedDoc.metadata["originalHtml"] as string;
    const dom = new JSDOM(html);
    const index = { n: 0 };
    applyTextNodes(
      dom.window.document.body ?? dom.window.document,
      segmentMap,
      index,
    );

    const result = dom.serialize();
    return Buffer.from(result, "utf-8");
  }
}
