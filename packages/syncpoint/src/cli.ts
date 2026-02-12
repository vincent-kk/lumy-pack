import { Command } from "commander";
import { registerInitCommand } from "./commands/Init.js";
import { registerBackupCommand } from "./commands/Backup.js";
import { registerRestoreCommand } from "./commands/Restore.js";
import { registerProvisionCommand } from "./commands/Provision.js";
import { registerListCommand } from "./commands/List.js";
import { registerStatusCommand } from "./commands/Status.js";
import { registerWizardCommand } from "./commands/Wizard.js";
import { registerCreateTemplateCommand } from "./commands/CreateTemplate.js";
import { APP_VERSION } from "./constants.js";

const program = new Command();
program
  .name("syncpoint")
  .description(
    "Personal Environment Manager — Config backup/restore and machine provisioning CLI",
  )
  .version(APP_VERSION);

registerInitCommand(program);
registerWizardCommand(program);
registerBackupCommand(program);
registerRestoreCommand(program);
registerProvisionCommand(program);
registerCreateTemplateCommand(program);
registerListCommand(program);
registerStatusCommand(program);

program.parseAsync(process.argv).catch((error: Error) => {
  console.error("Fatal error:", error.message);
  process.exit(1);
});
