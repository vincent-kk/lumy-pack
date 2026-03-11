import { respond, respondError } from '@lumy-pack/shared';
import { Command } from 'commander';

import { registerBackupCommand } from './commands/Backup.js';
import { registerCreateTemplateCommand } from './commands/CreateTemplate.js';
import { registerHelpCommand } from './commands/Help.js';
import { registerInitCommand } from './commands/Init.js';
import { registerLinkCommand } from './commands/Link.js';
import { registerListCommand } from './commands/List.js';
import { registerMigrateCommand } from './commands/Migrate.js';
import { registerProvisionCommand } from './commands/Provision.js';
import { registerRestoreCommand } from './commands/Restore.js';
import { registerStatusCommand } from './commands/Status.js';
import { registerUnlinkCommand } from './commands/Unlink.js';
import { registerWizardCommand } from './commands/Wizard.js';
import { SyncpointErrorCode } from './errors.js';
import { COMMANDS } from './utils/command-registry.js';
import { VERSION } from './version.js';

const program = new Command();
program
  .name('syncpoint')
  .description(
    'Personal Environment Manager — Config backup/restore and machine provisioning CLI',
  )
  .version(VERSION)
  .option('--json', 'Output structured JSON to stdout')
  .option('--yes', 'Skip confirmation prompts (non-interactive mode)');

registerInitCommand(program);
registerWizardCommand(program);
registerBackupCommand(program);
registerRestoreCommand(program);
registerProvisionCommand(program);
registerCreateTemplateCommand(program);
registerListCommand(program);
registerMigrateCommand(program);
registerStatusCommand(program);
registerLinkCommand(program);
registerUnlinkCommand(program);
registerHelpCommand(program);

// Handle --describe before parseAsync
if (process.argv.includes('--describe')) {
  const startTime = Date.now();
  const globalOptions = [
    {
      flag: '--json',
      description: 'Output structured JSON to stdout',
      type: 'boolean' as const,
    },
    {
      flag: '--yes',
      description: 'Skip confirmation prompts (non-interactive mode)',
      type: 'boolean' as const,
    },
    {
      flag: '--describe',
      description: 'Print CLI schema as JSON and exit',
      type: 'boolean' as const,
    },
    {
      flag: '-V, --version',
      description: 'Output the version number',
      type: 'boolean' as const,
    },
    {
      flag: '-h, --help',
      description: 'Display help for command',
      type: 'boolean' as const,
    },
  ];
  respond(
    'describe',
    {
      name: 'syncpoint',
      version: VERSION,
      description: program.description(),
      globalOptions,
      commands: COMMANDS,
    },
    startTime,
    VERSION,
  );
  process.exit(0);
}

program.parseAsync(process.argv).catch((error: Error) => {
  if (process.argv.includes('--json')) {
    respondError(
      'unknown',
      SyncpointErrorCode.UNKNOWN,
      error.message,
      Date.now(),
      VERSION,
    );
    process.exit(1);
  }
  console.error('Fatal error:', error.message);
  process.exit(1);
});
