import React, { useState, useEffect } from "react";
import { Text, Box, useApp } from "ink";
import SelectInput from "ink-select-input";
import { Command } from "commander";
import { render } from "ink";

import type {
  BackupInfo,
  RestorePlan,
  RestoreResult,
  RestoreOptions,
} from "../utils/types.js";
import { loadConfig } from "../core/config.js";
import { getBackupList, getRestorePlan, restoreBackup } from "../core/restore.js";
import { createBackup } from "../core/backup.js";
import { formatBytes, formatDate } from "../utils/format.js";
import { contractTilde } from "../utils/paths.js";
import { getHostname } from "../utils/system.js";
import { Confirm } from "../components/Confirm.js";

type Phase =
  | "loading"
  | "selecting"
  | "planning"
  | "confirming"
  | "restoring"
  | "done"
  | "error";

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
  const [phase, setPhase] = useState<Phase>("loading");
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
        const list = await getBackupList();
        setBackups(list);

        if (list.length === 0) {
          setError("사용 가능한 백업이 없습니다.");
          setPhase("error");
          exit();
          return;
        }

        if (filename) {
          // Find matching backup
          const match = list.find(
            (b) =>
              b.filename === filename ||
              b.filename.startsWith(filename),
          );
          if (!match) {
            setError(`백업을 찾을 수 없습니다: ${filename}`);
            setPhase("error");
            exit();
            return;
          }
          setSelectedPath(match.path);
          setPhase("planning");
        } else {
          setPhase("selecting");
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
        setPhase("error");
        exit();
      }
    })();
  }, []);

  // Phase 2: Generate restore plan when a backup is selected
  useEffect(() => {
    if (phase !== "planning" || !selectedPath) return;

    (async () => {
      try {
        const restorePlan = await getRestorePlan(selectedPath);
        setPlan(restorePlan);

        if (options.dryRun) {
          setPhase("done");
          setTimeout(() => exit(), 100);
        } else {
          setPhase("confirming");
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
        setPhase("error");
        exit();
      }
    })();
  }, [phase, selectedPath]);

  const handleSelect = (item: SelectItem) => {
    setSelectedPath(item.value);
    setPhase("planning");
  };

  const handleConfirm = async (yes: boolean) => {
    if (!yes || !selectedPath) {
      setPhase("done");
      setTimeout(() => exit(), 100);
      return;
    }

    try {
      // Safety backup
      setPhase("restoring");
      try {
        const config = await loadConfig();
        await createBackup(config, { tag: "pre-restore" });
        setSafetyDone(true);
      } catch {
        // Safety backup failure is non-fatal
      }

      // Restore
      const restoreResult = await restoreBackup(selectedPath, options);
      setResult(restoreResult);
      setPhase("done");
      setTimeout(() => exit(), 100);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setPhase("error");
      exit();
    }
  };

  if (phase === "error" || error) {
    return (
      <Box flexDirection="column">
        <Text color="red">✗ {error}</Text>
      </Box>
    );
  }

  const selectItems: SelectItem[] = backups.map((b, idx) => ({
    label: `${String(idx + 1).padStart(2)}  ${b.filename.replace(".tar.gz", "").padEnd(40)}  ${formatBytes(b.size).padStart(8)}   ${formatDate(b.createdAt)}`,
    value: b.path,
  }));

  const currentHostname = getHostname();
  const isRemoteBackup =
    plan?.metadata.hostname && plan.metadata.hostname !== currentHostname;

  return (
    <Box flexDirection="column">
      {/* Phase: Loading */}
      {phase === "loading" && (
        <Text>▸ 백업 목록 불러오는 중...</Text>
      )}

      {/* Phase: Selecting */}
      {phase === "selecting" && (
        <Box flexDirection="column">
          <Text bold>▸ 백업 선택</Text>
          <SelectInput items={selectItems} onSelect={handleSelect} />
        </Box>
      )}

      {/* Phase: Planning - show metadata + plan */}
      {(phase === "planning" ||
        phase === "confirming" ||
        phase === "restoring" ||
        (phase === "done" && plan)) && plan && (
        <Box flexDirection="column">
          <Box flexDirection="column" marginBottom={1}>
            <Text bold>
              ▸ 메타데이터 ({plan.metadata.config.filename ?? ""})
            </Text>
            <Text>{"  "}호스트: {plan.metadata.hostname}</Text>
            <Text>{"  "}생성:  {plan.metadata.createdAt}</Text>
            <Text>
              {"  "}파일:  {plan.metadata.summary.fileCount}개 (
              {formatBytes(plan.metadata.summary.totalSize)})
            </Text>

            {isRemoteBackup && (
              <Text color="yellow">
                {"  "}⚠ 이 백업은 다른 머신({plan.metadata.hostname})에서
                생성되었습니다
              </Text>
            )}
          </Box>

          <Box flexDirection="column" marginBottom={1}>
            <Text bold>▸ 복원 계획:</Text>
            {plan.actions.map((action, idx) => {
              let icon: string;
              let color: string;
              let label: string;

              switch (action.action) {
                case "overwrite":
                  icon = "덮어쓰기";
                  color = "yellow";
                  label = `(${formatBytes(action.currentSize ?? 0)} → ${formatBytes(action.backupSize ?? 0)}, ${action.reason})`;
                  break;
                case "skip":
                  icon = "건너뜀";
                  color = "gray";
                  label = `(${action.reason})`;
                  break;
                case "create":
                  icon = "새로 생성";
                  color = "green";
                  label = "(현재 없음)";
                  break;
              }

              return (
                <Text key={idx}>
                  {"  "}
                  <Text color={color}>{icon.padEnd(8)}</Text>
                  {"  "}
                  {contractTilde(action.path)}
                  {"  "}
                  <Text color="gray">{label}</Text>
                </Text>
              );
            })}
          </Box>

          {options.dryRun && phase === "done" && (
            <Text color="yellow">
              (dry-run) 실제 복원은 수행되지 않았습니다
            </Text>
          )}
        </Box>
      )}

      {/* Phase: Safety backup + confirm */}
      {phase === "confirming" && (
        <Box flexDirection="column">
          <Confirm message="복원을 진행할까요?" onConfirm={handleConfirm} />
        </Box>
      )}

      {/* Phase: Restoring */}
      {phase === "restoring" && (
        <Box flexDirection="column">
          {safetyDone && (
            <Text>
              <Text color="green">✓</Text> 현재 파일을 safety 백업 완료
            </Text>
          )}
          <Text>▸ 복원 중...</Text>
        </Box>
      )}

      {/* Phase: Done with result */}
      {phase === "done" && result && !options.dryRun && (
        <Box flexDirection="column" marginTop={1}>
          {safetyDone && (
            <Text>
              <Text color="green">✓</Text> 현재 파일을 safety 백업 완료
            </Text>
          )}
          <Text color="green" bold>
            ✓ 복원 완료
          </Text>
          <Text>
            {"  "}복원됨: {result.restoredFiles.length}개 파일
          </Text>
          <Text>
            {"  "}건너뜀: {result.skippedFiles.length}개 파일
          </Text>
          {result.safetyBackupPath && (
            <Text>
              {"  "}Safety 백업: {contractTilde(result.safetyBackupPath)}
            </Text>
          )}
        </Box>
      )}
    </Box>
  );
};

export function registerRestoreCommand(program: Command): void {
  program
    .command("restore [filename]")
    .description("백업에서 설정파일 복원")
    .option("--dry-run", "실제 복원 없이 변경 예정 사항만 표시", false)
    .action(async (filename: string | undefined, opts: { dryRun: boolean }) => {
      const { waitUntilExit } = render(
        <RestoreView
          filename={filename}
          options={{ dryRun: opts.dryRun }}
        />,
      );
      await waitUntilExit();
    });
}
