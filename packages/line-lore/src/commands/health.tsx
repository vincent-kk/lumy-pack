import { Command } from 'commander';

import { health } from '../core/core.js';

export function registerHealthCommand(program: Command): void {
  program
    .command('health')
    .description('Check git and platform health status')
    .option('--json', 'Output in JSON format')
    .action(async (opts: Record<string, boolean>) => {
      const report = await health();

      if (opts.json) {
        console.log(JSON.stringify(report, null, 2));
        return;
      }

      console.log(`Git version:    ${report.gitVersion}`);
      console.log(`Commit-graph:   ${report.commitGraph ? 'active' : 'inactive'}`);
      console.log(`Bloom filter:   ${report.bloomFilter ? 'available' : 'unavailable'}`);
      console.log(`Operating level: ${report.operatingLevel}`);

      if (report.hints.length > 0) {
        console.log('\nHints:');
        for (const hint of report.hints) {
          console.log(`  - ${hint}`);
        }
      }
    });
}
