import { unlinkSync } from 'node:fs';

import { Command } from 'commander';
import { Box, Text, useApp, useInput } from 'ink';
import { render } from 'ink';
import SelectInput from 'ink-select-input';
import React, { useEffect, useState } from 'react';

import { Confirm } from '../components/Confirm.js';
import { Table } from '../components/Table.js';
import { getSubDir } from '../constants.js';
import { loadConfig } from '../core/config.js';
import { listTemplates } from '../core/provision.js';
import { getBackupList } from '../core/restore.js';
import { formatBytes, formatDate } from '../utils/format.js';
import { isInsideDir, resolveTargetPath } from '../utils/paths.js';
import type { BackupInfo, TemplateConfig } from '../utils/types.js';

type Phase =
  | 'loading'
  | 'main-menu'
  | 'backup-list'
  | 'template-list'
  | 'backup-detail'
  | 'template-detail'
  | 'deleting'
  | 'done'
  | 'error';

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

// ── Custom item component for colored menu labels ──

const MenuItem: React.FC<{
  isSelected?: boolean;
  label: string;
}> = ({ isSelected = false, label }) => {
  // Color Delete in red
  if (label === 'Delete') {
    return (
      <Text bold={isSelected} color="red">
        {label}
      </Text>
    );
  }

  // Parse label with count (e.g., "Backups (3)")
  const match = label.match(/^(.+?)\s+\((\d+)\)$/);
  if (match) {
    const [, name, count] = match;
    return (
      <Text>
        <Text bold={isSelected}>{name}</Text> <Text dimColor>({count})</Text>
      </Text>
    );
  }

  return <Text bold={isSelected}>{label}</Text>;
};

// ── Main ListView ──

const ListView: React.FC<ListViewProps> = ({ type, deleteIndex }) => {
  const { exit } = useApp();
  const [phase, setPhase] = useState<Phase>('loading');
  const [backups, setBackups] = useState<BackupInfo[]>([]);
  const [templates, setTemplates] = useState<TemplateInfo[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateInfo | null>(
    null,
  );
  const [selectedBackup, setSelectedBackup] = useState<BackupInfo | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{
    name: string;
    path: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [backupDir, setBackupDir] = useState<string>(getSubDir('backups'));

  // Unified ESC key handling for all phases
  useInput((_input, key) => {
    if (!key.escape) return;

    switch (phase) {
      case 'main-menu':
        exit();
        break;
      case 'backup-list':
      case 'template-list':
        setSelectedBackup(null);
        setSelectedTemplate(null);
        setPhase('main-menu');
        break;
      case 'backup-detail':
        setSelectedBackup(null);
        setPhase('backup-list');
        break;
      case 'template-detail':
        setSelectedTemplate(null);
        setPhase('template-list');
        break;
    }
  });

  useEffect(() => {
    (async () => {
      try {
        const config = await loadConfig();

        // Set backup directory from config
        const backupDirectory = config.backup.destination
          ? resolveTargetPath(config.backup.destination)
          : getSubDir('backups');
        setBackupDir(backupDirectory);

        const showBackups = !type || type === 'backups';
        const showTemplates = !type || type === 'templates';

        if (showBackups) {
          const list = await getBackupList(config);
          setBackups(list);
        }

        if (showTemplates) {
          const tmpls = await listTemplates();
          setTemplates(tmpls);
        }

        // Handle --delete option
        if (deleteIndex != null && type === 'backups') {
          const list = await getBackupList(config);
          const idx = deleteIndex - 1;
          if (idx < 0 || idx >= list.length) {
            setError(`Invalid index: ${deleteIndex}`);
            setPhase('error');
            setTimeout(() => exit(), 100);
            return;
          }
          setDeleteTarget({
            name: list[idx].filename,
            path: list[idx].path,
          });
          setPhase('deleting');
          return;
        }

        setPhase('main-menu');
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
        setPhase('error');
        setTimeout(() => exit(), 100);
      }
    })();
  }, []);

  const goBackToMainMenu = () => {
    setSelectedBackup(null);
    setSelectedTemplate(null);
    setPhase('main-menu');
  };

  const goBackToBackupList = () => {
    setSelectedBackup(null);
    setPhase('backup-list');
  };

  const goBackToTemplateList = () => {
    setSelectedTemplate(null);
    setPhase('template-list');
  };

  const handleDeleteConfirm = (yes: boolean) => {
    if (yes && deleteTarget) {
      try {
        if (!isInsideDir(deleteTarget.path, backupDir)) {
          throw new Error(`Refusing to delete file outside backups directory: ${deleteTarget.path}`);
        }
        unlinkSync(deleteTarget.path);
        setPhase('done');
        setTimeout(() => exit(), 100);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
        setPhase('error');
        setTimeout(() => exit(), 100);
      }
    } else {
      // No -> go back to previous view
      setDeleteTarget(null);
      if (selectedBackup) {
        setPhase('backup-detail');
      } else {
        goBackToMainMenu();
      }
    }
  };

  // ── Render phases ──

  if (phase === 'error' || error) {
    return (
      <Box flexDirection="column">
        <Text color="red">✗ {error}</Text>
      </Box>
    );
  }

  if (phase === 'loading') {
    return <Text color="cyan">Loading...</Text>;
  }

  if (phase === 'deleting' && deleteTarget) {
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

  if (phase === 'done' && deleteTarget) {
    return <Text color="green">✓ {deleteTarget.name} deleted</Text>;
  }

  // ── Main Menu (Step 1) ──
  if (phase === 'main-menu') {
    const showBackups = !type || type === 'backups';
    const showTemplates = !type || type === 'templates';

    const menuItems: SelectItem[] = [];

    if (showBackups) {
      menuItems.push({
        label: `Backups (${backups.length})`,
        value: 'backups',
      });
    }
    if (showTemplates) {
      menuItems.push({
        label: `Templates (${templates.length})`,
        value: 'templates',
      });
    }
    menuItems.push({ label: 'Exit', value: 'exit' });

    const handleMainMenu = (item: SelectItem) => {
      if (item.value === 'exit') {
        exit();
      } else if (item.value === 'backups') {
        setPhase('backup-list');
      } else if (item.value === 'templates') {
        setPhase('template-list');
      }
    };

    return (
      <Box flexDirection="column">
        <SelectInput
          items={menuItems}
          onSelect={handleMainMenu}
          itemComponent={MenuItem}
        />
        <Box marginTop={1}>
          <Text dimColor>
            Press <Text bold>ESC</Text> to exit
          </Text>
        </Box>
      </Box>
    );
  }

  // ── Backup List (Step 2) ──
  if (phase === 'backup-list') {
    const items: SelectItem[] = backups.map((b) => ({
      label: `${b.filename.replace('.tar.gz', '')}  •  ${formatBytes(b.size)}  •  ${formatDate(b.createdAt)}`,
      value: b.path,
    }));

    const handleBackupSelect = (item: SelectItem) => {
      const backup = backups.find((b) => b.path === item.value);
      if (backup) {
        setSelectedBackup(backup);
        setPhase('backup-detail');
      }
    };

    return (
      <Box flexDirection="column">
        <Text bold>▸ Backups</Text>
        <Box marginTop={1}>
          {backups.length === 0 ? (
            <Text color="gray"> No backups found.</Text>
          ) : (
            <SelectInput
              items={items}
              onSelect={handleBackupSelect}
              itemComponent={MenuItem}
            />
          )}
        </Box>
        <Box marginTop={1}>
          <Text dimColor>
            Press <Text bold>ESC</Text> to go back
          </Text>
        </Box>
      </Box>
    );
  }

  // ── Template List (Step 2) ──
  if (phase === 'template-list') {
    const items: SelectItem[] = templates.map((t) => ({
      label: t.config.description
        ? `${t.config.name}  —  ${t.config.description}`
        : t.config.name,
      value: t.path,
    }));

    const handleTemplateSelect = (item: SelectItem) => {
      const tmpl = templates.find((t) => t.path === item.value);
      if (tmpl) {
        setSelectedTemplate(tmpl);
        setPhase('template-detail');
      }
    };

    return (
      <Box flexDirection="column">
        <Text bold>▸ Templates</Text>
        <Box marginTop={1}>
          {templates.length === 0 ? (
            <Text color="gray"> No templates found.</Text>
          ) : (
            <SelectInput
              items={items}
              onSelect={handleTemplateSelect}
              itemComponent={MenuItem}
            />
          )}
        </Box>
        <Box marginTop={1}>
          <Text dimColor>
            Press <Text bold>ESC</Text> to go back
          </Text>
        </Box>
      </Box>
    );
  }

  // ── Backup Detail (Step 3) ──
  if (phase === 'backup-detail' && selectedBackup) {
    const sections = [
      { label: 'Filename', value: selectedBackup.filename },
      { label: 'Date', value: formatDate(selectedBackup.createdAt) },
      { label: 'Size', value: formatBytes(selectedBackup.size) },
      ...(selectedBackup.hostname
        ? [{ label: 'Hostname', value: selectedBackup.hostname }]
        : []),
      ...(selectedBackup.fileCount != null
        ? [{ label: 'Files', value: String(selectedBackup.fileCount) }]
        : []),
    ];

    const actionItems: SelectItem[] = [
      { label: 'Delete', value: 'delete' },
      { label: 'Cancel', value: 'cancel' },
    ];

    const handleDetailAction = (item: SelectItem) => {
      if (item.value === 'delete') {
        setDeleteTarget({
          name: selectedBackup.filename,
          path: selectedBackup.path,
        });
        setPhase('deleting');
      } else if (item.value === 'cancel') {
        goBackToBackupList();
      }
    };

    return (
      <Box flexDirection="column">
        <Text bold>▸ {selectedBackup.filename.replace('.tar.gz', '')}</Text>
        <Box flexDirection="column" marginLeft={2} marginTop={1}>
          {sections.map((section, idx) => {
            const labelWidth =
              Math.max(...sections.map((s) => s.label.length)) + 1;
            return (
              <Box key={idx}>
                <Text dimColor>{section.label.padEnd(labelWidth)}</Text>
                <Text> </Text>
                <Text>{section.value}</Text>
              </Box>
            );
          })}
        </Box>
        <Box marginTop={1}>
          <SelectInput
            items={actionItems}
            onSelect={handleDetailAction}
            itemComponent={MenuItem}
          />
        </Box>
        <Box marginTop={1}>
          <Text dimColor>
            Press <Text bold>ESC</Text> to go back
          </Text>
        </Box>
      </Box>
    );
  }

  // ── Template Detail (Step 3) ──
  if (phase === 'template-detail' && selectedTemplate) {
    const t = selectedTemplate.config;
    const sections = [
      { label: 'Name', value: t.name },
      ...(t.description
        ? [{ label: 'Description', value: t.description }]
        : []),
      ...(t.backup ? [{ label: 'Backup link', value: t.backup }] : []),
      { label: 'Steps', value: String(t.steps.length) },
    ];

    const actionItems: SelectItem[] = [{ label: 'Cancel', value: 'cancel' }];

    const handleDetailAction = (item: SelectItem) => {
      if (item.value === 'cancel') {
        goBackToTemplateList();
      }
    };

    const labelWidth = Math.max(...sections.map((s) => s.label.length)) + 1;

    return (
      <Box flexDirection="column">
        <Text bold>▸ {selectedTemplate.name}</Text>
        <Box flexDirection="column" marginLeft={2} marginTop={1}>
          {sections.map((section, idx) => (
            <Box key={idx}>
              <Text dimColor>{section.label.padEnd(labelWidth)}</Text>
              <Text> </Text>
              <Text>{section.value}</Text>
            </Box>
          ))}
        </Box>

        {t.steps.length > 0 && (
          <Box flexDirection="column" marginTop={1}>
            <Text dimColor> Provisioning Steps</Text>
            <Box marginLeft={2}>
              <Table
                headers={['#', 'Step', 'Description']}
                rows={t.steps.map((s, idx) => [
                  String(idx + 1),
                  s.name,
                  s.description ?? '—',
                ])}
              />
            </Box>
          </Box>
        )}

        <Box marginTop={1}>
          <SelectInput
            items={actionItems}
            onSelect={handleDetailAction}
            itemComponent={MenuItem}
          />
        </Box>
        <Box marginTop={1}>
          <Text dimColor>
            Press <Text bold>ESC</Text> to go back
          </Text>
        </Box>
      </Box>
    );
  }

  return null;
};

export function registerListCommand(program: Command): void {
  program
    .command('list [type]')
    .description('List backups and templates')
    .option('--delete <n>', 'Delete item #n')
    .action(async (type: string | undefined, opts: { delete?: string }) => {
      const deleteIndex = opts.delete ? parseInt(opts.delete, 10) : undefined;
      if (deleteIndex !== undefined && isNaN(deleteIndex)) {
        console.error(`Invalid delete index: ${opts.delete}`);
        process.exit(1);
      }
      const { waitUntilExit } = render(
        <ListView type={type} deleteIndex={deleteIndex} />,
      );
      await waitUntilExit();
    });
}
