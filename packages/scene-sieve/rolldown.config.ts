import { defineConfig } from 'rolldown';

import { nodeBundle } from '../../scripts/rolldown-preset.js';

/** Loaded by `rolldown -c rolldown.config.ts` from the `build` script. */
export default defineConfig([
  nodeBundle({
    input: { index: 'src/index.ts' },
    formats: ['esm', 'cjs'],
    inline: ['@lumy-pack/shared'],
    clean: true,
  }),
  nodeBundle({
    input: { cli: 'src/cli.ts' },
    inline: ['@lumy-pack/shared'],
    shebang: 'banner',
  }),
  // Spawned as a worker thread by core/pipeline.ts — not a user-facing binary.
  nodeBundle({
    input: { 'pipeline-worker': 'src/core/pipeline-worker.ts' },
  }),
]);
