import React, { useState, useEffect } from "react";
import { Text, Box, useApp } from "ink";
import SelectInput from "ink-select-input";
import { Command } from "commander";
import { render } from "ink";
import { unlinkSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import type { StatusInfo, BackupInfo } from "../utils/types.js";
import { APP_NAME, getSubDir, LOGS_DIR } from "../constants.js";
import { getBackupList } from "../core/restore.js";
import { formatBytes, formatDate, formatRelativeTime } from "../utils/format.js";
import { Table } from "../components/Table.js";
import { Confirm } from "../components/Confirm.js";

type Phase = "loading" | "display" | "cleanup" | "confirming" | "done" | "error";

interface StatusViewProps {
  cleanup: boolean;
}

interface SelectItem {
  label: string;
  value: string;
}

function getDirStats(dirPath: string): { count: number; totalSize: number } {
  try {
    const entries = readdirSync(dirPath);
    let totalSize = 0;
    let count = 0;
    for (const entry of entries) {
      try {
        const stat = statSync(join(dirPath, entry));
        if (stat.isFile()) {
          totalSize += stat.size;
          count++;
        }
      } catch {
        // skip inaccessible files
      }
    }
    return { count, totalSize };
  } catch {
    return { count: 0, totalSize: 0 };
  }
}

const StatusView: React.FC<StatusViewProps> = ({ cleanup }) => {
  const { exit } = useApp();
  const [phase, setPhase] = useState<Phase>("loading");
  const [status, setStatus] = useState<StatusInfo | null>(null);
  const [backups, setBackups] = useState<BackupInfo[]>([]);
  const [cleanupAction, setCleanupAction] = useState<string | null>(null);
  const [cleanupMessage, setCleanupMessage] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const backupStats = getDirStats(getSubDir("backups"));
        const templateStats = getDirStats(getSubDir("templates"));
        const scriptStats = getDirStats(getSubDir("scripts"));
        const logStats = getDirStats(getSubDir("logs"));

        const backupList = await getBackupList();
        setBackups(backupList);

        const lastBackup =
          backupList.length > 0 ? backupList[0].createdAt : undefined;
        const oldestBackup =
          backupList.length > 0
            ? backupList[backupList.length - 1].createdAt
            : undefined;

        setStatus({
          backups: backupStats,
          templates: templateStats,
          scripts: scriptStats,
          logs: logStats,
          lastBackup,
          oldestBackup,
        });

        setPhase(cleanup ? "cleanup" : "display");
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
        setPhase("error");
        exit();
      }
    })();
  }, []);

  const handleCleanupSelect = (item: SelectItem) => {
    const action = item.value;
    if (action === "cancel") {
      setPhase("done");
      setTimeout(() => exit(), 100);
      return;
    }
    setCleanupAction(action);

    if (action === "keep-recent-5") {
      const toDelete = backups.slice(5);
      setCleanupMessage(
        `최근 5개 백업만 유지합니다. ${toDelete.length}개 삭제, ${formatBytes(toDelete.reduce((s, b) => s + b.size, 0))} 확보`,
      );
    } else if (action === "older-than-30") {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - 30);
      const toDelete = backups.filter((b) => b.createdAt < cutoff);
      setCleanupMessage(
        `30일 이전 백업을 제거합니다. ${toDelete.length}개 삭제, ${formatBytes(toDelete.reduce((s, b) => s + b.size, 0))} 확보`,
      );
    } else if (action === "delete-logs") {
      setCleanupMessage(
        `로그 전체를 삭제합니다. ${formatBytes(status?.logs.totalSize ?? 0)} 확보`,
      );
    }

    setPhase("confirming");
  };

  const handleConfirm = (yes: boolean) => {
    if (!yes) {
      setPhase("done");
      setTimeout(() => exit(), 100);
      return;
    }

    try {
      if (cleanupAction === "keep-recent-5") {
        const toDelete = backups.slice(5);
        for (const b of toDelete) {
          unlinkSync(b.path);
        }
      } else if (cleanupAction === "older-than-30") {
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - 30);
        const toDelete = backups.filter((b) => b.createdAt < cutoff);
        for (const b of toDelete) {
          unlinkSync(b.path);
        }
      } else if (cleanupAction === "delete-logs") {
        const logsDir = getSubDir(LOGS_DIR);
        try {
          const entries = readdirSync(logsDir);
          for (const entry of entries) {
            unlinkSync(join(logsDir, entry));
          }
        } catch {
          // ignore
        }
      }

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

  if (phase === "loading") {
    return <Text>불러오는 중...</Text>;
  }

  if (!status) return null;

  const totalCount =
    status.backups.count +
    status.templates.count +
    status.scripts.count +
    status.logs.count;
  const totalSize =
    status.backups.totalSize +
    status.templates.totalSize +
    status.scripts.totalSize +
    status.logs.totalSize;

  // Default status display
  const statusDisplay = (
    <Box flexDirection="column">
      <Text bold>
        ▸ {APP_NAME} 상태 — ~/.{APP_NAME}/
      </Text>
      <Box marginLeft={2} marginTop={1}>
        <Table
          headers={["항목", "개수", "크기"]}
          rows={[
            [
              "backups/",
              `${status.backups.count}개`,
              formatBytes(status.backups.totalSize),
            ],
            [
              "templates/",
              `${status.templates.count}개`,
              formatBytes(status.templates.totalSize),
            ],
            [
              "scripts/",
              `${status.scripts.count}개`,
              formatBytes(status.scripts.totalSize),
            ],
            [
              "logs/",
              `${status.logs.count}개`,
              formatBytes(status.logs.totalSize),
            ],
            ["합계", `${totalCount}개`, formatBytes(totalSize)],
          ]}
        />
      </Box>
      {status.lastBackup && (
        <Box marginTop={1} marginLeft={2} flexDirection="column">
          <Text>
            최근 백업: {formatDate(status.lastBackup)} (
            {formatRelativeTime(status.lastBackup)})
          </Text>
          {status.oldestBackup && (
            <Text>
              가장 오래된 백업: {formatDate(status.oldestBackup)} (
              {formatRelativeTime(status.oldestBackup)})
            </Text>
          )}
        </Box>
      )}
    </Box>
  );

  if (phase === "display") {
    return statusDisplay;
  }

  // Cleanup mode
  if (phase === "cleanup") {
    const keepRecent5 = backups.slice(5);
    const cutoff30 = new Date();
    cutoff30.setDate(cutoff30.getDate() - 30);
    const olderThan30 = backups.filter((b) => b.createdAt < cutoff30);

    const cleanupItems: SelectItem[] = [
      {
        label: `최근 5개 백업만 유지       ${keepRecent5.length}개 삭제, ${formatBytes(keepRecent5.reduce((s, b) => s + b.size, 0))} 확보`,
        value: "keep-recent-5",
      },
      {
        label: `30일 이전 백업 제거         ${olderThan30.length}개 삭제, ${formatBytes(olderThan30.reduce((s, b) => s + b.size, 0))} 확보`,
        value: "older-than-30",
      },
      {
        label: `로그 전체 삭제              ${formatBytes(status.logs.totalSize)} 확보`,
        value: "delete-logs",
      },
      {
        label: "취소",
        value: "cancel",
      },
    ];

    return (
      <Box flexDirection="column">
        {statusDisplay}
        <Box flexDirection="column" marginTop={1}>
          <Text bold>▸ 정리 옵션</Text>
          <SelectInput
            items={cleanupItems}
            onSelect={handleCleanupSelect}
          />
        </Box>
      </Box>
    );
  }

  if (phase === "confirming") {
    return (
      <Box flexDirection="column">
        <Text>{cleanupMessage}</Text>
        <Confirm
          message="진행할까요?"
          onConfirm={handleConfirm}
          defaultYes={false}
        />
      </Box>
    );
  }

  if (phase === "done") {
    return (
      <Box flexDirection="column">
        <Text color="green">✓ 정리 완료</Text>
      </Box>
    );
  }

  return null;
};

export function registerStatusCommand(program: Command): void {
  program
    .command("status")
    .description(`~/.${APP_NAME}/ 전체 상태 요약`)
    .option("--cleanup", "인터랙티브 정리 모드", false)
    .action(async (opts: { cleanup: boolean }) => {
      const { waitUntilExit } = render(
        <StatusView cleanup={opts.cleanup} />,
      );
      await waitUntilExit();
    });
}
