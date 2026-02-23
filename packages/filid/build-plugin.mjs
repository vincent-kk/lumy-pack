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

// Shared esbuild options for all bundles
const sharedOptions = {
  bundle: true,
  platform: 'node',
  target: 'node20',
  minify: true,
  sourcemap: false,
  treeShaking: true,
};

// NODE_PATH auto-injection banner for MCP server bundle
// Resolves global npm modules so native packages like @ast-grep/napi can be found
const mcpBanner = `
// Resolve global npm modules for native package imports
try {
  var _cp = require('child_process');
  var _Module = require('module');
  var _globalRoot = _cp.execSync('npm root -g', { encoding: 'utf8', timeout: 5000 }).trim();
  if (_globalRoot) {
    var _sep = process.platform === 'win32' ? ';' : ':';
    process.env.NODE_PATH = _globalRoot + (process.env.NODE_PATH ? _sep + process.env.NODE_PATH : '');
    _Module._initPaths();
  }
} catch (_e) { /* npm not available - native modules will gracefully degrade */ }
`;

// 1. MCP server bundle (CJS for broad node compatibility)
await build({
  ...sharedOptions,
  entryPoints: [resolve(__dirname, 'src/mcp/server-entry.ts')],
  format: 'cjs',
  outfile: resolve(__dirname, 'libs/server.cjs'),
  banner: { js: mcpBanner },
  external: ['@ast-grep/napi'],
});

console.log('  MCP server  -> libs/server.cjs');

// 2. Hook script bundles (ESM, self-contained)
const hookEntries = [
  'pre-tool-validator',
  'structure-guard',
  // NOTE: disabled for now
  // 'change-tracker',
  'agent-enforcer',
  'context-injector',
];

await Promise.all(
  hookEntries.map((name) =>
    build({
      ...sharedOptions,
      entryPoints: [resolve(__dirname, `src/hooks/entries/${name}.entry.ts`)],
      format: 'esm',
      outfile: resolve(__dirname, `libs/${name}.mjs`),
    }),
  ),
);

console.log(`  Hook scripts (${hookEntries.length}) -> libs/*.mjs`);
console.log('Plugin build complete.');
