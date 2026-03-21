import { Command } from "commander";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { loadDictionary, saveDictionary } from "../dictionary/io.js";
import { ErrorCode } from "../errors/types.js";

export function buildDictCommand(): Command {
  const cmd = new Command("dict").description("Dictionary management");

  // dict inspect
  cmd
    .command("inspect <path>")
    .description("Show dictionary contents and statistics")
    .option("--json", "Output structured JSON")
    .action(async (dictPath: string, opts: Record<string, unknown>) => {
      const jsonMode = Boolean(opts["json"]);
      const abs = resolve(dictPath);

      if (!existsSync(abs)) {
        process.stderr.write(`ink-veil: Dictionary not found: ${abs}\n`);
        process.exit(ErrorCode.DICTIONARY_ERROR);
      }

      let dict;
      try {
        dict = await loadDictionary(abs);
      } catch (e) {
        process.stderr.write(
          `ink-veil: Failed to load dictionary: ${e instanceof Error ? e.message : String(e)}\n`,
        );
        process.exit(ErrorCode.DICTIONARY_ERROR);
      }

      const stats = dict.stats();

      if (jsonMode) {
        const output = {
          success: true,
          command: "dict inspect",
          path: abs,
          stats,
          entries: [...dict.entries()].map((e) => ({
            id: e.id,
            original: e.original,
            category: e.category,
            token: e.token,
            occurrenceCount: e.occurrenceCount,
          })),
        };
        process.stdout.write(JSON.stringify(output, null, 2) + "\n");
      } else {
        process.stdout.write(`Dictionary: ${abs}\n`);
        process.stdout.write(`Total entries: ${stats.total}\n`);
        process.stdout.write("By category:\n");
        for (const [cat, count] of Object.entries(stats.byCategory)) {
          process.stdout.write(`  ${cat}: ${count}\n`);
        }
      }

      process.exit(ErrorCode.SUCCESS);
    });

  // dict add
  cmd
    .command("add <path>")
    .description("Add a manual entry to the dictionary")
    .requiredOption("--original <text>", "Original text to add")
    .requiredOption("--category <cat>", "Entity category")
    .option("--json", "Output structured JSON")
    .action(async (dictPath: string, opts: Record<string, unknown>) => {
      const jsonMode = Boolean(opts["json"]);
      const abs = resolve(dictPath);
      const original = String(opts["original"]);
      const category = String(opts["category"]);

      let dict;
      if (existsSync(abs)) {
        try {
          dict = await loadDictionary(abs);
        } catch (e) {
          process.stderr.write(
            `ink-veil: Failed to load dictionary: ${e instanceof Error ? e.message : String(e)}\n`,
          );
          process.exit(ErrorCode.DICTIONARY_ERROR);
        }
      } else {
        const { Dictionary } = await import("../dictionary/dictionary.js");
        dict = Dictionary.create();
      }

      const entry = dict.addEntity(
        original,
        category,
        "MANUAL",
        1.0,
        "manual-add",
      );

      await saveDictionary(dict, abs);

      if (jsonMode) {
        process.stdout.write(
          JSON.stringify({ success: true, entry }, null, 2) + "\n",
        );
      } else {
        process.stdout.write(
          `Added: ${entry.id} "${original}" [${category}]\n`,
        );
      }

      process.exit(ErrorCode.SUCCESS);
    });

  // dict list
  cmd
    .command("list <path>")
    .description("List dictionary entries, optionally filtered by category")
    .option("--category <cat>", "Filter by category")
    .option("--json", "Output structured JSON")
    .action(async (dictPath: string, opts: Record<string, unknown>) => {
      const jsonMode = Boolean(opts["json"]);
      const abs = resolve(dictPath);
      const filterCat = opts["category"] ? String(opts["category"]) : undefined;

      if (!existsSync(abs)) {
        process.stderr.write(`ink-veil: Dictionary not found: ${abs}\n`);
        process.exit(ErrorCode.DICTIONARY_ERROR);
      }

      let dict;
      try {
        dict = await loadDictionary(abs);
      } catch (e) {
        process.stderr.write(
          `ink-veil: Failed to load dictionary: ${e instanceof Error ? e.message : String(e)}\n`,
        );
        process.exit(ErrorCode.DICTIONARY_ERROR);
      }

      const allEntries = [...dict.entries()];
      const entries = filterCat
        ? allEntries.filter((e) => e.category === filterCat)
        : allEntries;

      if (jsonMode) {
        process.stdout.write(
          JSON.stringify(
            {
              success: true,
              command: "dict list",
              count: entries.length,
              entries: entries.map((e) => ({
                id: e.id,
                original: e.original,
                category: e.category,
                token: e.token,
              })),
            },
            null,
            2,
          ) + "\n",
        );
      } else {
        for (const e of entries) {
          process.stdout.write(
            `${e.id}\t${e.category}\t"${e.original}"\t${e.token}\n`,
          );
        }
      }

      process.exit(ErrorCode.SUCCESS);
    });

  // dict merge
  cmd
    .command("merge <dict-a> <dict-b>")
    .description("Merge two dictionaries into one")
    .option(
      "-o, --output <path>",
      "Output path for merged dictionary",
      "./merged.json",
    )
    .option(
      "--strategy <strategy>",
      "Merge strategy: keep-mine, keep-theirs, rename",
      "keep-mine",
    )
    .option("--json", "Output structured JSON")
    .action(
      async (dictA: string, dictB: string, opts: Record<string, unknown>) => {
        const jsonMode = Boolean(opts["json"]);
        const strategy = String(opts["strategy"] ?? "keep-mine") as
          | "keep-mine"
          | "keep-theirs"
          | "rename";
        const outputPath = resolve(String(opts["output"] ?? "./merged.json"));
        const absA = resolve(dictA);
        const absB = resolve(dictB);

        for (const p of [absA, absB]) {
          if (!existsSync(p)) {
            process.stderr.write(`ink-veil: Dictionary not found: ${p}\n`);
            process.exit(ErrorCode.DICTIONARY_ERROR);
          }
        }

        let mine, theirs;
        try {
          mine = await loadDictionary(absA);
          theirs = await loadDictionary(absB);
        } catch (e) {
          process.stderr.write(
            `ink-veil: Failed to load dictionary: ${e instanceof Error ? e.message : String(e)}\n`,
          );
          process.exit(ErrorCode.DICTIONARY_ERROR);
        }

        const { mergeDictionaries } = await import("../dictionary/merge.js");
        const result = await mergeDictionaries(mine, theirs, { strategy });

        await saveDictionary(result.dictionary, outputPath);

        if (jsonMode) {
          process.stdout.write(
            JSON.stringify(
              {
                success: true,
                command: "dict merge",
                output: outputPath,
                strategy,
                added: result.added,
                skipped: result.skipped,
                renamed: result.renamed,
                conflicts: result.conflicts.length,
                totalEntries: result.dictionary.size,
              },
              null,
              2,
            ) + "\n",
          );
        } else {
          process.stdout.write(
            `Merged → ${outputPath} (added=${result.added}, skipped=${result.skipped}, renamed=${result.renamed}, conflicts=${result.conflicts.length})\n`,
          );
        }

        process.exit(ErrorCode.SUCCESS);
      },
    );

  return cmd;
}
