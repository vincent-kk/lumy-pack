import { Command } from "commander";

import { initCommand } from "../commands/init.js";

const VERSION = "0.0.1";

export const createProgram = (): Command => {
  const program = new Command();

  program
    .name("syncpoint")
    .description("CLI tool for project synchronization and scaffolding")
    .version(VERSION);

  program
    .command("init")
    .description("Initialize a new project from a template")
    .argument("[name]", "Project name")
    .option("-t, --template <template>", "Template to use", "default")
    .option("-d, --directory <dir>", "Target directory")
    .option("--dry-run", "Preview changes without writing files", false)
    .action(initCommand);

  return program;
};

export const run = async (): Promise<void> => {
  const program = createProgram();
  await program.parseAsync(process.argv);
};
