#!/usr/bin/env node
/**
 * Build script for hook entry point bundles
 * Bundles each hook into a self-contained ESM file for plugin distribution
 *
 * Output: libs/<name>.mjs
 */

import * as esbuild from 'esbuild';
import { mkdir } from 'fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

// Ensure output directory exists
await mkdir(resolve(root, 'libs'), { recursive: true });

const hookEntries = [
  'pre-tool-validator',
  'structure-guard',
  'agent-enforcer',
  'context-injector',
];

await Promise.all(
  hookEntries.map((name) =>
    esbuild.build({
      entryPoints: [resolve(root, `src/hooks/entries/${name}.entry.ts`)],
      bundle: true,
      platform: 'node',
      target: 'node20',
      format: 'esm',
      outfile: resolve(root, `libs/${name}.mjs`),
      minify: true,
      sourcemap: false,
      treeShaking: true,
    }),
  ),
);

console.log(`  Hook scripts (${hookEntries.length}) -> libs/*.mjs`);
