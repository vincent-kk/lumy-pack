import React, { useState, useEffect } from "react";
import { Text, Box, useApp } from "ink";
import { Command } from "commander";
import { render } from "ink";
import { join } from "node:path";

import {
  APP_NAME,
  getAppDir,
  getSubDir,
  BACKUPS_DIR,
  TEMPLATES_DIR,
  SCRIPTS_DIR,
  LOGS_DIR,
  CONFIG_FILENAME,
} from "../constants.js";
import { ensureDir, fileExists } from "../utils/paths.js";
import { initDefaultConfig } from "../core/config.js";

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
          setError(`이미 초기화되어 있습니다: ${appDir}`);
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
          completed.push({ name: `${dir.label} 생성`, done: true });
          setSteps([...completed]);
        }

        await initDefaultConfig();
        completed.push({ name: `${CONFIG_FILENAME} 생성 (기본값)`, done: true });
        setSteps([...completed]);
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
          <Text bold>초기화 완료! 다음 단계:</Text>
          <Text>
            {"  "}1. config.yml을 편집하여 백업 대상을 지정하세요
          </Text>
          <Text>
            {"     "}→ ~/.{APP_NAME}/{CONFIG_FILENAME}
          </Text>
          <Text>
            {"  "}2. {APP_NAME} backup 으로 첫 번째 스냅샷을 만드세요
          </Text>
        </Box>
      )}
    </Box>
  );
};

export function registerInitCommand(program: Command): void {
  program
    .command("init")
    .description(`~/.${APP_NAME}/ 구조 생성 및 기본 설정 초기화`)
    .action(async () => {
      const { waitUntilExit } = render(<InitView />);
      await waitUntilExit();
    });
}
