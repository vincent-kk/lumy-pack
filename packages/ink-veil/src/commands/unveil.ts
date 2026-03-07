import { Command } from 'commander';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve, basename, join } from 'node:path';
import { loadDictionary } from '../dictionary/io.js';
import { veilTextFromDictionary } from '../transform/veil-from-dictionary.js';
import { ErrorCode } from '../errors/types.js';

export function buildUnveilCommand(): Command {
  const cmd = new Command('unveil').description('Restore original PII from veiled documents');

  cmd
    .argument('[files...]', 'Input veiled files to restore')
    .option('-o, --output <dir>', 'Output directory for restored files', './restored/')
    .option('-d, --dictionary <path>', 'Dictionary file', './dictionary.json')
    .option('--stdin', 'Read veiled text from stdin')
    .option('--json', 'Output structured JSON with integrity report')
    .option('--strict', 'Fail with exit code 8 if tokenIntegrity < 1.0')
    .option('-v, --verbose', 'Detailed logging to stderr')
    .action(async (files: string[], opts: Record<string, unknown>) => {
      const jsonMode = Boolean(opts['json']);
      const stdinMode = Boolean(opts['stdin']);
      const strict = Boolean(opts['strict']);
      const dictPath = resolve(String(opts['dictionary'] ?? './dictionary.json'));
      const outputDir = resolve(String(opts['output'] ?? './restored/'));

      if (!existsSync(dictPath)) {
        process.stderr.write(`ink-veil: Dictionary not found: ${dictPath}\n`);
        process.exit(ErrorCode.DICTIONARY_ERROR);
      }

      let dict;
      try {
        dict = await loadDictionary(dictPath);
      } catch (e) {
        process.stderr.write(`ink-veil: Failed to load dictionary: ${e instanceof Error ? e.message : String(e)}\n`);
        process.exit(ErrorCode.DICTIONARY_ERROR);
      }

      const results: unknown[] = [];
      const startTotal = Date.now();

      const processText = async (text: string, inputName: string, outputPath?: string) => {
        const { text: restored, substitutions } = veilTextFromDictionary(text, dict);

        // Calculate token integrity: count how many dictionary tokens appear in original text
        const allTokens = [...dict.entries()].map((e) => e.tokenPlain);
        const foundInOriginal = allTokens.filter((t) => text.includes(t));
        const tokenIntegrity = allTokens.length > 0 ? foundInOriginal.length / allTokens.length : 1.0;

        if (strict && tokenIntegrity < 1.0) {
          process.stderr.write(`ink-veil: Token integrity ${tokenIntegrity.toFixed(2)} < 1.0 (--strict mode)\n`);
          process.exit(ErrorCode.TOKEN_INTEGRITY_BELOW_THRESHOLD);
        }

        if (outputPath) {
          await mkdir(outputDir, { recursive: true });
          await writeFile(outputPath, restored, 'utf-8');
        } else {
          process.stdout.write(restored + '\n');
        }

        return {
          input: inputName,
          output: outputPath ?? '(stdout)',
          tokenIntegrity,
          substitutions,
        };
      };

      if (stdinMode) {
        const chunks: Buffer[] = [];
        for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
        const text = Buffer.concat(chunks).toString('utf-8');
        const result = await processText(text, '(stdin)');
        results.push(result);
      } else {
        if (files.length === 0) {
          process.stderr.write('ink-veil unveil: No input files specified. Use --stdin or provide file paths.\n');
          process.exit(ErrorCode.INVALID_ARGUMENTS);
        }

        for (const file of files) {
          const abs = resolve(file);
          if (!existsSync(abs)) {
            process.stderr.write(`ink-veil: File not found: ${abs}\n`);
            process.exit(ErrorCode.FILE_NOT_FOUND);
          }

          const text = await readFile(abs, 'utf-8');
          const outFile = join(outputDir, basename(abs));
          const result = await processText(text, abs, outFile);
          results.push(result);
        }
      }

      if (jsonMode) {
        const output = {
          success: true,
          command: 'unveil',
          results,
          timing: { totalMs: Date.now() - startTotal },
        };
        process.stdout.write(JSON.stringify(output, null, 2) + '\n');
      }

      process.exit(ErrorCode.SUCCESS);
    });

  return cmd;
}
