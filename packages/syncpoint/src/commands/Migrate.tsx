import { Command } from 'commander';
import { Box, Text, useApp } from 'ink';
import { render } from 'ink';
import React, { useEffect, useState } from 'react';

import { migrateConfig } from '../core/migrate.js';
import type { MigrateResult } from '../utils/types.js';

interface MigrateViewProps {
  dryRun: boolean;
}

const MigrateView: React.FC<MigrateViewProps> = ({ dryRun }) => {
  const { exit } = useApp();
  const [result, setResult] = useState<MigrateResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await migrateConfig({ dryRun });
        setResult(res);
        setLoading(false);
        setTimeout(() => exit(), 100);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
        setLoading(false);
        exit();
      }
    })();
  }, []);

  if (error) {
    return (
      <Box flexDirection="column">
        <Text color="red">✗ {error}</Text>
      </Box>
    );
  }

  if (loading) {
    return <Text>Analyzing config...</Text>;
  }

  if (!result) return null;

  // No changes needed
  if (
    !result.migrated &&
    result.added.length === 0 &&
    result.deprecated.length === 0
  ) {
    return (
      <Box flexDirection="column">
        <Text color="green">✓ Config is already up to date.</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column">
      {dryRun && (
        <Box marginBottom={1}>
          <Text color="yellow" bold>
            [dry-run] Preview only — no changes written.
          </Text>
        </Box>
      )}

      {result.added.length > 0 && (
        <Box flexDirection="column">
          <Text bold>New fields (added with defaults):</Text>
          {result.added.map((field, i) => (
            <Text key={i}>
              {'  '}
              <Text color="green">+</Text> {field}
            </Text>
          ))}
        </Box>
      )}

      {result.deprecated.length > 0 && (
        <Box flexDirection="column" marginTop={result.added.length > 0 ? 1 : 0}>
          <Text bold>Deprecated fields (commented out):</Text>
          {result.deprecated.map((field, i) => (
            <Text key={i}>
              {'  '}
              <Text color="yellow">~</Text> {field}
            </Text>
          ))}
        </Box>
      )}

      {result.preserved.length > 0 && (
        <Box flexDirection="column" marginTop={1}>
          <Text bold>Preserved fields ({result.preserved.length}):</Text>
          {result.preserved.map((field, i) => (
            <Text key={i}>
              {'  '}
              <Text color="blue">•</Text> {field}
            </Text>
          ))}
        </Box>
      )}

      {result.migrated && (
        <Box flexDirection="column" marginTop={1}>
          <Text color="green">✓ Migration complete.</Text>
          {result.backupPath && (
            <Text>
              {'  '}Backup saved to: {result.backupPath}
            </Text>
          )}
        </Box>
      )}
    </Box>
  );
};

export function registerMigrateCommand(program: Command): void {
  program
    .command('migrate')
    .description('Migrate config.yml to match the current schema')
    .option('--dry-run', 'Preview changes without writing')
    .action(async (opts: { dryRun?: boolean }) => {
      const { waitUntilExit } = render(
        <MigrateView dryRun={opts.dryRun ?? false} />,
      );
      await waitUntilExit();
    });
}
