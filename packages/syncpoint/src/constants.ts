import { homedir } from "node:os";
import { join } from "node:path";

export const APP_NAME = "syncpoint";
export const APP_DIR = `.${APP_NAME}`;
export const CONFIG_FILENAME = "config.yml";
export const METADATA_FILENAME = "_metadata.json";
export const LARGE_FILE_THRESHOLD = 10 * 1024 * 1024; // 10MB
export const MAX_RETRY = 3;
export const SENSITIVE_PATTERNS = ["id_rsa", "id_ed25519", "*.pem", "*.key"];
export const REMOTE_SCRIPT_PATTERN = /curl.*\|\s*(ba)?sh/;
export const BACKUPS_DIR = "backups";
export const TEMPLATES_DIR = "templates";
export const SCRIPTS_DIR = "scripts";
export const LOGS_DIR = "logs";

export function getAppDir(): string {
  return join(homedir(), APP_DIR);
}

export function getSubDir(sub: string): string {
  return join(getAppDir(), sub);
}
