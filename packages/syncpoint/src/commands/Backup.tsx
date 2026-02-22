import { Command } from 'commander';
import { Box, Static, Text, useApp } from 'ink';
import { render } from 'ink';
import React, { useEffect, useMemo, useState } from 'react';

import { ProgressBar } from '../components/ProgressBar.js';
import { createBackup, scanTargets } from '../core/backup.js';
import { loadConfig } from '../core/config.js';
import { COMMANDS } from '../utils/command-registry.js';
import { formatBytes } from '../utils/format.js';
import { contractTilde } from '../utils/paths.js';
import type {
  BackupOptions,
  BackupResult,
  FileEntry,
  SyncpointConfig,
} from '../utils/types.js';

type Phase = 'scanning' | 'compressing' | 'done' | 'error';

type StaticFileItem =
  | { id: string; type: 'header' }
  | { id: string; type: 'found'; file: FileEntry }
  | { id: string; type: 'missing'; path: string };

interface BackupViewProps {
  options: BackupOptions;
}

const BackupView: React.FC<BackupViewProps> = ({ options }) => {
  const { exit } = useApp();
  const [phase, setPhase] = useState<Phase>('scanning');
  const [, setConfig] = useState<SyncpointConfig | null>(null);
  const [foundFiles, setFoundFiles] = useState<FileEntry[]>([]);
  const [missingFiles, setMissingFiles] = useState<string[]>([]);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<BackupResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const staticItems = useMemo<StaticFileItem[]>(() => {
    if (foundFiles.length === 0 && missingFiles.length === 0) return [];
    const seen = new Set<string>();
    const deduped: StaticFileItem[] = [
      { id: 'scan-header', type: 'header' as const },
    ];
    for (const f of foundFiles) {
      if (seen.has(f.absolutePath)) continue;
      seen.add(f.absolutePath);
      deduped.push({
        id: `found-${f.absolutePath}`,
        type: 'found' as const,
        file: f,
      });
    }
    for (const p of missingFiles) {
      if (seen.has(p)) continue;
      seen.add(p);
      deduped.push({ id: `missing-${p}`, type: 'missing' as const, path: p });
    }
    return deduped;
  }, [foundFiles, missingFiles]);

  useEffect(() => {
    (async () => {
      let progressInterval: ReturnType<typeof setInterval> | undefined;

      try {
        // Phase 1: Load config and scan
        const cfg = await loadConfig();
        setConfig(cfg);

        const { found, missing } = await scanTargets(cfg);
        setFoundFiles(found);
        setMissingFiles(missing);

        // If dry-run, stop here
        if (options.dryRun) {
          setPhase('done');
          setTimeout(() => exit(), 100);
          return;
        }

        // Phase 2: Create backup
        setPhase('compressing');

        // Simulate progress updates (actual compression is atomic)
        progressInterval = setInterval(() => {
          setProgress((prev) => {
            if (prev >= 90) return prev;
            return prev + 10;
          });
        }, 100);

        const backupResult = await createBackup(cfg, options);
        clearInterval(progressInterval);
        setProgress(100);
        setResult(backupResult);
        setPhase('done');

        setTimeout(() => exit(), 100);
      } catch (err) {
        if (progressInterval) clearInterval(progressInterval);
        setError(err instanceof Error ? err.message : String(err));
        setPhase('error');
        setTimeout(() => exit(), 100);
      }
    })();
  }, []);

  if (phase === 'error' || error) {
    return (
      <Box flexDirection="column">
        <Text color="red">✗ Backup failed: {error}</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column">
      {/* Scan results (static — rendered once, excluded from re-renders) */}
      <Static items={staticItems}>
        {(item) => {
          if (item.type === 'header') {
            return (
              <Text key={item.id} bold>
                ▸ Scanning backup targets...
              </Text>
            );
          }
          if (item.type === 'found') {
            return (
              <Text key={item.id}>
                {'  '}
                <Text color="green">✓</Text>{' '}
                {contractTilde(item.file.absolutePath)}
                <Text color="gray">
                  {'    '}
                  {formatBytes(item.file.size).padStart(10)}
                </Text>
              </Text>
            );
          }
          return (
            <Text key={item.id}>
              {'  '}
              <Text color="yellow">⚠</Text> {item.path}
              <Text color="gray">{'    '}File not found, skipped</Text>
            </Text>
          );
        }}
      </Static>

      {options.dryRun && phase === 'done' && (
        <Box flexDirection="column" marginTop={1}>
          <Text color="yellow">(dry-run) No actual backup was created</Text>
          <Text>
            Target files: {foundFiles.length} (
            {formatBytes(foundFiles.reduce((sum, f) => sum + f.size, 0))})
          </Text>
        </Box>
      )}

      {/* Compression progress */}
      {phase === 'compressing' && (
        <Box flexDirection="column" marginTop={1}>
          <Text>▸ Compressing...</Text>
          <Text>
            {'  '}
            <ProgressBar percent={progress} />
          </Text>
        </Box>
      )}

      {/* Completion summary */}
      {phase === 'done' && result && !options.dryRun && (
        <Box flexDirection="column" marginTop={1}>
          <Text color="green" bold>
            ✓ Backup complete
          </Text>
          <Text>
            {'  '}File: {result.archivePath.split('/').pop()}
          </Text>
          <Text>
            {'  '}Size: {formatBytes(result.metadata.summary.totalSize)} (
            {result.metadata.summary.fileCount} files + metadata)
          </Text>
          <Text>
            {'  '}Path: {contractTilde(result.archivePath)}
          </Text>
        </Box>
      )}
    </Box>
  );
};

export function registerBackupCommand(program: Command): void {
  const cmdInfo = COMMANDS.backup;
  const cmd = program.command('backup').description(cmdInfo.description);

  // Register options from central registry
  cmdInfo.options?.forEach((opt) => {
    cmd.option(opt.flag, opt.description);
  });

  cmd.action(
    async (opts: { dryRun: boolean; tag?: string; verbose?: boolean }) => {
      const { waitUntilExit } = render(
        <BackupView
          options={{
            dryRun: opts.dryRun,
            tag: opts.tag,
            verbose: opts.verbose,
          }}
        />,
      );
      await waitUntilExit();
    },
  );
}
