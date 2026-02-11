import pc from "picocolors";

import type { InitOptions } from "../utils/types.js";
import { logger } from "../utils/logger.js";

export const initCommand = async (
  name: string | undefined,
  options: InitOptions,
): Promise<void> => {
  const projectName = name ?? "my-project";

  logger.info(`Initializing project ${pc.bold(pc.cyan(projectName))}...`);

  if (options.dryRun) {
    logger.info(pc.yellow("(dry run - no files will be created)"));
  }

  logger.info(`Template: ${pc.green(options.template)}`);

  if (options.directory) {
    logger.info(`Directory: ${pc.green(options.directory)}`);
  }

  logger.success(
    `Project ${pc.bold(projectName)} initialized successfully!`,
  );
};
