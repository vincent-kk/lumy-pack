import { Command } from 'commander';
import { Box, Text, useApp } from 'ink';
import { render } from 'ink';
import SelectInput from 'ink-select-input';
import React, { useEffect, useState } from 'react';

import { Confirm } from '../components/Confirm.js';
import { createBackup } from '../core/backup.js';
import { loadConfig } from '../core/config.js';
import {
  getBackupList,
  getRestorePlan,
  restoreBackup,
} from '../core/restore.js';
import { formatBytes, formatDate } from '../utils/format.js';
import { contractTilde } from '../utils/paths.js';
import { getHostname } from '../utils/system.js';
import type {
  BackupInfo,
  RestoreOptions,
  RestorePlan,
  RestoreResult,
} from '../utils/types.js';

type Phase =
  | 'loading'
  | 'selecting'
  | 'planning'
  | 'confirming'
  | 'restoring'
  | 'done'
  | 'error';

interface RestoreViewProps {
  filename?: string;
  options: RestoreOptions;
}

interface SelectItem {
  label: string;
  value: string;
}

const RestoreView: React.FC<RestoreViewProps> = ({ filename, options }) => {
  const { exit } = useApp();
  const [phase, setPhase] = useState<Phase>('loading');
  const [backups, setBackups] = useState<BackupInfo[]>([]);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [plan, setPlan] = useState<RestorePlan | null>(null);
  const [result, setResult] = useState<RestoreResult | null>(null);
  const [safetyDone, setSafetyDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Phase 1: Load backup list
  useEffect(() => {
    (async () => {
      try {
        const config = await loadConfig();
        const list = await getBackupList(config);
        setBackups(list);

        if (list.length === 0) {
          setError('No backups available.');
          setPhase('error');
          exit();
          return;
        }

        if (filename) {
          // Find matching backup
          const match = list.find(
            (b) => b.filename === filename || b.filename.startsWith(filename),
          );
          if (!match) {
            setError(`Backup not found: ${filename}`);
            setPhase('error');
            exit();
            return;
          }
          setSelectedPath(match.path);
          setPhase('planning');
        } else {
          setPhase('selecting');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
        setPhase('error');
        exit();
      }
    })();
  }, []);

  // Phase 2: Generate restore plan when a backup is selected
  useEffect(() => {
    if (phase !== 'planning' || !selectedPath) return;

    (async () => {
      try {
        const restorePlan = await getRestorePlan(selectedPath);
        setPlan(restorePlan);

        if (options.dryRun) {
          setPhase('done');
          setTimeout(() => exit(), 100);
        } else {
          setPhase('confirming');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
        setPhase('error');
        exit();
      }
    })();
  }, [phase, selectedPath]);

  const handleSelect = (item: SelectItem) => {
    setSelectedPath(item.value);
    setPhase('planning');
  };

  const handleConfirm = async (yes: boolean) => {
    if (!yes || !selectedPath) {
      setPhase('done');
      setTimeout(() => exit(), 100);
      return;
    }

    try {
      // Safety backup
      setPhase('restoring');
      try {
        const config = await loadConfig();
        await createBackup(config, { tag: 'pre-restore' });
        setSafetyDone(true);
      } catch {
        // Safety backup failure is non-fatal
      }

      // Restore
      const restoreResult = await restoreBackup(selectedPath, options);
      setResult(restoreResult);
      setPhase('done');
      setTimeout(() => exit(), 100);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setPhase('error');
      exit();
    }
  };

  if (phase === 'error' || error) {
    return (
      <Box flexDirection="column">
        <Text color="red">✗ {error}</Text>
      </Box>
    );
  }

  const selectItems: SelectItem[] = backups.map((b, idx) => ({
    label: `${String(idx + 1).padStart(2)}  ${b.filename.replace('.tar.gz', '').padEnd(40)}  ${formatBytes(b.size).padStart(8)}   ${formatDate(b.createdAt)}`,
    value: b.path,
  }));

  const currentHostname = getHostname();
  const isRemoteBackup =
    plan?.metadata.hostname && plan.metadata.hostname !== currentHostname;

  return (
    <Box flexDirection="column">
      {/* Phase: Loading */}
      {phase === 'loading' && <Text>▸ Loading backup list...</Text>}

      {/* Phase: Selecting */}
      {phase === 'selecting' && (
        <Box flexDirection="column">
          <Text bold>▸ Select backup</Text>
          <SelectInput items={selectItems} onSelect={handleSelect} />
        </Box>
      )}

      {/* Phase: Planning - show metadata + plan */}
      {(phase === 'planning' ||
        phase === 'confirming' ||
        phase === 'restoring' ||
        (phase === 'done' && plan)) &&
        plan && (
          <Box flexDirection="column">
            <Box flexDirection="column" marginBottom={1}>
              <Text bold>
                ▸ Metadata ({plan.metadata.config.filename ?? ''})
              </Text>
              <Text>
                {'  '}Host: {plan.metadata.hostname}
              </Text>
              <Text>
                {'  '}Created: {plan.metadata.createdAt}
              </Text>
              <Text>
                {'  '}Files: {plan.metadata.summary.fileCount} (
                {formatBytes(plan.metadata.summary.totalSize)})
              </Text>

              {isRemoteBackup && (
                <Text color="yellow">
                  {'  '}⚠ This backup was created on a different machine (
                  {plan.metadata.hostname})
                </Text>
              )}
            </Box>

            <Box flexDirection="column" marginBottom={1}>
              <Text bold>▸ Restore plan:</Text>
              {plan.actions.map((action, idx) => {
                let icon: string;
                let color: string;
                let label: string;

                switch (action.action) {
                  case 'overwrite':
                    icon = 'Overwrite';
                    color = 'yellow';
                    label = `(${formatBytes(action.currentSize ?? 0)} → ${formatBytes(action.backupSize ?? 0)}, ${action.reason})`;
                    break;
                  case 'skip':
                    icon = 'Skip';
                    color = 'gray';
                    label = `(${action.reason})`;
                    break;
                  case 'create':
                    icon = 'Create';
                    color = 'green';
                    label = '(not present)';
                    break;
                }

                return (
                  <Text key={idx}>
                    {'  '}
                    <Text color={color}>{icon.padEnd(8)}</Text>
                    {'  '}
                    {contractTilde(action.path)}
                    {'  '}
                    <Text color="gray">{label}</Text>
                  </Text>
                );
              })}
            </Box>

            {options.dryRun && phase === 'done' && (
              <Text color="yellow">
                (dry-run) No actual restore was performed
              </Text>
            )}
          </Box>
        )}

      {/* Phase: Safety backup + confirm */}
      {phase === 'confirming' && (
        <Box flexDirection="column">
          <Confirm message="Proceed with restore?" onConfirm={handleConfirm} />
        </Box>
      )}

      {/* Phase: Restoring */}
      {phase === 'restoring' && (
        <Box flexDirection="column">
          {safetyDone && (
            <Text>
              <Text color="green">✓</Text> Safety backup of current files
              complete
            </Text>
          )}
          <Text>▸ Restoring...</Text>
        </Box>
      )}

      {/* Phase: Done with result */}
      {phase === 'done' && result && !options.dryRun && (
        <Box flexDirection="column" marginTop={1}>
          {safetyDone && (
            <Text>
              <Text color="green">✓</Text> Safety backup of current files
              complete
            </Text>
          )}
          <Text color="green" bold>
            ✓ Restore complete
          </Text>
          <Text>
            {'  '}Restored: {result.restoredFiles.length} files
          </Text>
          <Text>
            {'  '}Skipped: {result.skippedFiles.length} files
          </Text>
          {result.safetyBackupPath && (
            <Text>
              {'  '}Safety backup: {contractTilde(result.safetyBackupPath)}
            </Text>
          )}
        </Box>
      )}
    </Box>
  );
};

export function registerRestoreCommand(program: Command): void {
  program
    .command('restore [filename]')
    .description('Restore config files from a backup')
    .option('--dry-run', 'Show planned changes without actual restore', false)
    .action(async (filename: string | undefined, opts: { dryRun: boolean }) => {
      const { waitUntilExit } = render(
        <RestoreView filename={filename} options={{ dryRun: opts.dryRun }} />,
      );
      await waitUntilExit();
    });
}
