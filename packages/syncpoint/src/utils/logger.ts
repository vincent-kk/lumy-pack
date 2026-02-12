import { appendFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';

import pc from 'picocolors';

import { LOGS_DIR, getAppDir } from '../constants.js';

// ANSI escape code stripper
const ANSI_RE = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, 'g');
function stripAnsi(str: string): string {
  return str.replace(ANSI_RE, '');
}

function timestamp(): string {
  const now = new Date();
  const h = String(now.getHours()).padStart(2, '0');
  const m = String(now.getMinutes()).padStart(2, '0');
  const s = String(now.getSeconds()).padStart(2, '0');
  return `${h}:${m}:${s}`;
}

function dateStamp(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

let logDirCreated = false;

async function writeToFile(level: string, message: string): Promise<void> {
  try {
    const logsDir = join(getAppDir(), LOGS_DIR);
    if (!logDirCreated) {
      await mkdir(logsDir, { recursive: true });
      logDirCreated = true;
    }
    const logFile = join(logsDir, `${dateStamp()}.log`);
    const line = `[${timestamp()}] [${level.toUpperCase()}] ${stripAnsi(message)}\n`;
    await appendFile(logFile, line, 'utf-8');
  } catch {
    // Silently ignore file logging errors — console output is primary
  }
}

export const logger = {
  info(message: string): void {
    console.log(`${pc.blue('info')} ${message}`);
    void writeToFile('info', message);
  },
  success(message: string): void {
    console.log(`${pc.green('success')} ${message}`);
    void writeToFile('success', message);
  },
  warn(message: string): void {
    console.warn(`${pc.yellow('warn')} ${message}`);
    void writeToFile('warn', message);
  },
  error(message: string): void {
    console.error(`${pc.red('error')} ${message}`);
    void writeToFile('error', message);
  },
};
