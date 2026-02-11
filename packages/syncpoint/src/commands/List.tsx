import React, { useState, useEffect } from "react";
import { Text, Box, useApp } from "ink";
import SelectInput from "ink-select-input";
import { Command } from "commander";
import { render } from "ink";
import { unlinkSync } from "node:fs";

import type { BackupInfo, TemplateConfig } from "../utils/types.js";
import { getBackupList } from "../core/restore.js";
import { listTemplates } from "../core/provision.js";
import { formatBytes, formatDate } from "../utils/format.js";
import { Table } from "../components/Table.js";
import { Confirm } from "../components/Confirm.js";

type Phase = "loading" | "display" | "detail" | "deleting" | "done" | "error";

interface ListViewProps {
  type?: string;
  deleteIndex?: number;
}

interface TemplateInfo {
  name: string;
  path: string;
  config: TemplateConfig;
}

interface SelectItem {
  label: string;
  value: string;
}

const ListBackups: React.FC<{ backups: BackupInfo[] }> = ({ backups }) => {
  if (backups.length === 0) {
    return <Text color="gray">No backups found.</Text>;
  }

  const headers = ["#", "Name", "Size", "Date"];
  const rows = backups.map((b, idx) => [
    String(idx + 1),
    b.filename.replace(".tar.gz", ""),
    formatBytes(b.size),
    formatDate(b.createdAt),
  ]);

  return (
    <Box flexDirection="column">
      <Text bold>▸ Backups</Text>
      <Box marginLeft={2} marginTop={1}>
        <Table headers={headers} rows={rows} />
      </Box>
    </Box>
  );
};

const ListTemplates: React.FC<{
  templates: TemplateInfo[];
  onSelect?: (path: string) => void;
}> = ({ templates, onSelect }) => {
  if (templates.length === 0) {
    return <Text color="gray">No templates found.</Text>;
  }

  const items: SelectItem[] = templates.map((t) => ({
    label: `${t.config.name} — ${t.config.description ?? t.name}`,
    value: t.path,
  }));

  if (onSelect) {
    return (
      <Box flexDirection="column">
        <Text bold>▸ Templates</Text>
        <SelectInput
          items={items}
          onSelect={(item) => onSelect(item.value)}
        />
      </Box>
    );
  }

  return (
    <Box flexDirection="column">
      <Text bold>▸ Templates</Text>
      {templates.map((t, idx) => (
        <Text key={idx}>
          {"  "}{idx + 1}. {t.config.name}
          {t.config.description && (
            <Text color="gray"> — {t.config.description}</Text>
          )}
        </Text>
      ))}
    </Box>
  );
};

const TemplateDetail: React.FC<{ template: TemplateInfo }> = ({
  template,
}) => {
  const t = template.config;
  const headers = ["#", "Step", "Description"];
  const rows = t.steps.map((s, idx) => [
    String(idx + 1),
    s.name,
    s.description ?? "—",
  ]);

  return (
    <Box flexDirection="column">
      <Text bold>▸ {template.name}</Text>
      <Text>{"  "}{t.name}</Text>
      {t.description && <Text color="gray">{"  "}{t.description}</Text>}
      {t.backup && (
        <Text>
          {"  "}Backup link: {t.backup}
        </Text>
      )}
      <Box marginLeft={2} marginTop={1}>
        <Table headers={headers} rows={rows} />
      </Box>
    </Box>
  );
};

const ListView: React.FC<ListViewProps> = ({ type, deleteIndex }) => {
  const { exit } = useApp();
  const [phase, setPhase] = useState<Phase>("loading");
  const [backups, setBackups] = useState<BackupInfo[]>([]);
  const [templates, setTemplates] = useState<TemplateInfo[]>([]);
  const [selectedTemplate, setSelectedTemplate] =
    useState<TemplateInfo | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{
    name: string;
    path: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const showBackups = !type || type === "backups";
        const showTemplates = !type || type === "templates";

        if (showBackups) {
          const list = await getBackupList();
          setBackups(list);
        }

        if (showTemplates) {
          const tmpls = await listTemplates();
          setTemplates(tmpls);
        }

        // Handle --delete option
        if (deleteIndex != null && type === "backups") {
          const list = await getBackupList();
          const idx = deleteIndex - 1;
          if (idx < 0 || idx >= list.length) {
            setError(`Invalid index: ${deleteIndex}`);
            setPhase("error");
            exit();
            return;
          }
          setDeleteTarget({
            name: list[idx].filename,
            path: list[idx].path,
          });
          setPhase("deleting");
          return;
        }

        setPhase("display");
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
        setPhase("error");
        exit();
      }
    })();
  }, []);

  const handleTemplateSelect = (path: string) => {
    const tmpl = templates.find((t) => t.path === path);
    if (tmpl) {
      setSelectedTemplate(tmpl);
      setPhase("detail");
    }
  };

  const handleDeleteConfirm = (yes: boolean) => {
    if (yes && deleteTarget) {
      try {
        unlinkSync(deleteTarget.path);
        setPhase("done");
      } catch (err) {
        setError(
          err instanceof Error ? err.message : String(err),
        );
        setPhase("error");
      }
    } else {
      setPhase("done");
    }
    setTimeout(() => exit(), 100);
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

  if (phase === "deleting" && deleteTarget) {
    return (
      <Box flexDirection="column">
        <Confirm
          message={`Delete ${deleteTarget.name}?`}
          onConfirm={handleDeleteConfirm}
          defaultYes={false}
        />
      </Box>
    );
  }

  if (phase === "done" && deleteTarget) {
    return (
      <Text color="green">
        ✓ {deleteTarget.name} deleted
      </Text>
    );
  }

  if (phase === "detail" && selectedTemplate) {
    return <TemplateDetail template={selectedTemplate} />;
  }

  const showBackups = !type || type === "backups";
  const showTemplates = !type || type === "templates";

  return (
    <Box flexDirection="column">
      {showBackups && <ListBackups backups={backups} />}
      {showBackups && showTemplates && <Text>{""}</Text>}
      {showTemplates && (
        <ListTemplates
          templates={templates}
          onSelect={type === "templates" ? handleTemplateSelect : undefined}
        />
      )}
    </Box>
  );
};

export function registerListCommand(program: Command): void {
  program
    .command("list [type]")
    .description("List backups and templates")
    .option("--delete <n>", "Delete item #n")
    .action(async (type: string | undefined, opts: { delete?: string }) => {
      const deleteIndex = opts.delete ? parseInt(opts.delete, 10) : undefined;
      const { waitUntilExit } = render(
        <ListView type={type} deleteIndex={deleteIndex} />,
      );
      await waitUntilExit();
    });
}
