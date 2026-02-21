import { readStdin } from './lib/stdin.mjs';

const input = await readStdin();
const { injectContext } = await import('../dist/hooks/context-injector.js');
const result = injectContext(input);
process.stdout.write(JSON.stringify(result));
