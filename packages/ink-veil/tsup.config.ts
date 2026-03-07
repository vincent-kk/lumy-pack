import { defineConfig } from 'tsup';

export default defineConfig([
  {
    entry: { index: 'src/index.ts' },
    format: ['esm', 'cjs'],
    outExtension({ format }) {
      return { js: format === 'esm' ? '.mjs' : '.cjs' };
    },
    splitting: false,
    sourcemap: false,
    target: 'node20',
    platform: 'node',
    clean: true,
    dts: false,
    shims: true,
    external: ['iconv-lite'],
  },
  {
    entry: { 'transform/index': 'src/transform/index.ts' },
    format: ['esm', 'cjs'],
    outExtension({ format }) {
      return { js: format === 'esm' ? '.mjs' : '.cjs' };
    },
    splitting: false,
    sourcemap: false,
    target: 'node20',
    platform: 'node',
    clean: false,
    dts: false,
    shims: true,
    external: ['onnxruntime-node', '@xenova/transformers'],
  },
  {
    entry: { worker: 'src/detection/ner/worker.ts' },
    format: ['esm'],
    outExtension() {
      return { js: '.mjs' };
    },
    splitting: false,
    sourcemap: false,
    target: 'node20',
    platform: 'node',
    clean: false,
    dts: false,
    external: ['onnxruntime-node', '@xenova/transformers'],
  },
  {
    entry: { cli: 'src/cli.ts' },
    format: ['esm'],
    outExtension() {
      return { js: '.mjs' };
    },
    splitting: false,
    sourcemap: false,
    target: 'node20',
    platform: 'node',
    clean: false,
    dts: false,
    external: ['iconv-lite'],
  },
]);
