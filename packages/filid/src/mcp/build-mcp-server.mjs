import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = resolve(__dirname, '../..');

await build({
  entryPoints: [resolve(rootDir, 'dist/mcp/server-entry.js')],
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'cjs',
  outfile: resolve(rootDir, 'bridge/mcp-server.cjs'),
  external: [],
  minify: false,
  sourcemap: false,
});

console.log('MCP server bundled to bridge/mcp-server.cjs');
