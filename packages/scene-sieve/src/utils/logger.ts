import pc from 'picocolors';

let debugMode = false;

export function setDebugMode(enabled: boolean): void {
  debugMode = enabled;
}

function timestamp(): string {
  return new Date().toLocaleTimeString('en-US', { hour12: false });
}

export const logger = {
  info(message: string): void {
    console.log(`${pc.blue('info')} ${message}`);
  },
  success(message: string): void {
    console.log(`\n${pc.green('done')} ${message}`);
  },
  warn(message: string): void {
    console.warn(`${pc.yellow('warn')} ${message}`);
  },
  error(message: string): void {
    console.error(`${pc.red('error')} ${message}`);
  },
  debug(message: string): void {
    if (debugMode) {
      console.log(`${pc.gray(`[${timestamp()}] debug`)} ${message}`);
    }
  },
};
