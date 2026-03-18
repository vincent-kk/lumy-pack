import { Command } from 'commander';

import { trace } from '../core/core.js';
import { formatHuman, formatJson, formatLlm, formatQuiet } from '../output/formats.js';
import { createErrorResponse } from '../output/normalizer.js';
import { LineLoreError } from '../errors.js';
import type { TraceOptions } from '../types/index.js';

export function registerTraceCommand(program: Command): void {
  program
    .command('trace <file>')
    .description('Trace a file line to its originating PR')
    .requiredOption('-L, --line <range>', 'Line number or range (e.g., "42" or "10,50")')
    .option('--deep', 'Enable deep trace for squash PRs')
    .option('--graph-depth <n>', 'Issue graph traversal depth', '0')
    .option('--no-ast', 'Disable AST diff analysis')
    .option('--no-cache', 'Disable cache')
    .option('--json', 'Output in JSON format')
    .option('-q, --quiet', 'Output PR number only')
    .option('--output <format>', 'Output format: human, json, llm', 'human')
    .option('--no-color', 'Disable colored output')
    .action(async (file: string, opts: Record<string, string | boolean>) => {
      const lineStr = opts.line as string;
      const parts = lineStr.split(',');
      const line = parseInt(parts[0], 10);
      const endLine = parts.length > 1 ? parseInt(parts[1], 10) : undefined;

      const options: TraceOptions = {
        file,
        line,
        endLine,
        deep: opts.deep as boolean | undefined,
        graphDepth: parseInt(opts.graphDepth as string, 10) || 0,
        noAst: opts.ast === false,
        noCache: opts.cache === false,
        json: opts.json as boolean | undefined,
        quiet: opts.quiet as boolean | undefined,
        output: (opts.output as 'human' | 'json' | 'llm') ?? 'human',
      };

      try {
        const result = await trace(options);

        let output: string;
        if (options.quiet) {
          output = formatQuiet(result);
        } else if (options.json || options.output === 'json') {
          output = formatJson(result);
        } else if (options.output === 'llm') {
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
