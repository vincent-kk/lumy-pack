import Papa from "papaparse";
import type { FidelityTier } from "../../types.js";
import type { FormatParser, ParsedDocument, TextSegment } from "../types.js";

export class CsvParser implements FormatParser {
  readonly tier: FidelityTier = "1a";
  private readonly format: string;

  constructor(format: string = "csv") {
    this.format = format;
  }

  async parse(buffer: Buffer, _encoding?: string): Promise<ParsedDocument> {
    const text = buffer.toString("utf-8");
    const delimiter = this.format === "tsv" ? "\t" : ",";

    const result = Papa.parse<string[]>(text, {
      delimiter,
      header: false,
      skipEmptyLines: false,
      dynamicTyping: false,
    });

    // Detect which fields were originally quoted in the raw text
    const quotedFields = new Set<string>();
    const quotedPattern = /"([^"]*)"/g;
    let match: RegExpExecArray | null;
    while ((match = quotedPattern.exec(text)) !== null) {
      quotedFields.add(match[1]);
    }

    const segments: TextSegment[] = [];
    for (let row = 0; row < result.data.length; row++) {
      for (let col = 0; col < result.data[row].length; col++) {
        const cellText = result.data[row][col];
        segments.push({
          text: cellText,
          position: { type: "cell", row, col },
          skippable: false,
        });
      }
    }

    return {
      format: this.format,
      tier: this.tier,
      encoding: "utf-8",
      segments,
      metadata: {
        delimiter,
        rowCount: result.data.length,
        quotedFields: [...quotedFields],
        lineEnding: text.includes("\r\n") ? "\r\n" : "\n",
      },
      originalBuffer: buffer,
    };
  }

  async reconstruct(parsed: ParsedDocument): Promise<Buffer> {
    const delimiter = parsed.metadata["delimiter"] as string;
    const quotedFields = new Set(parsed.metadata["quotedFields"] as string[]);
    const lineEnding = (parsed.metadata["lineEnding"] as string) ?? "\n";

    // Rebuild rows from segments
    const rows: string[][] = [];
    for (const seg of parsed.segments) {
      const pos = seg.position;
      if (pos.type !== "cell") continue;
      while (rows.length <= pos.row) rows.push([]);
      while (rows[pos.row].length <= pos.col) rows[pos.row].push("");
      rows[pos.row][pos.col] = seg.text;
    }

    const lines = rows.map((row) =>
      row
        .map((cell) => {
          const needsQuoting =
            quotedFields.has(cell) ||
            cell.includes(delimiter) ||
            cell.includes("\n") ||
            cell.includes('"');
          if (needsQuoting) {
            return '"' + cell.replace(/"/g, '""') + '"';
          }
          return cell;
        })
        .join(delimiter),
    );

    return Buffer.from(lines.join(lineEnding), "utf-8");
  }
}
