/**
 * Read all stdin data and parse as JSON.
 * Used by hook scripts to receive Claude Code hook input.
 */
export async function readStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk);
  }
  const raw = Buffer.concat(chunks).toString('utf-8');
  return JSON.parse(raw);
}
