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

type Phase = "loading" | "display" | "cleanup" | "select-delete" | "confirming" | "done" | "error";

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
  const [selectedForDeletion, setSelectedForDeletion] = useState<BackupInfo[]>([]);

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
        setTimeout(() => exit(), 100);
      }
    })();
  }, []);

  const handleDisplayAction = (item: SelectItem) => {
    if (item.value === "cleanup") {
      setPhase("cleanup");
    } else if (item.value === "exit") {
      setTimeout(() => exit(), 100);
    }
  };

  const handleCleanupSelect = (item: SelectItem) => {
    const action = item.value;
    if (action === "cancel") {
      setPhase("done");
      setTimeout(() => exit(), 100);
      return;
    }

    if (action === "select-specific") {
      setSelectedForDeletion([]);
      setPhase("select-delete");
      return;
    }

    setCleanupAction(action);

    if (action === "keep-recent-5") {
      const toDelete = backups.slice(5);
      setCleanupMessage(
        `Keep only the 5 most recent backups. ${toDelete.length} to delete, ${formatBytes(toDelete.reduce((s, b) => s + b.size, 0))} freed`,
      );
    } else if (action === "older-than-30") {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - 30);
      const toDelete = backups.filter((b) => b.createdAt < cutoff);
      setCleanupMessage(
        `Remove backups older than 30 days. ${toDelete.length} to delete, ${formatBytes(toDelete.reduce((s, b) => s + b.size, 0))} freed`,
      );
    } else if (action === "delete-logs") {
      setCleanupMessage(
        `Delete all logs. ${formatBytes(status?.logs.totalSize ?? 0)} freed`,
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
      } else if (cleanupAction === "select-specific") {
        for (const b of selectedForDeletion) {
          unlinkSync(b.path);
        }
      }

      setPhase("done");
      setTimeout(() => exit(), 100);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setPhase("error");
      setTimeout(() => exit(), 100);
    }
  };

  const handleSelectBackup = (item: SelectItem) => {
    if (item.value === "done") {
      if (selectedForDeletion.length === 0) {
        setPhase("cleanup");
        return;
      }
      setCleanupAction("select-specific");
      setCleanupMessage(
        `Delete ${selectedForDeletion.length} selected backup(s). ${formatBytes(selectedForDeletion.reduce((s, b) => s + b.size, 0))} freed`,
      );
      setPhase("confirming");
      return;
    }
    const backup = backups.find((b) => b.path === item.value);
    if (backup) {
      setSelectedForDeletion((prev) => [...prev, backup]);
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
    return <Text>Loading...</Text>;
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
        ▸ {APP_NAME} status — ~/.{APP_NAME}/
      </Text>
      <Box marginLeft={2} marginTop={1}>
        <Table
          headers={["Directory", "Count", "Size"]}
          rows={[
            [
              "backups/",
              `${status.backups.count}`,
              formatBytes(status.backups.totalSize),
            ],
            [
              "templates/",
              `${status.templates.count}`,
              formatBytes(status.templates.totalSize),
            ],
            [
              "scripts/",
              `${status.scripts.count}`,
              formatBytes(status.scripts.totalSize),
            ],
            [
              "logs/",
              `${status.logs.count}`,
              formatBytes(status.logs.totalSize),
            ],
            ["Total", `${totalCount}`, formatBytes(totalSize)],
          ]}
        />
      </Box>
      {status.lastBackup && (
        <Box marginTop={1} marginLeft={2} flexDirection="column">
          <Text>
            Latest backup: {formatDate(status.lastBackup)} (
            {formatRelativeTime(status.lastBackup)})
          </Text>
          {status.oldestBackup && (
            <Text>
              Oldest backup: {formatDate(status.oldestBackup)} (
              {formatRelativeTime(status.oldestBackup)})
            </Text>
          )}
        </Box>
      )}
    </Box>
  );

  if (phase === "display") {
    return (
      <Box flexDirection="column">
        {statusDisplay}
        <Box flexDirection="column" marginTop={1}>
          <Text bold>▸ Actions</Text>
          <SelectInput
            items={[
              { label: "Cleanup", value: "cleanup" },
              { label: "Exit", value: "exit" },
            ]}
            onSelect={handleDisplayAction}
          />
        </Box>
      </Box>
    );
  }

  // Cleanup mode
  if (phase === "cleanup") {
    const keepRecent5 = backups.slice(5);
    const cutoff30 = new Date();
    cutoff30.setDate(cutoff30.getDate() - 30);
    const olderThan30 = backups.filter((b) => b.createdAt < cutoff30);

    const cleanupItems: SelectItem[] = [
      {
        label: `Keep only 5 recent backups  ${keepRecent5.length} to delete, ${formatBytes(keepRecent5.reduce((s, b) => s + b.size, 0))} freed`,
        value: "keep-recent-5",
      },
      {
        label: `Remove backups older than 30d ${olderThan30.length} to delete, ${formatBytes(olderThan30.reduce((s, b) => s + b.size, 0))} freed`,
        value: "older-than-30",
      },
      {
        label: "Select specific backups to delete",
        value: "select-specific",
      },
      {
        label: `Delete all logs               ${formatBytes(status.logs.totalSize)} freed`,
        value: "delete-logs",
      },
      {
        label: "Cancel",
        value: "cancel",
      },
    ];

    return (
      <Box flexDirection="column">
        {statusDisplay}
        <Box flexDirection="column" marginTop={1}>
          <Text bold>▸ Cleanup options</Text>
          <SelectInput
            items={cleanupItems}
            onSelect={handleCleanupSelect}
          />
        </Box>
      </Box>
    );
  }

  if (phase === "select-delete") {
    const remaining = backups.filter(
      (b) => !selectedForDeletion.some((s) => s.path === b.path),
    );
    const selectItems: SelectItem[] = [
      ...remaining.map((b) => ({
        label: `${b.filename.replace(".tar.gz", "")}  ${formatBytes(b.size)}  ${formatDate(b.createdAt)}`,
        value: b.path,
      })),
      {
        label: `Done (${selectedForDeletion.length} selected)`,
        value: "done",
      },
    ];

    return (
      <Box flexDirection="column">
        {statusDisplay}
        <Box flexDirection="column" marginTop={1}>
          <Text bold>▸ Select backups to delete</Text>
          {selectedForDeletion.length > 0 && (
            <Text color="yellow">
              {"  "}{selectedForDeletion.length} backup(s) selected ({formatBytes(selectedForDeletion.reduce((s, b) => s + b.size, 0))})
            </Text>
          )}
          <SelectInput
            items={selectItems}
            onSelect={handleSelectBackup}
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
          message="Proceed?"
          onConfirm={handleConfirm}
          defaultYes={false}
        />
      </Box>
    );
  }

  if (phase === "done") {
    return (
      <Box flexDirection="column">
        <Text color="green">✓ Cleanup complete</Text>
      </Box>
    );
  }

  return null;
};

export function registerStatusCommand(program: Command): void {
  program
    .command("status")
    .description(`Show ~/.${APP_NAME}/ status summary`)
    .option("--cleanup", "Interactive cleanup mode", false)
    .action(async (opts: { cleanup: boolean }) => {
      const { waitUntilExit } = render(
        <StatusView cleanup={opts.cleanup} />,
      );
      await waitUntilExit();
    });
}
