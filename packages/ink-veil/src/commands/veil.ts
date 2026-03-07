import { Command } from 'commander';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve, basename, join } from 'node:path';
import { Dictionary } from '../dictionary/dictionary.js';
import { loadDictionary, saveDictionary } from '../dictionary/io.js';
import { DetectionPipeline } from '../detection/index.js';
import { getParser } from '../document/parser.js';
import { veilTextFromSpans } from '../transform/veil-from-spans.js';
import { ErrorCode } from '../errors/types.js';

export function buildVeilCommand(): Command {
  const cmd = new Command('veil').description('Detect and replace PII in documents');

  cmd
    .argument('[files...]', 'Input files to veil')
    .option('-o, --output <dir>', 'Output directory for veiled files', './veiled/')
    .option('-d, --dictionary <path>', 'Dictionary file (created if absent)', './dictionary.json')
    .option('-t, --token-mode <mode>', 'Token format: tag, bracket, plain', 'tag')
    .option('-c, --categories <list>', 'Comma-separated entity categories to detect')
    .option('--no-ner', 'Disable NER, use regex-only mode')
    .option('--stdin', 'Read text from stdin')
    .option('--json', 'Output structured JSON to stdout')
    .option('--encoding <enc>', 'Text encoding for input files', 'utf-8')
    .option('-v, --verbose', 'Detailed logging to stderr')
    .action(async (files: string[], opts: Record<string, unknown>) => {
      const jsonMode = Boolean(opts['json']);
      const stdinMode = Boolean(opts['stdin']);
      const verbose = Boolean(opts['verbose']);
      const dictPath = resolve(String(opts['dictionary'] ?? './dictionary.json'));
      const outputDir = resolve(String(opts['output'] ?? './veiled/'));
      const tokenMode = String(opts['tokenMode'] ?? 'tag') as 'tag' | 'bracket' | 'plain';
      const categories = opts['categories']
        ? String(opts['categories']).split(',').map((s) => s.trim())
        : undefined;

      const log = (msg: string) => {
        if (verbose) process.stderr.write(msg + '\n');
      };

      // Load or create dictionary
      let dict: Dictionary;
      if (existsSync(dictPath)) {
        try {
          dict = await loadDictionary(dictPath);
        } catch (e) {
          process.stderr.write(`ink-veil: Failed to load dictionary: ${e instanceof Error ? e.message : String(e)}\n`);
          process.exit(ErrorCode.DICTIONARY_ERROR);
        }
      } else {
        dict = Dictionary.create(tokenMode);
      }

      const noNer = opts['ner'] === false;
      const pipeline = new DetectionPipeline({
        config: categories ? { priorityOrder: ['MANUAL', 'REGEX', 'NER'], categories } : undefined,
        noNer,
      });

      const results: unknown[] = [];
      const startTotal = Date.now();

      const processText = async (text: string, inputName: string, outputPath?: string) => {
        const startFile = Date.now();
        const snapshot = dict.snapshot();

        try {
          const spans = await pipeline.detect(text);
          const { text: veiled, substitutions } = veilTextFromSpans(text, spans, dict, inputName);
          const detectMs = Date.now() - startFile;

          if (outputPath) {
            await mkdir(outputDir, { recursive: true });
            await writeFile(outputPath, veiled, 'utf-8');
            log(`Veiled ${inputName} → ${outputPath} (${substitutions} entities)`);
          } else {
            process.stdout.write(veiled + '\n');
          }

          const catCounts: Record<string, number> = {};
          for (const span of spans) {
            catCounts[span.category] = (catCounts[span.category] ?? 0) + 1;
          }

          return {
            input: inputName,
            output: outputPath ?? '(stdout)',
            entitiesFound: spans.length,
            newEntities: dict.size - snapshot.length,
            reusedEntities: spans.length - (dict.size - snapshot.length),
            categories: catCounts,
            detectMs,
          };
        } catch (e) {
          dict.restore(snapshot);
          process.stderr.write(`ink-veil: Error processing ${inputName}: ${e instanceof Error ? e.message : String(e)}\n`);
          process.exit(ErrorCode.GENERAL_ERROR);
        }
      };

      if (stdinMode) {
        const chunks: Buffer[] = [];
        for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
        const text = Buffer.concat(chunks).toString('utf-8');
        const result = await processText(text, '(stdin)');
        results.push(result);
      } else {
        if (files.length === 0) {
          process.stderr.write('ink-veil veil: No input files specified. Use --stdin or provide file paths.\n');
          process.exit(ErrorCode.INVALID_ARGUMENTS);
        }

        for (const file of files) {
          const abs = resolve(file);
          if (!existsSync(abs)) {
            process.stderr.write(`ink-veil: File not found: ${abs}\n`);
            process.exit(ErrorCode.FILE_NOT_FOUND);
          }

          const ext = basename(abs).split('.').pop() ?? 'txt';
          const parserResult = await getParser(ext);
          if (!parserResult.ok) {
            process.stderr.write(`ink-veil: Unsupported format: .${ext}\n`);
            process.exit(ErrorCode.UNSUPPORTED_FORMAT);
          }

          const buf = await readFile(abs);
          const parsed = await parserResult.value.parse(buf, String(opts['encoding'] ?? 'utf-8'));
          const text = parsed.segments.filter((s) => !s.skippable).map((s) => s.text).join('\n');

          const outFile = join(outputDir, basename(abs));
          const result = await processText(text, abs, outFile);
          results.push(result);
        }
      }

      // Save dictionary
      try {
        await saveDictionary(dict, dictPath);
      } catch (e) {
        process.stderr.write(`ink-veil: Failed to save dictionary: ${e instanceof Error ? e.message : String(e)}\n`);
        process.exit(ErrorCode.DICTIONARY_ERROR);
      }

      if (jsonMode) {
        const output = {
          success: true,
          command: 'veil',
          results,
          dictionary: {
            path: dictPath,
            totalEntries: dict.size,
            version: '1.0.0',
          },
          timing: { totalMs: Date.now() - startTotal },
        };
        process.stdout.write(JSON.stringify(output, null, 2) + '\n');
      }

      process.exit(ErrorCode.SUCCESS);
    });

  return cmd;
}
