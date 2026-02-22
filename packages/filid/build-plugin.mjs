/**
 * Unified plugin build script.
 *
 * Bundles the MCP server and hook scripts into self-contained files
 * so the plugin works from git clone without a separate tsc build step.
 *
 * Outputs:
 *   libs/server.cjs        — MCP server (CJS, single file)
 *   libs/<name>.mjs        — Hook scripts (ESM, self-contained)
 */
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { build } from 'esbuild';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Ensure output directory exists
mkdirSync(resolve(__dirname, 'libs'), { recursive: true });

// 1. MCP server bundle (CJS for broad node compatibility)
await build({
  entryPoints: [resolve(__dirname, 'src/mcp/server-entry.ts')],
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'cjs',
  outfile: resolve(__dirname, 'libs/server.cjs'),
  external: [],
  minify: false,
  sourcemap: false,
});

console.log('  MCP server  -> libs/server.cjs');

// 2. Hook script bundles (ESM, self-contained)
const hookEntries = [
  'pre-tool-validator',
  'structure-guard',
  'change-tracker',
  'agent-enforcer',
  'context-injector',
];

await Promise.all(
  hookEntries.map((name) =>
    build({
      entryPoints: [resolve(__dirname, `src/hooks/entries/${name}.entry.ts`)],
      bundle: true,
      platform: 'node',
      target: 'node20',
      format: 'esm',
      outfile: resolve(__dirname, `libs/${name}.mjs`),
      external: [],
      minify: false,
      sourcemap: false,
    }),
  ),
);

console.log(`  Hook scripts (${hookEntries.length}) -> libs/*.mjs`);
console.log('Plugin build complete.');
