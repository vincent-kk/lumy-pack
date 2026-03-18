import { createRequire } from 'node:module';

import { respond, respondError } from '@lumy-pack/shared';
import { Command } from 'commander';

import {
  registerCacheCommand,
  registerGraphCommand,
  registerHealthCommand,
  registerTraceCommand,
} from './commands/index.js';
import { LineLoreErrorCode } from './errors.js';
import { ALL_COMMANDS } from './utils/command-registry.js';

const require = createRequire(import.meta.url);
const { version } = require('../package.json') as { version: string };

const program = new Command();

program
  .name('line-lore')
  .description(
    'Trace code lines to their originating Pull Requests via git blame',
  )
  .version(version);

registerTraceCommand(program);
registerHealthCommand(program);
registerCacheCommand(program);
registerGraphCommand(program);

// Handle --describe before parseAsync (no subcommand required)
if (process.argv.includes('--describe')) {
  const startTime = Date.now();
  respond(
    'describe',
    {
      name: 'line-lore',
      version,
      description:
        'Trace code lines to their originating Pull Requests via git blame',
      commands: ALL_COMMANDS,
      responseFormat: {
        tool: 'line-lore',
        status: 'success | partial | error',
        operatingLevel: '0 (git only) | 1 (CLI, no auth) | 2 (full API)',
      },
    },
    startTime,
    version,
  );
  process.exit(0);
}

program.parseAsync(process.argv).catch((error: Error) => {
  if (process.argv.includes('--json')) {
    respondError(
      'unknown',
      LineLoreErrorCode.UNKNOWN,
      error.message,
      Date.now(),
      version,
    );
  } else {
    console.error('Fatal error:', error.message);
  }
  process.exit(1);
});
