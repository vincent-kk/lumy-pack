import { Command } from 'commander';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { DetectionPipeline } from '../detection/index.js';
import { ErrorCode } from '../errors/types.js';

export function buildDetectCommand(): Command {
  const cmd = new Command('detect').description('Detect PII without transformation (dry-run)');

  cmd
    .argument('[files...]', 'Input files to scan')
    .option('-c, --categories <list>', 'Comma-separated entity categories to detect')
    .option('--stdin', 'Read text from stdin')
    .option('--json', 'Output structured JSON to stdout')
    .option('-v, --verbose', 'Detailed logging to stderr')
    .action(async (files: string[], opts: Record<string, unknown>) => {
      const jsonMode = Boolean(opts['json']);
      const stdinMode = Boolean(opts['stdin']);
      const categories = opts['categories']
        ? String(opts['categories']).split(',').map((s) => s.trim())
        : undefined;

      const pipeline = new DetectionPipeline({
        config: categories ? { priorityOrder: ['MANUAL', 'REGEX', 'NER'], categories } : undefined,
      });

      const results: unknown[] = [];
      const startTotal = Date.now();

      const processText = (text: string, inputName: string) => {
        const spans = pipeline.detect(text);

        const summary: Record<string, number> = {};
        for (const span of spans) {
          summary[span.category] = (summary[span.category] ?? 0) + 1;
        }
        summary['total'] = spans.length;

        if (!jsonMode) {
          process.stdout.write(`${inputName}: ${spans.length} entities found\n`);
          for (const span of spans) {
            process.stdout.write(`  [${span.category}] "${span.text}" (${span.start}-${span.end}, ${span.method}, conf=${span.confidence.toFixed(2)})\n`);
          }
        }

        return {
          input: inputName,
          entities: spans.map((s) => ({
            text: s.text,
            category: s.category,
            method: s.method,
            confidence: s.confidence,
            start: s.start,
            end: s.end,
          })),
          summary,
        };
      };

      if (stdinMode) {
        const chunks: Buffer[] = [];
        for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
        const text = Buffer.concat(chunks).toString('utf-8');
        results.push(processText(text, '(stdin)'));
      } else {
        if (files.length === 0) {
          process.stderr.write('ink-veil detect: No input files specified. Use --stdin or provide file paths.\n');
          process.exit(ErrorCode.INVALID_ARGUMENTS);
        }

        for (const file of files) {
          const abs = resolve(file);
          if (!existsSync(abs)) {
            process.stderr.write(`ink-veil: File not found: ${abs}\n`);
            process.exit(ErrorCode.FILE_NOT_FOUND);
          }
          const text = await readFile(abs, 'utf-8');
          results.push(processText(text, abs));
        }
      }

      if (jsonMode) {
        const output = {
          success: true,
          command: 'detect',
          results,
          timing: { totalMs: Date.now() - startTotal },
        };
        process.stdout.write(JSON.stringify(output, null, 2) + '\n');
      }

      process.exit(ErrorCode.SUCCESS);
    });

  return cmd;
}
