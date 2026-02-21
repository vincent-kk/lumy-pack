import { readStdin } from './lib/stdin.mjs';

const input = await readStdin();
const { guardOrganWrite } = await import('../dist/hooks/organ-guard.js');
const result = guardOrganWrite(input);
process.stdout.write(JSON.stringify(result));
