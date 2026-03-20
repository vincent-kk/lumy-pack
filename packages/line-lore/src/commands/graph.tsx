import { Command } from 'commander';

import { graph } from '../core/core.js';
import { LineLoreError } from '../errors.js';

export function registerGraphCommand(program: Command): void {
  const graphCmd = program
    .command('graph')
    .description('Explore the issue/PR graph');

  graphCmd
    .command('pr <number>')
    .description('Show issues linked to a PR')
    .option('--depth <n>', 'Traversal depth', '1')
    .option('--json', 'Output in JSON format')
    .action(async (number: string, opts: Record<string, string | boolean>) => {
      const prNumber = parseInt(number, 10);
      const depth = parseInt(opts.depth as string, 10) || 1;

      try {
        const result = await graph({ type: 'pr', number: prNumber, depth });

        if (opts.json) {
          console.log(JSON.stringify(result, null, 2));
        } else {
          for (const node of result.nodes) {
            if (node.type === 'pull_request') {
              console.log(`PR #${node.prNumber} ${node.prTitle ?? ''}`);
            } else if (node.type === 'issue') {
              console.log(`  Issue #${node.issueNumber} ${node.issueTitle ?? ''}`);
            }
          }
        }
      } catch (error) {
        if (error instanceof LineLoreError) {
          console.error(`Graph traversal failed: ${error.message}`);
        } else {
          console.error('Graph traversal failed:', (error as Error).message);
        }
        process.exit(1);
      }
    });

  graphCmd
    .command('issue <number>')
    .description('Show PRs linked to an issue')
    .option('--depth <n>', 'Traversal depth', '1')
    .option('--json', 'Output in JSON format')
    .action(async (number: string, opts: Record<string, string | boolean>) => {
      const issueNumber = parseInt(number, 10);
      const depth = parseInt(opts.depth as string, 10) || 1;

      try {
        const result = await graph({ type: 'issue', number: issueNumber, depth });

        if (opts.json) {
          console.log(JSON.stringify(result, null, 2));
        } else {
          for (const node of result.nodes) {
            if (node.type === 'issue') {
              console.log(`Issue #${node.issueNumber} ${node.issueTitle ?? ''}`);
            } else if (node.type === 'pull_request') {
              console.log(`  PR #${node.prNumber} ${node.prTitle ?? ''}`);
            }
          }
        }
      } catch (error) {
        if (error instanceof LineLoreError) {
          console.error(`Graph traversal failed: ${error.message}`);
        } else {
          console.error('Graph traversal failed:', (error as Error).message);
        }
        process.exit(1);
      }
    });
}
