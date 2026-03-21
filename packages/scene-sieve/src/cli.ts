import { createRequire } from 'node:module';

import { respond, respondError } from '@lumy-pack/shared';
import { Command } from 'commander';

import { registerSieveCommand } from './commands/Sieve.js';
import { SieveErrorCode } from './errors.js';
import { SIEVE_COMMAND } from './utils/command-registry.js';

const require = createRequire(import.meta.url);
const { version } = require('../package.json') as { version: string };

const program = new Command();

program
  .name('scene-sieve')
  .description('Extract key frames from video and GIF files')
  .version(version);

registerSieveCommand(program, version);

// Handle --describe before parseAsync (no <input> required)
if (process.argv.includes('--describe')) {
  const startTime = Date.now();
  respond(
    'describe',
    {
      name: SIEVE_COMMAND.name,
      version,
      description: SIEVE_COMMAND.description,
      arguments: SIEVE_COMMAND.arguments,
      options: SIEVE_COMMAND.options,
    },
    startTime,
    version,
  );
  process.exit(0);
}

program.parseAsync(process.argv).catch((error: Error) => {
  if (process.argv.includes('--json')) {
    respondError(
      'extract',
      SieveErrorCode.UNKNOWN,
      error.message,
      Date.now(),
      version,
    );
  } else {
    console.error('Fatal error:', error.message);
  }
  process.exit(1);
});
