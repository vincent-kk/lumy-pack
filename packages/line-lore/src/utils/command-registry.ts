/**
 * Central command registry for line-lore CLI.
 * Single source of truth for command metadata, used by --describe and --help.
 */

export interface CommandOption {
  flag: string;
  description: string;
  type?: 'boolean' | 'string' | 'number';
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
  usage?: string;
  arguments?: CommandArgument[];
  options?: CommandOption[];
  subcommands?: CommandInfo[];
  examples?: string[];
}

export const TRACE_COMMAND: CommandInfo = {
  name: 'trace',
  description: 'Trace a file line to its originating PR',
  usage: 'line-lore trace <file> [options]',
  arguments: [
    {
      name: 'file',
      description: 'Path to the file to trace',
      required: true,
    },
  ],
  options: [
    {
      flag: '-L, --line <range>',
      description: 'Line number or range (e.g., "42" or "10,50")',
      type: 'string',
    },
    {
      flag: '--deep',
      description: 'Enable deep trace for squash PRs',
      type: 'boolean',
    },
    {
      flag: '--graph-depth <n>',
      description: 'Issue graph traversal depth (0=PR only)',
      type: 'number',
      default: '0',
    },
    {
      flag: '--no-ast',
      description: 'Disable AST diff analysis',
      type: 'boolean',
    },
    {
      flag: '--no-cache',
      description: 'Disable cache',
      type: 'boolean',
    },
    {
      flag: '--json',
      description: 'Output in JSON format',
      type: 'boolean',
    },
    {
      flag: '-q, --quiet',
      description: 'Output PR number only',
      type: 'boolean',
    },
    {
      flag: '--output <format>',
      description: 'Output format: human, json, llm',
      type: 'string',
      default: 'human',
    },
    {
      flag: '--no-color',
      description: 'Disable colored output',
      type: 'boolean',
    },
  ],
  examples: [
    'line-lore trace src/auth.ts -L 42',
    'line-lore trace src/auth.ts -L 10,50 --deep',
    'line-lore trace src/auth.ts -L 42 --output llm',
  ],
};

export const HEALTH_COMMAND: CommandInfo = {
  name: 'health',
  description: 'Check git and platform health status',
  usage: 'line-lore health [options]',
  options: [
    {
      flag: '--json',
      description: 'Output in JSON format',
      type: 'boolean',
    },
  ],
};

export const CACHE_COMMAND: CommandInfo = {
  name: 'cache',
  description: 'Manage the line-lore cache',
  usage: 'line-lore cache <subcommand>',
  subcommands: [
    {
      name: 'clear',
      description: 'Clear all cached data',
    },
    {
      name: 'stats',
      description: 'Show cache statistics',
    },
  ],
};

export const GRAPH_COMMAND: CommandInfo = {
  name: 'graph',
  description: 'Explore the issue/PR graph',
  usage: 'line-lore graph <subcommand> <number>',
  subcommands: [
    {
      name: 'pr',
      description: 'Show issues linked to a PR',
      arguments: [
        {
          name: 'number',
          description: 'PR number',
          required: true,
        },
      ],
      options: [
        {
          flag: '--depth <n>',
          description: 'Traversal depth',
          type: 'number',
          default: '1',
        },
        {
          flag: '--json',
          description: 'Output in JSON format',
          type: 'boolean',
        },
      ],
    },
    {
      name: 'issue',
      description: 'Show PRs linked to an issue',
      arguments: [
        {
          name: 'number',
          description: 'Issue number',
          required: true,
        },
      ],
      options: [
        {
          flag: '--depth <n>',
          description: 'Traversal depth',
          type: 'number',
          default: '1',
        },
        {
          flag: '--json',
          description: 'Output in JSON format',
          type: 'boolean',
        },
      ],
    },
  ],
};

export const ALL_COMMANDS: CommandInfo[] = [
  TRACE_COMMAND,
  HEALTH_COMMAND,
  CACHE_COMMAND,
  GRAPH_COMMAND,
];
