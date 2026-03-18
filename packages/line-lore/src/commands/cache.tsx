import { Command } from 'commander';

import { clearCache } from '../core/core.js';

export function registerCacheCommand(program: Command): void {
  const cacheCmd = program
    .command('cache')
    .description('Manage the line-lore cache');

  cacheCmd
    .command('clear')
    .description('Clear all cached data')
    .action(async () => {
      await clearCache();
      console.log('Cache cleared.');
    });

  cacheCmd
    .command('stats')
    .description('Show cache statistics')
    .action(async () => {
      // Basic stats - could be expanded
      console.log('Cache directory: ~/.line-lore/cache/');
      console.log('Use "line-lore cache clear" to reset.');
    });
}
