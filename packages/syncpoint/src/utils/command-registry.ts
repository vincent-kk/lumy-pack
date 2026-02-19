/**
 * Central command registry for syncpoint CLI
 * This ensures consistency between custom help and Commander.js --help
 */

export interface CommandOption {
  flag: string;
  description: string;
  default?: string;
}

export interface CommandArgument {
  name: string;
  description: string;
  required: boolean;
}

export interface CommandInfo {
  name: string;
  description: string;
  usage: string;
  arguments?: CommandArgument[];
  options?: CommandOption[];
  examples?: string[];
}

export const COMMANDS: Record<string, CommandInfo> = {
  init: {
    name: 'init',
    description:
      'Initialize ~/.syncpoint/ directory structure and default config',
    usage: 'npx @lumy-pack/syncpoint init',
    examples: ['npx @lumy-pack/syncpoint init'],
  },
  wizard: {
    name: 'wizard',
    description: 'Interactive wizard to generate config.yml with AI',
    usage: 'npx @lumy-pack/syncpoint wizard [options]',
    options: [
      {
        flag: '-p, --print',
        description: 'Print prompt instead of invoking Claude Code',
      },
    ],
    examples: [
      'npx @lumy-pack/syncpoint wizard',
      'npx @lumy-pack/syncpoint wizard --print',
    ],
  },
  backup: {
    name: 'backup',
    description:
      'Create a compressed backup archive of your configuration files',
    usage: 'npx @lumy-pack/syncpoint backup [options]',
    options: [
      {
        flag: '--dry-run',
        description: 'Preview files to be backed up without creating archive',
      },
      {
        flag: '--tag <name>',
        description: 'Add custom tag to backup filename',
      },
      {
        flag: '-v, --verbose',
        description: 'Show detailed output including missing files',
      },
    ],
    examples: [
      'npx @lumy-pack/syncpoint backup',
      'npx @lumy-pack/syncpoint backup --dry-run',
      'npx @lumy-pack/syncpoint backup --tag "before-upgrade"',
    ],
  },
  restore: {
    name: 'restore',
    description: 'Restore configuration files from a backup archive',
    usage: 'npx @lumy-pack/syncpoint restore [filename] [options]',
    arguments: [
      {
        name: 'filename',
        description:
          'Backup file to restore (optional, interactive if omitted)',
        required: false,
      },
    ],
    options: [
      {
        flag: '--dry-run',
        description: 'Show restore plan without actually restoring',
      },
    ],
    examples: [
      'npx @lumy-pack/syncpoint restore',
      'npx @lumy-pack/syncpoint restore macbook-pro_2024-01-15.tar.gz',
      'npx @lumy-pack/syncpoint restore --dry-run',
    ],
  },
  provision: {
    name: 'provision',
    description: 'Run template-based machine provisioning',
    usage: 'npx @lumy-pack/syncpoint provision <template> [options]',
    arguments: [
      {
        name: 'template',
        description: 'Template name to execute',
        required: false,
      },
    ],
    options: [
      {
        flag: '-f, --file <path>',
        description: 'Path to template file (alternative to template name)',
      },
      {
        flag: '--dry-run',
        description: 'Show execution plan without running commands',
      },
      {
        flag: '--skip-restore',
        description: 'Skip automatic config restore after provisioning',
      },
    ],
    examples: [
      'npx @lumy-pack/syncpoint provision dev-setup',
      'npx @lumy-pack/syncpoint provision dev-setup --dry-run',
      'npx @lumy-pack/syncpoint provision dev-setup --skip-restore',
      'npx @lumy-pack/syncpoint provision --file ./my-template.yml',
      'npx @lumy-pack/syncpoint provision -f ~/templates/custom.yaml --dry-run',
    ],
  },
  'create-template': {
    name: 'create-template',
    description: 'Interactive wizard to create a provisioning template with AI',
    usage: 'npx @lumy-pack/syncpoint create-template [name] [options]',
    arguments: [
      {
        name: 'name',
        description:
          'Template filename (optional, generated from template name if omitted)',
        required: false,
      },
    ],
    options: [
      {
        flag: '-p, --print',
        description: 'Print prompt instead of invoking Claude Code',
      },
    ],
    examples: [
      'npx @lumy-pack/syncpoint create-template',
      'npx @lumy-pack/syncpoint create-template my-dev-setup',
      'npx @lumy-pack/syncpoint create-template --print',
    ],
  },
  list: {
    name: 'list',
    description: 'Browse and manage backups and templates interactively',
    usage: 'npx @lumy-pack/syncpoint list [type] [options]',
    arguments: [
      {
        name: 'type',
        description: 'Filter by type: "backups" or "templates" (optional)',
        required: false,
      },
    ],
    options: [{ flag: '--delete <n>', description: 'Delete item number n' }],
    examples: [
      'npx @lumy-pack/syncpoint list',
      'npx @lumy-pack/syncpoint list backups',
      'npx @lumy-pack/syncpoint list templates',
    ],
  },
  status: {
    name: 'status',
    description: 'Show ~/.syncpoint/ status summary and manage cleanup',
    usage: 'npx @lumy-pack/syncpoint status [options]',
    options: [
      { flag: '--cleanup', description: 'Enter interactive cleanup mode' },
    ],
    examples: [
      'npx @lumy-pack/syncpoint status',
      'npx @lumy-pack/syncpoint status --cleanup',
    ],
  },
  migrate: {
    name: 'migrate',
    description: 'Migrate config.yml to match the current schema',
    usage: 'npx @lumy-pack/syncpoint migrate [options]',
    options: [
      {
        flag: '--dry-run',
        description: 'Preview changes without writing',
      },
    ],
    examples: [
      'npx @lumy-pack/syncpoint migrate',
      'npx @lumy-pack/syncpoint migrate --dry-run',
    ],
  },
  help: {
    name: 'help',
    description: 'Display help information',
    usage: 'npx @lumy-pack/syncpoint help [command]',
    arguments: [
      {
        name: 'command',
        description: 'Command to get detailed help for (optional)',
        required: false,
      },
    ],
    examples: [
      'npx @lumy-pack/syncpoint help',
      'npx @lumy-pack/syncpoint help backup',
      'npx @lumy-pack/syncpoint help provision',
    ],
  },
};
