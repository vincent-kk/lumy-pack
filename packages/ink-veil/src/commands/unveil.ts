import { Command } from 'commander';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve, basename, join } from 'node:path';
import { loadDictionary, loadDictionaryEncrypted } from '../dictionary/io.js';
import { isEncryptedDictionary } from '../dictionary/encryption.js';
import { unveilText } from '../transform/unveil.js';
import { ErrorCode } from '../errors/types.js';
import { loadConfig } from '../config/loader.js';
import type { ConfigOverrides } from '../config/loader.js';

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

      const results: unknown[] = [];
      const startTotal = Date.now();

      const processText = async (text: string, inputName: string, outputPath?: string) => {
        const result = unveilText(text, dict);
        const { text: restored, matchedTokens, modifiedTokens, unmatchedTokens, tokenIntegrity } = result;

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
          matchedTokens: matchedTokens.length,
          modifiedTokens: modifiedTokens.length,
          unmatchedTokens: unmatchedTokens.length,
          totalRestored: matchedTokens.length + modifiedTokens.length,
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
