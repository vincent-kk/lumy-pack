import { Command } from 'commander';

import { trace } from '../core/core.js';
import { formatHuman, formatJson, formatLlm, formatQuiet } from '../output/formats.js';
import { createErrorResponse } from '../output/normalizer.js';
import { LineLoreError } from '../errors.js';
import type { TraceOptions } from '../types/index.js';

/** CLI-only output options (not part of the library API) */
interface CliOutputOptions {
  json?: boolean;
  output?: 'human' | 'json' | 'llm';
  quiet?: boolean;
}

export function registerTraceCommand(program: Command): void {
  program
    .command('trace <file>')
    .description('Trace a file line to its originating or last-change PR')
    .requiredOption('-L, --line <range>', 'Line number or range (e.g., "42" or "10,50")')
    .option('--mode <mode>', 'Trace mode: change (default) or origin (includes copy/move source)', 'change')
    .option('--deep', 'Enable deep trace for squash PRs')
    .option('--no-ast', 'Disable AST diff analysis')
    .option('--no-cache', 'Disable cache')
    .option('--cache-only', 'Return cached results only (no API calls)')
    .option('--json', 'Output in JSON format')
    .option('-q, --quiet', 'Output PR number only')
    .option('--output <format>', 'Output format: human, json, llm', 'human')
    .option('--no-color', 'Disable colored output')
    .action(async (file: string, opts: Record<string, string | boolean>) => {
      const mode = opts.mode;
      if (mode !== 'origin' && mode !== 'change') {
        throw new Error(`Invalid trace mode: ${String(mode)}`);
      }

      const lineStr = opts.line as string;
      const parts = lineStr.split(',');
      const line = parseInt(parts[0], 10);
      const endLine = parts.length > 1 ? parseInt(parts[1], 10) : undefined;

      const traceOptions: TraceOptions = {
        file,
        line,
        endLine,
        mode,
        deep: opts.deep as boolean | undefined,
        noAst: opts.ast === false,
        noCache: opts.cache === false,
        cacheOnly: opts.cacheOnly as boolean | undefined,
      };

      const cliOptions: CliOutputOptions = {
        json: opts.json as boolean | undefined,
        quiet: opts.quiet as boolean | undefined,
        output: (opts.output as 'human' | 'json' | 'llm') ?? 'human',
      };

      try {
        const result = await trace(traceOptions);

        let output: string;
        if (cliOptions.quiet) {
          output = formatQuiet(result);
        } else if (cliOptions.json || cliOptions.output === 'json') {
          output = formatJson(result);
        } else if (cliOptions.output === 'llm') {
          output = formatLlm(result);
        } else {
          output = formatHuman(result);
        }

        console.log(output);
      } catch (error) {
        if (error instanceof LineLoreError) {
          const response = createErrorResponse('trace', error.code, error.message, 0);
          console.error(JSON.stringify(response));
          process.exit(1);
        }
        throw error;
      }
    });
}
