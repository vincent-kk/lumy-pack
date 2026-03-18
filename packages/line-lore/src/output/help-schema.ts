export function getHelpSchema(): object {
  return {
    name: 'line-lore',
    description:
      'Trace code lines to their originating Pull Requests via deterministic 4-stage pipeline',
    commands: {
      trace: {
        description: 'Trace a file line to its originating PR',
        parameters: {
          file: {
            type: 'string',
            required: true,
            description: 'Path to the file to trace',
          },
          '-L': {
            type: 'string',
            required: true,
            description: 'Line number or range (e.g., "42" or "10,50")',
          },
          '--deep': {
            type: 'boolean',
            description: 'Enable deep trace for squash PRs',
          },
          '--graph-depth': {
            type: 'number',
            description: 'Issue graph traversal depth (0=PR only)',
          },
          '--no-ast': {
            type: 'boolean',
            description: 'Disable AST diff analysis',
          },
          '--no-cache': { type: 'boolean', description: 'Disable cache' },
          '--json': { type: 'boolean', description: 'Output in JSON format' },
          '--quiet': { type: 'boolean', description: 'Output PR number only' },
          '--output': {
            type: 'string',
            enum: ['human', 'json', 'llm'],
            description: 'Output format',
          },
        },
        examples: [
          'line-lore trace src/auth.ts -L 42',
          'line-lore trace src/auth.ts -L 10,50 --deep',
          'line-lore trace src/auth.ts -L 42 --output llm',
        ],
      },
      health: {
        description: 'Check git and platform health status',
        parameters: {
          '--json': { type: 'boolean', description: 'Output in JSON format' },
        },
      },
      cache: {
        description: 'Manage the line-lore cache',
        subcommands: {
          clear: { description: 'Clear all cached data' },
          stats: { description: 'Show cache statistics' },
        },
      },
    },
    responseFormat: {
      tool: 'line-lore',
      status: 'success | partial | error',
      operatingLevel: '0 (git only) | 1 (CLI, no auth) | 2 (full API)',
    },
  };
}
