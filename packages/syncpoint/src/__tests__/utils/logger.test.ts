import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { logger } from '../../utils/logger.js';
import { createSandbox } from '../helpers/sandbox.js';

describe('utils/logger', () => {
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleWarnSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  it('logger.info calls console.log', () => {
    logger.info('test message');
    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining('test message'),
    );
  });

  it('logger.success calls console.log', () => {
    logger.success('success message');
    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining('success message'),
    );
  });

  it('logger.warn calls console.warn', () => {
    logger.warn('warning message');
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining('warning message'),
    );
  });

  it('logger.error calls console.error', () => {
    logger.error('error message');
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('error message'),
    );
  });

  describe('log file creation', () => {
    const sandbox = createSandbox();

    beforeEach(() => {
      sandbox.apply();
    });

    afterEach(() => {
      sandbox.cleanup();
    });

    it('creates log file in sandbox logs directory', async () => {
      // Log a message
      logger.info('test log entry');

      // Wait a bit for async file write
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Check that logs directory was created
      const logsDir = join(sandbox.appDir, 'logs');

      // Check for log file with today's date
      const now = new Date();
      const y = now.getFullYear();
      const m = String(now.getMonth() + 1).padStart(2, '0');
      const d = String(now.getDate()).padStart(2, '0');
      const dateStamp = `${y}-${m}-${d}`;
      const logFile = join(logsDir, `${dateStamp}.log`);

      // Read log file content
      const content = await readFile(logFile, 'utf-8');
      expect(content).toContain('test log entry');
      expect(content).toContain('[INFO]');
    });
  });
});
