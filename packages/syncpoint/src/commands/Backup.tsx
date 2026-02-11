import React, { useState, useEffect } from "react";
import { Text, Box, useApp } from "ink";
import { Command } from "commander";
import { render } from "ink";

import type {
  SyncpointConfig,
  FileEntry,
  BackupResult,
  BackupOptions,
} from "../utils/types.js";
import { loadConfig } from "../core/config.js";
import { createBackup, scanTargets } from "../core/backup.js";
import { formatBytes } from "../utils/format.js";
import { contractTilde } from "../utils/paths.js";
import { ProgressBar } from "../components/ProgressBar.js";

type Phase = "scanning" | "compressing" | "done" | "error";

interface BackupViewProps {
  options: BackupOptions;
}

const BackupView: React.FC<BackupViewProps> = ({ options }) => {
  const { exit } = useApp();
  const [phase, setPhase] = useState<Phase>("scanning");
  const [, setConfig] = useState<SyncpointConfig | null>(null);
  const [foundFiles, setFoundFiles] = useState<FileEntry[]>([]);
  const [missingFiles, setMissingFiles] = useState<string[]>([]);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<BackupResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        // Phase 1: Load config and scan
        const cfg = await loadConfig();
        setConfig(cfg);

        const { found, missing } = await scanTargets(cfg);
        setFoundFiles(found);
        setMissingFiles(missing);

        // If dry-run, stop here
        if (options.dryRun) {
          setPhase("done");
          setTimeout(() => exit(), 100);
          return;
        }

        // Phase 2: Create backup
        setPhase("compressing");

        // Simulate progress updates (actual compression is atomic)
        const progressInterval = setInterval(() => {
          setProgress((prev) => {
            if (prev >= 90) return prev;
            return prev + 10;
          });
        }, 100);

        const backupResult = await createBackup(cfg, options);
        clearInterval(progressInterval);
        setProgress(100);
        setResult(backupResult);
        setPhase("done");

        setTimeout(() => exit(), 100);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
        setPhase("error");
        exit();
      }
    })();
  }, []);

  if (phase === "error" || error) {
    return (
      <Box flexDirection="column">
        <Text color="red">✗ 백업 실패: {error}</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column">
      {/* Scan results */}
      <Text bold>▸ 백업 대상 스캔 중...</Text>
      {foundFiles.map((file, idx) => (
        <Text key={idx}>
          {"  "}
          <Text color="green">✓</Text> {contractTilde(file.absolutePath)}
          <Text color="gray">
            {"    "}
            {formatBytes(file.size).padStart(10)}
          </Text>
        </Text>
      ))}
      {missingFiles.map((file, idx) => (
        <Text key={idx}>
          {"  "}
          <Text color="yellow">⚠</Text> {file}
          <Text color="gray">{"    "}파일 없음, 건너뜀</Text>
        </Text>
      ))}

      {options.dryRun && phase === "done" && (
        <Box flexDirection="column" marginTop={1}>
          <Text color="yellow">
            (dry-run) 실제 백업은 생성되지 않았습니다
          </Text>
          <Text>
            대상 파일: {foundFiles.length}개 (
            {formatBytes(foundFiles.reduce((sum, f) => sum + f.size, 0))})
          </Text>
        </Box>
      )}

      {/* Compression progress */}
      {phase === "compressing" && (
        <Box flexDirection="column" marginTop={1}>
          <Text>▸ 압축 중...</Text>
          <Text>{"  "}<ProgressBar percent={progress} /></Text>
        </Box>
      )}

      {/* Completion summary */}
      {phase === "done" && result && !options.dryRun && (
        <Box flexDirection="column" marginTop={1}>
          <Text color="green" bold>
            ✓ 백업 완료
          </Text>
          <Text>
            {"  "}파일: {result.metadata.config.filename}
          </Text>
          <Text>
            {"  "}크기: {formatBytes(result.metadata.summary.totalSize)} (
            {result.metadata.summary.fileCount}개 파일 + metadata)
          </Text>
          <Text>
            {"  "}위치: {contractTilde(result.archivePath)}
          </Text>
        </Box>
      )}
    </Box>
  );
};

export function registerBackupCommand(program: Command): void {
  program
    .command("backup")
    .description("설정파일 백업 생성")
    .option("--dry-run", "실제 압축 없이 대상 파일 목록만 표시", false)
    .option("--tag <name>", "백업 파일명에 태그 추가")
    .action(async (opts: { dryRun: boolean; tag?: string }) => {
      const { waitUntilExit } = render(
        <BackupView options={{ dryRun: opts.dryRun, tag: opts.tag }} />,
      );
      await waitUntilExit();
    });
}
