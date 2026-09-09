import pc from 'picocolors';

let debugMode = false;
let jsonMode = false;

export function setDebugMode(enabled: boolean): void {
  debugMode = enabled;
}

export function setJsonMode(enabled: boolean): void {
  jsonMode = enabled;
}

function timestamp(): string {
  return new Date().toLocaleTimeString('en-US', { hour12: false });
}

export const logger = {
  info(message: string): void {
    if (jsonMode) {
      process.stderr.write(`${pc.blue('info')} ${message}\n`);
    } else {
      console.log(`${pc.blue('info')} ${message}`);
    }
  },
  success(message: string): void {
    if (jsonMode) {
      process.stderr.write(`${pc.green('done')} ${message}\n`);
    } else {
      console.log(`\n${pc.green('done')} ${message}`);
    }
  },
  warn(message: string): void {
    console.warn(`${pc.yellow('warn')} ${message}`);
  },
  error(message: string): void {
    console.error(`${pc.red('error')} ${message}`);
  },
  debug(message: string): void {
    if (debugMode) {
      if (jsonMode) {
        process.stderr.write(`${pc.gray(`[${timestamp()}] debug`)} ${message}\n`);
      } else {
        console.log(`${pc.gray(`[${timestamp()}] debug`)} ${message}`);
      }
    }
  },
};
