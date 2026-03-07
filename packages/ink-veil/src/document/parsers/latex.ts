import type { FidelityTier } from '../../types.js';
import type { FormatParser, ParsedDocument } from '../types.js';

/**
 * LaTeX Parser — Tier 4 (experimental, token-level extraction).
 *
 * LIMITATIONS:
 * - LaTeX full reconstruction is not possible without a full LaTeX engine.
 * - This implementation strips common LaTeX commands and extracts text tokens.
 * - Mathematical expressions, custom macros, and bibliographies are ignored.
 * - No round-trip guarantee. Verification returns passed: null.
 */

// LaTeX environments that contain non-text content (skip)
const SKIP_ENVIRONMENTS = [
  'equation', 'equation*', 'align', 'align*', 'math', 'displaymath',
  'verbatim', 'lstlisting', 'minted', 'tikzpicture', 'figure',
];

const SKIP_ENV_PATTERN = new RegExp(
  `\\\\begin\\{(${SKIP_ENVIRONMENTS.join('|')})\\}[\\s\\S]*?\\\\end\\{\\1\\}`,
  'g',
);

function extractLatexText(source: string): string[] {
  let text = source;

  // Remove skippable environments
  text = text.replace(SKIP_ENV_PATTERN, ' ');

  // Remove comments
  text = text.replace(/%[^\n]*/g, '');

  // Remove common LaTeX commands (preserve their arguments for text commands)
  // Text-producing commands: \textbf{}, \textit{}, \emph{}, \section{}, etc.
  text = text.replace(/\\(?:textbf|textit|emph|text|section\*?|subsection\*?|subsubsection\*?|chapter|caption|label|ref|cite|footnote)\{([^}]*)\}/g, '$1');

  // Remove remaining commands with arguments
  text = text.replace(/\\[a-zA-Z]+\*?\{[^}]*\}/g, ' ');
  text = text.replace(/\\[a-zA-Z]+\*?\[[^\]]*\]/g, ' ');
  text = text.replace(/\\[a-zA-Z]+\*?/g, ' ');

  // Remove remaining LaTeX special characters
  text = text.replace(/[{}$^_&~#]/g, ' ');

  // Split into paragraphs (double newlines)
  return text
    .split(/\n{2,}/)
    .map(p => p.replace(/\s+/g, ' ').trim())
    .filter(p => p.length > 0);
}

export class LatexParser implements FormatParser {
  readonly tier: FidelityTier = '4';

  async parse(buffer: Buffer, _encoding?: string): Promise<ParsedDocument> {
    process.stderr.write(
      '[ink-veil] Tier 4: LaTeX parsing is experimental — no round-trip guarantee.\n' +
      '[ink-veil] Tier 4: Math, custom macros, and bibliography entries are ignored.\n',
    );

    const source = buffer.toString('utf-8');
    const paragraphs = extractLatexText(source);
    const segments: ParsedDocument['segments'] = paragraphs.map((text, i) => ({
      text,
      position: { type: 'generic', info: { paragraph: i } },
      skippable: false,
    }));

    return {
      format: 'latex',
      tier: this.tier,
      encoding: 'utf-8',
      segments,
      metadata: {
        guarantee: 'none',
        limitation: 'LaTeX reconstruction not possible. Token-level text extraction only. Math and macros ignored.',
      },
      originalBuffer: buffer,
    };
  }

  async reconstruct(parsedDoc: ParsedDocument): Promise<Buffer> {
    process.stderr.write(
      '[ink-veil] Tier 4: LaTeX reconstruction not supported — returning original buffer.\n',
    );
    return parsedDoc.originalBuffer ?? Buffer.alloc(0);
  }
}
