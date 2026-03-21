import { map, filter, forEach } from "@winglet/common-utils";

import { Command } from "commander";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve, basename, join } from "node:path";
import { Dictionary } from "../dictionary/dictionary.js";
import {
  loadDictionary,
  saveDictionary,
  saveDictionaryEncrypted,
} from "../dictionary/io.js";
import { DetectionPipeline } from "../detection/index.js";
import { getParser } from "../document/parser.js";
import { veilTextFromSpans } from "../transform/veil-from-spans.js";
import { ErrorCode } from "../errors/types.js";
import { loadConfig } from "../config/loader.js";
import { pLimit } from "../utils/p-limit.js";
import type { ConfigOverrides } from "../config/loader.js";

interface FileResult {
  ok: true;
  value: {
    input: string;
    output: string;
    entitiesFound: number;
    newEntities: number;
    reusedEntities: number;
    categories: Record<string, number>;
    detectMs: number;
  };
}

interface FileError {
  ok: false;
  input: string;
  error: string;
  exitCode?: number;
}

type FileOutcome = FileResult | FileError;

export function buildVeilCommand(): Command {
  const cmd = new Command("veil").description(
    "Detect and replace PII in documents",
  );

  cmd
    .argument("[files...]", "Input files to veil")
    .option(
      "-o, --output <dir>",
      "Output directory for veiled files",
      "./veiled/",
    )
    .option(
      "-d, --dictionary <path>",
      "Dictionary file (created if absent)",
      "./dictionary.json",
    )
    .option(
      "-t, --token-mode <mode>",
      "Token format: tag, bracket, plain",
      "tag",
    )
    .option(
      "-c, --categories <list>",
      "Comma-separated entity categories to detect",
    )
    .option("--no-ner", "Disable NER, use regex-only mode")
    .option("--stdin", "Read text from stdin")
    .option("--json", "Output structured JSON to stdout")
    .option("--encoding <enc>", "Text encoding for input files", "utf-8")
    .option(
      "--encrypt",
      "Save dictionary in encrypted format (requires --password)",
    )
    .option(
      "--password <pw>",
      "Password for dictionary encryption (or INK_VEIL_PASSWORD env)",
    )
    .option("-v, --verbose", "Detailed logging to stderr")
    .action(async (files: string[], opts: Record<string, unknown>) => {
      const overrides: ConfigOverrides = {};
      if (opts["tokenMode"] !== undefined)
        overrides.tokenMode = String(opts["tokenMode"]) as
          | "tag"
          | "bracket"
          | "plain";
      if (opts["dictionary"] !== undefined)
        overrides.dictionaryPath = String(opts["dictionary"]);
      if (opts["output"] !== undefined)
        overrides.outputDirectory = String(opts["output"]);
      if (opts["encoding"] !== undefined)
        overrides.encoding = String(opts["encoding"]);
      if (opts["ner"] === false) overrides.noNer = true;
      const config = loadConfig(overrides);

      const jsonMode = Boolean(opts["json"]);
      const stdinMode = Boolean(opts["stdin"]);
      const verbose = Boolean(opts["verbose"]);
      const dictPath = resolve(
        String(opts["dictionary"] ?? config.dictionary.defaultPath),
      );
      const outputDir = resolve(
        String(opts["output"] ?? config.output.directory),
      );
      const tokenMode = config.tokenMode;
      const categories = opts["categories"]
        ? map(String(opts["categories"]).split(","), (s) => s.trim())
        : config.detection.categories.length > 0
          ? config.detection.categories
          : undefined;
      const doEncrypt = Boolean(opts["encrypt"]);
      const password = String(
        opts["password"] ?? process.env["INK_VEIL_PASSWORD"] ?? "",
      );

      const log = (msg: string) => {
        if (verbose) process.stderr.write(msg + "\n");
      };

      // Load or create dictionary
      let dict: Dictionary;
      if (existsSync(dictPath)) {
        try {
          dict = await loadDictionary(dictPath);
        } catch (e) {
          process.stderr.write(
            `ink-veil: Failed to load dictionary: ${e instanceof Error ? e.message : String(e)}\n`,
          );
          process.exit(ErrorCode.DICTIONARY_ERROR);
        }
      } else {
        dict = Dictionary.create(tokenMode);
      }

      if (doEncrypt && !password) {
        process.stderr.write(
          "ink-veil: --encrypt requires --password or INK_VEIL_PASSWORD env\n",
        );
        process.exit(ErrorCode.INVALID_ARGUMENTS);
      }

      const noNer = !config.ner.enabled;
      const pipeline = new DetectionPipeline({
        config: categories
          ? { priorityOrder: config.detection.priorityOrder, categories }
          : undefined,
        noNer,
      });

      const outcomes: FileOutcome[] = [];
      const startTotal = Date.now();

      const processText = async (
        text: string,
        inputName: string,
        outputPath?: string,
      ): Promise<FileResult["value"]> => {
        const startFile = Date.now();
        const sizeBefore = dict.size;

        const spans = await pipeline.detectChunked(text);
        const { text: veiled, substitutions } = veilTextFromSpans(
          text,
          spans,
          dict,
          inputName,
        );
        const detectMs = Date.now() - startFile;

        if (outputPath) {
          await mkdir(outputDir, { recursive: true });
          await writeFile(outputPath, veiled, "utf-8");
          log(
            `Veiled ${inputName} → ${outputPath} (${substitutions} entities)`,
          );
        } else {
          process.stdout.write(veiled + "\n");
        }

        const catCounts: Record<string, number> = {};
        for (const span of spans) {
          catCounts[span.category] = (catCounts[span.category] ?? 0) + 1;
        }

        return {
          input: inputName,
          output: outputPath ?? "(stdout)",
          entitiesFound: spans.length,
          newEntities: dict.size - sizeBefore,
          reusedEntities: spans.length - (dict.size - sizeBefore),
          categories: catCounts,
          detectMs,
        };
      };

      const processFile = async (file: string): Promise<FileOutcome> => {
        const abs = resolve(file);
        if (!existsSync(abs)) {
          return {
            ok: false,
            input: abs,
            error: `File not found: ${abs}`,
            exitCode: ErrorCode.FILE_NOT_FOUND,
          };
        }

        const ext = basename(abs).split(".").pop() ?? "txt";
        const parserResult = await getParser(ext);
        if (!parserResult.ok) {
          return {
            ok: false,
            input: abs,
            error: `Unsupported format: .${ext}`,
            exitCode: ErrorCode.UNSUPPORTED_FORMAT,
          };
        }

        try {
          const buf = await readFile(abs);
          const parsed = await parserResult.value.parse(
            buf,
            String(opts["encoding"] ?? "utf-8"),
          );

          const nonSkippable = filter(parsed.segments, (s) => !s.skippable);
          const text = map(nonSkippable, (s) => s.text).join("\n");

          const startFile = Date.now();
          const sizeBefore = dict.size;
          const spans = await pipeline.detectChunked(text);

          // Map spans back to segment boundaries and veil per-segment
          const segBounds: { start: number; end: number }[] = [];
          let off = 0;
          for (const seg of nonSkippable) {
            segBounds.push({ start: off, end: off + seg.text.length });
            off += seg.text.length + 1; // +1 for '\n' join separator
          }

          let totalSubstitutions = 0;
          for (let i = 0; i < nonSkippable.length; i++) {
            const { start: segStart, end: segEnd } = segBounds[i];
            const segSpans: typeof spans = [];
            forEach(spans, (s) => {
              if (s.start >= segStart && s.end <= segEnd)
                segSpans.push({
                  ...s,
                  start: s.start - segStart,
                  end: s.end - segStart,
                });
            });

            if (segSpans.length > 0) {
              const { text: veiled, substitutions } = veilTextFromSpans(
                nonSkippable[i].text,
                segSpans,
                dict,
                abs,
              );
              nonSkippable[i].text = veiled;
              totalSubstitutions += substitutions;
            }
          }

          const outFile = join(outputDir, basename(abs));
          await mkdir(outputDir, { recursive: true });
          const outputBuffer = await parserResult.value.reconstruct(parsed);
          await writeFile(outFile, outputBuffer);

          // Release buffer for GC after reconstruct
          parsed.originalBuffer = undefined;

          const detectMs = Date.now() - startFile;
          log(`Veiled ${abs} → ${outFile} (${totalSubstitutions} entities)`);

          const catCounts: Record<string, number> = {};
          for (const span of spans) {
            catCounts[span.category] = (catCounts[span.category] ?? 0) + 1;
          }

          return {
            ok: true,
            value: {
              input: abs,
              output: outFile,
              entitiesFound: spans.length,
              newEntities: dict.size - sizeBefore,
              reusedEntities: spans.length - (dict.size - sizeBefore),
              categories: catCounts,
              detectMs,
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
        const text = Buffer.concat(chunks).toString("utf-8");
        try {
          const value = await processText(text, "(stdin)");
          outcomes.push({ ok: true, value });
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          process.stderr.write(`ink-veil: Error processing stdin: ${msg}\n`);
          outcomes.push({ ok: false, input: "(stdin)", error: msg });
        }
      } else {
        if (files.length === 0) {
          process.stderr.write(
            "ink-veil veil: No input files specified. Use --stdin or provide file paths.\n",
          );
          process.exit(ErrorCode.INVALID_ARGUMENTS);
        }

        // Concurrent file processing with concurrency limit
        const limit = pLimit(4);
        const fileOutcomes = await Promise.all(
          map(files, (file) => limit(() => processFile(file))),
        );
        outcomes.push(...fileOutcomes);
      }

      // Save dictionary
      try {
        if (doEncrypt) {
          await saveDictionaryEncrypted(dict, dictPath, password);
        } else {
          await saveDictionary(dict, dictPath);
        }
      } catch (e) {
        process.stderr.write(
          `ink-veil: Failed to save dictionary: ${e instanceof Error ? e.message : String(e)}\n`,
        );
        process.exit(ErrorCode.DICTIONARY_ERROR);
      }

      const succeeded = filter(outcomes, (o) => o.ok).length;
      const failed = filter(outcomes, (o) => !o.ok).length;

      if (jsonMode) {
        const output = {
          success: failed === 0,
          command: "veil",
          results: map(outcomes, (o) =>
            o.ok ? o.value : { input: o.input, error: o.error },
          ),
          summary: { succeeded, failed, total: outcomes.length },
          dictionary: {
            path: dictPath,
            totalEntries: dict.size,
            version: "1.0.0",
          },
          timing: { totalMs: Date.now() - startTotal },
        };
        process.stdout.write(JSON.stringify(output, null, 2) + "\n");
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
        exitCode =
          errors.length === 1 && errors[0].exitCode
            ? errors[0].exitCode
            : ErrorCode.GENERAL_ERROR;
      }
      process.exit(exitCode);
    });

  return cmd;
}
