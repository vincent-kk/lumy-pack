import { createRequire } from 'node:module';

import { Command } from 'commander';

const require = createRequire(import.meta.url);
const { version } = require('../package.json') as { version: string };

const program = new Command();

program
  .name('line-lore')
  .description('Trace code lines to their originating Pull Requests via git blame')
  .version(version);

// TODO: Register trace command

program.parseAsync(process.argv).catch((error: Error) => {
  console.error('Fatal error:', error.message);
  process.exit(1);
});
