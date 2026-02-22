import { join } from 'node:path';

import { Command } from 'commander';
import { Box, Text, useApp } from 'ink';
import { render } from 'ink';
import React, { useEffect, useState } from 'react';

import {
  APP_NAME,
  BACKUPS_DIR,
  CONFIG_FILENAME,
  LOGS_DIR,
  SCRIPTS_DIR,
  TEMPLATES_DIR,
  getAppDir,
  getSubDir,
} from '../constants.js';
import { initDefaultConfig } from '../core/config.js';
import { readAsset } from '../utils/assets.js';
import { ensureDir, fileExists } from '../utils/paths.js';

interface StepInfo {
  name: string;
  done: boolean;
}

const InitView: React.FC = () => {
  const { exit } = useApp();
  const [steps, setSteps] = useState<StepInfo[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [complete, setComplete] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const appDir = getAppDir();

        // Check if already initialized
        if (await fileExists(join(appDir, CONFIG_FILENAME))) {
          setError(`Already initialized: ${appDir}`);
          exit();
          return;
        }

        const dirs = [
          { name: appDir, label: `~/.${APP_NAME}/` },
          {
            name: getSubDir(BACKUPS_DIR),
            label: `~/.${APP_NAME}/${BACKUPS_DIR}/`,
          },
          {
            name: getSubDir(TEMPLATES_DIR),
            label: `~/.${APP_NAME}/${TEMPLATES_DIR}/`,
          },
          {
            name: getSubDir(SCRIPTS_DIR),
            label: `~/.${APP_NAME}/${SCRIPTS_DIR}/`,
          },
          {
            name: getSubDir(LOGS_DIR),
            label: `~/.${APP_NAME}/${LOGS_DIR}/`,
          },
        ];

        const completed: StepInfo[] = [];

        for (const dir of dirs) {
          await ensureDir(dir.name);
          completed.push({ name: `Created ${dir.label}`, done: true });
          setSteps([...completed]);
        }

        await initDefaultConfig();
        completed.push({
          name: `Created ${CONFIG_FILENAME} (defaults)`,
          done: true,
        });
        setSteps([...completed]);

        // Create example template
        const exampleTemplatePath = join(
          getSubDir(TEMPLATES_DIR),
          'example.yml',
        );
        if (!(await fileExists(exampleTemplatePath))) {
          const { writeFile } = await import('node:fs/promises');
          const exampleYaml = readAsset('template.example.yml');
          await writeFile(exampleTemplatePath, exampleYaml, 'utf-8');
          completed.push({ name: `Created templates/example.yml`, done: true });
          setSteps([...completed]);
        }

        setComplete(true);

        // Allow time for final render before exit
        setTimeout(() => exit(), 100);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
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

  return (
    <Box flexDirection="column">
      {steps.map((step, idx) => (
        <Text key={idx}>
          <Text color="green">✓</Text> {step.name}
        </Text>
      ))}

      {complete && (
        <Box flexDirection="column" marginTop={1}>
          <Text bold>Initialization complete! Next steps:</Text>
          <Text>{'  '}1. Edit config.yml to specify backup targets</Text>
          <Text>
            {'     '}→ ~/.{APP_NAME}/{CONFIG_FILENAME}
          </Text>
          <Text>
            {'  '}2. Run {APP_NAME} backup to create your first snapshot
          </Text>
        </Box>
      )}
    </Box>
  );
};

export function registerInitCommand(program: Command): void {
  program
    .command('init')
    .description(
      `Initialize ~/.${APP_NAME}/ directory structure and default config`,
    )
    .action(async () => {
      const { waitUntilExit } = render(<InitView />);
      await waitUntilExit();
    });
}
