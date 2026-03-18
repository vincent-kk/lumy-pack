import { createRequire } from 'node:module';

import { Command } from 'commander';

import { registerCacheCommand, registerGraphCommand, registerHealthCommand, registerTraceCommand } from './commands/index.js';
import { getHelpSchema } from './output/help-schema.js';

const require = createRequire(import.meta.url);
const { version } = require('../package.json') as { version: string };

const program = new Command();

program
  .name('line-lore')
  .description('Trace code lines to their originating Pull Requests via git blame')
  .version(version);

registerTraceCommand(program);
registerHealthCommand(program);
registerCacheCommand(program);
registerGraphCommand(program);

program
  .command('help-json')
  .description('Output tool schema for LLM agents')
  .action(() => {
    console.log(JSON.stringify(getHelpSchema(), null, 2));
  });

program.parseAsync(process.argv).catch((error: Error) => {
  console.error('Fatal error:', error.message);
  process.exit(1);
});
