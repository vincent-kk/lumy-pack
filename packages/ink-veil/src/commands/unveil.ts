import { Command } from 'commander';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve, basename, join } from 'node:path';
import { loadDictionary, loadDictionaryEncrypted } from '../dictionary/io.js';
import { isEncryptedDictionary } from '../dictionary/encryption.js';
import { unveilText } from '../transform/unveil.js';
import { ErrorCode } from '../errors/types.js';
import { loadConfig } from '../config/loader.js';
import { pLimit } from '../utils/p-limit.js';
import type { ConfigOverrides } from '../config/loader.js';

interface FileResult {
  ok: true;
  value: {
    input: string;
    output: string;
    tokenIntegrity: number;
    matchedTokens: number;
    modifiedTokens: number;
    unmatchedTokens: number;
    totalRestored: number;
  };
}

interface FileError {
  ok: false;
  input: string;
  error: string;
  exitCode?: number;
}

type FileOutcome = FileResult | FileError;

export function buildUnveilCommand(): Command {
  const cmd = new Command('unveil').description('Restore original PII from veiled documents');

  cmd
    .argument('[files...]', 'Input veiled files to restore')
    .option('-o, --output <dir>', 'Output directory for restored files', './restored/')
    .option('-d, --dictionary <path>', 'Dictionary file', './dictionary.json')
    .option('--stdin', 'Read veiled text from stdin')
    .option('--json', 'Output structured JSON with integrity report')
    .option('--strict', 'Fail with exit code 8 if tokenIntegrity < 1.0')
    .option('--decrypt', 'Load encrypted dictionary (requires --password)')
    .option('--password <pw>', 'Password for dictionary decryption (or INK_VEIL_PASSWORD env)')
    .option('-v, --verbose', 'Detailed logging to stderr')
    .action(async (files: string[], opts: Record<string, unknown>) => {
      const overrides: ConfigOverrides = {};
      if (opts['dictionary'] !== undefined) overrides.dictionaryPath = String(opts['dictionary']);
      if (opts['output'] !== undefined) overrides.outputDirectory = String(opts['output']);
      const config = loadConfig(overrides);

      const jsonMode = Boolean(opts['json']);
      const stdinMode = Boolean(opts['stdin']);
      const strict = Boolean(opts['strict']);
      const dictPath = resolve(String(opts['dictionary'] ?? config.dictionary.defaultPath));
      const outputDir = resolve(String(opts['output'] ?? config.output.directory));
      const doDecrypt = Boolean(opts['decrypt']);
      const password = String(opts['password'] ?? process.env['INK_VEIL_PASSWORD'] ?? '');

      if (!existsSync(dictPath)) {
        process.stderr.write(`ink-veil: Dictionary not found: ${dictPath}\n`);
        process.exit(ErrorCode.DICTIONARY_ERROR);
      }

      let dict;
      try {
        if (doDecrypt) {
          if (!password) {
            process.stderr.write('ink-veil: --decrypt requires --password or INK_VEIL_PASSWORD env\n');
            process.exit(ErrorCode.INVALID_ARGUMENTS);
          }
          dict = await loadDictionaryEncrypted(dictPath, password);
        } else {
          // Auto-detect encrypted format
          const raw = await readFile(dictPath);
          if (isEncryptedDictionary(raw)) {
            if (!password) {
              process.stderr.write('ink-veil: Encrypted dictionary detected. Use --decrypt --password <pw>\n');
              process.exit(ErrorCode.DICTIONARY_ERROR);
            }
            dict = await loadDictionaryEncrypted(dictPath, password);
          } else {
            dict = await loadDictionary(dictPath);
          }
        }
      } catch (e) {
        process.stderr.write(`ink-veil: Failed to load dictionary: ${e instanceof Error ? e.message : String(e)}\n`);
        process.exit(ErrorCode.DICTIONARY_ERROR);
      }

      const outcomes: FileOutcome[] = [];
      const startTotal = Date.now();

      const processFile = async (file: string): Promise<FileOutcome> => {
        const abs = resolve(file);
        if (!existsSync(abs)) {
          return { ok: false, input: abs, error: `File not found: ${abs}`, exitCode: ErrorCode.FILE_NOT_FOUND };
        }

        try {
          const text = await readFile(abs, 'utf-8');
          const outFile = join(outputDir, basename(abs));
          const result = unveilText(text, dict);
          const { text: restored, matchedTokens, modifiedTokens, unmatchedTokens, tokenIntegrity } = result;

          if (strict && tokenIntegrity < 1.0) {
            return { ok: false, input: abs, error: `Token integrity ${tokenIntegrity.toFixed(2)} < 1.0 (--strict mode)`, exitCode: ErrorCode.TOKEN_INTEGRITY_BELOW_THRESHOLD };
          }

          await mkdir(outputDir, { recursive: true });
          await writeFile(outFile, restored, 'utf-8');

          return {
            ok: true,
            value: {
              input: abs,
              output: outFile,
              tokenIntegrity,
              matchedTokens: matchedTokens.length,
              modifiedTokens: modifiedTokens.length,
              unmatchedTokens: unmatchedTokens.length,
              totalRestored: matchedTokens.length + modifiedTokens.length,
            },
          };
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          process.stderr.write(`ink-veil: Error processing ${abs}: ${msg}\n`);
          return { ok: false, input: abs, error: msg };
        }
      };

      if (stdinMode) {
        const chunks: Buffer[] = [];
        for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
        const text = Buffer.concat(chunks).toString('utf-8');

        try {
          const result = unveilText(text, dict);
          const { text: restored, matchedTokens, modifiedTokens, unmatchedTokens, tokenIntegrity } = result;

          if (strict && tokenIntegrity < 1.0) {
            outcomes.push({ ok: false, input: '(stdin)', error: `Token integrity ${tokenIntegrity.toFixed(2)} < 1.0 (--strict mode)`, exitCode: ErrorCode.TOKEN_INTEGRITY_BELOW_THRESHOLD });
          } else {
            process.stdout.write(restored + '\n');
            outcomes.push({
              ok: true,
              value: {
                input: '(stdin)',
                output: '(stdout)',
                tokenIntegrity,
                matchedTokens: matchedTokens.length,
                modifiedTokens: modifiedTokens.length,
                unmatchedTokens: unmatchedTokens.length,
                totalRestored: matchedTokens.length + modifiedTokens.length,
              },
            });
          }
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          outcomes.push({ ok: false, input: '(stdin)', error: msg });
        }
      } else {
        if (files.length === 0) {
          process.stderr.write('ink-veil unveil: No input files specified. Use --stdin or provide file paths.\n');
          process.exit(ErrorCode.INVALID_ARGUMENTS);
        }

        // Concurrent file processing with concurrency limit
        const limit = pLimit(4);
        const fileOutcomes = await Promise.all(
          files.map((file) => limit(() => processFile(file))),
        );
        outcomes.push(...fileOutcomes);
      }

      const succeeded = outcomes.filter((o) => o.ok).length;
      const failed = outcomes.filter((o) => !o.ok).length;

      if (jsonMode) {
        const output = {
          success: failed === 0,
          command: 'unveil',
          results: outcomes.map((o) =>
            o.ok ? o.value : { input: o.input, error: o.error },
          ),
          summary: { succeeded, failed, total: outcomes.length },
          timing: { totalMs: Date.now() - startTotal },
        };
        process.stdout.write(JSON.stringify(output, null, 2) + '\n');
      }

      // Report failures to stderr
      for (const o of outcomes) {
        if (!o.ok) {
          process.stderr.write(`ink-veil: FAILED ${o.input}: ${o.error}\n`);
        }
      }

      // Determine exit code: use specific code for single-file failures, GENERAL_ERROR for multi-file
      let exitCode = ErrorCode.SUCCESS;
      if (failed > 0) {
        const errors = outcomes.filter((o): o is FileError => !o.ok);
        exitCode = (errors.length === 1 && errors[0].exitCode) ? errors[0].exitCode : ErrorCode.GENERAL_ERROR;
      }
      process.exit(exitCode);
    });

  return cmd;
}
