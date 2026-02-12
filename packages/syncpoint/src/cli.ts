import { Command } from 'commander';

import { registerBackupCommand } from './commands/Backup.js';
import { registerCreateTemplateCommand } from './commands/CreateTemplate.js';
import { registerInitCommand } from './commands/Init.js';
import { registerListCommand } from './commands/List.js';
import { registerProvisionCommand } from './commands/Provision.js';
import { registerRestoreCommand } from './commands/Restore.js';
import { registerStatusCommand } from './commands/Status.js';
import { registerWizardCommand } from './commands/Wizard.js';
import { VERSION } from './version.js';

const program = new Command();
program
  .name('syncpoint')
  .description(
    'Personal Environment Manager — Config backup/restore and machine provisioning CLI',
  )
  .version(VERSION);

registerInitCommand(program);
registerWizardCommand(program);
registerBackupCommand(program);
registerRestoreCommand(program);
registerProvisionCommand(program);
registerCreateTemplateCommand(program);
registerListCommand(program);
registerStatusCommand(program);

program.parseAsync(process.argv).catch((error: Error) => {
  console.error('Fatal error:', error.message);
  process.exit(1);
});
