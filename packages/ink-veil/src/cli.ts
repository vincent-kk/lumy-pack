#!/usr/bin/env node
import { program } from 'commander';
import { buildVeilCommand } from './commands/veil.js';
import { buildUnveilCommand } from './commands/unveil.js';
import { buildDetectCommand } from './commands/detect.js';
import { buildVerifyCommand } from './commands/verify.js';
import { buildDictCommand } from './commands/dict.js';
import { buildModelCommand } from './commands/model.js';
import { ErrorCode, InkVeilError } from './errors/types.js';

// Disable ANSI colors on non-TTY stdout
if (!process.stdout.isTTY) {
  process.env['NO_COLOR'] = '1';
  process.env['FORCE_COLOR'] = '0';
}

program
  .name('ink-veil')
  .description('Korean PII detection and veiling CLI tool')
  .version('0.0.1')
  .configureOutput({
    writeErr: (str) => process.stderr.write(str),
  });

program.addCommand(buildVeilCommand());
program.addCommand(buildUnveilCommand());
program.addCommand(buildDetectCommand());
program.addCommand(buildVerifyCommand());
program.addCommand(buildDictCommand());
program.addCommand(buildModelCommand());

// Global error handler: map InkVeilError.code to exit code
program.parseAsync(process.argv).catch((err: unknown) => {
  if (err instanceof InkVeilError) {
    process.stderr.write(`ink-veil: ${err.message}\n`);
    process.exit(err.code);
  }
  process.stderr.write(`ink-veil: ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(ErrorCode.GENERAL_ERROR);
});
