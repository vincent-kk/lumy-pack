import { mkdir, rm, writeFile } from "node:fs/promises";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

export interface Sandbox {
  root: string;
  home: string;
  appDir: string;
  backupsDir: string;
  templatesDir: string;
  scriptsDir: string;
  logsDir: string;
  cleanup: () => Promise<void>;
  apply: () => void;
  restore: () => void;
}

export function createSandbox(): Sandbox {
  const root = mkdtempSync(join(tmpdir(), "syncpoint-test-"));
  const home = join(root, "home");
  const appDir = join(home, ".syncpoint");
  const backupsDir = join(appDir, "backups");
  const templatesDir = join(appDir, "templates");
  const scriptsDir = join(appDir, "scripts");
  const logsDir = join(appDir, "logs");

  const originalHome = process.env.SYNCPOINT_HOME;

  return {
    root,
    home,
    appDir,
    backupsDir,
    templatesDir,
    scriptsDir,
    logsDir,
    apply: () => {
      process.env.SYNCPOINT_HOME = home;
    },
    restore: () => {
      if (originalHome !== undefined) {
        process.env.SYNCPOINT_HOME = originalHome;
      } else {
        delete process.env.SYNCPOINT_HOME;
      }
    },
    cleanup: async () => {
      if (originalHome !== undefined) {
        process.env.SYNCPOINT_HOME = originalHome;
      } else {
        delete process.env.SYNCPOINT_HOME;
      }
      await rm(root, { recursive: true, force: true });
    },
  };
}

export async function createInitializedSandbox(): Promise<Sandbox> {
  const sandbox = createSandbox();
  sandbox.apply();
  await mkdir(sandbox.backupsDir, { recursive: true });
  await mkdir(sandbox.templatesDir, { recursive: true });
  await mkdir(sandbox.scriptsDir, { recursive: true });
  await mkdir(sandbox.logsDir, { recursive: true });
  const defaultConfig = [
    "backup:",
    "  targets:",
    '    - "~/.zshrc"',
    "  exclude:",
    '    - "**/*.swp"',
    '  filename: "{hostname}_{datetime}"',
    "scripts:",
    "  includeInBackup: true",
  ].join("\n");
  await writeFile(join(sandbox.appDir, "config.yml"), defaultConfig, "utf-8");
  return sandbox;
}
