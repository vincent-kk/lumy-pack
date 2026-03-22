import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { logger, setDebugMode, setJsonMode } from '../../utils/logger.js';

describe('logger', () => {
  const stderrWrite = vi.fn().mockReturnValue(true);
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    setJsonMode(false);
    setDebugMode(false);
    stderrWrite.mockClear();
    vi.spyOn(process.stderr, 'write').mockImplementation(stderrWrite);
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('default mode (jsonMode=false)', () => {
    it('success writes to stdout via console.log', () => {
      logger.success('test message');
      expect(consoleLogSpy).toHaveBeenCalledOnce();
      expect(stderrWrite).not.toHaveBeenCalled();
    });

    it('info writes to stdout via console.log', () => {
      logger.info('test message');
      expect(consoleLogSpy).toHaveBeenCalledOnce();
      expect(stderrWrite).not.toHaveBeenCalled();
    });

    it('debug writes to stdout via console.log when debugMode is on', () => {
      setDebugMode(true);
      logger.debug('test message');
      expect(consoleLogSpy).toHaveBeenCalledOnce();
      expect(stderrWrite).not.toHaveBeenCalled();
    });
  });

  describe('json mode (jsonMode=true)', () => {
    beforeEach(() => {
      setJsonMode(true);
    });

    it('success writes to stderr, not stdout', () => {
      logger.success('test message');
      expect(consoleLogSpy).not.toHaveBeenCalled();
      expect(stderrWrite).toHaveBeenCalledOnce();
      expect(stderrWrite.mock.calls[0][0]).toContain('test message');
    });

    it('info writes to stderr, not stdout', () => {
      logger.info('test message');
      expect(consoleLogSpy).not.toHaveBeenCalled();
      expect(stderrWrite).toHaveBeenCalledOnce();
      expect(stderrWrite.mock.calls[0][0]).toContain('test message');
    });

    it('debug writes to stderr when debugMode is on', () => {
      setDebugMode(true);
      logger.debug('test message');
      expect(consoleLogSpy).not.toHaveBeenCalled();
      expect(stderrWrite).toHaveBeenCalledOnce();
      expect(stderrWrite.mock.calls[0][0]).toContain('test message');
    });

    it('stderr output ends with newline', () => {
      logger.success('test');
      const output = stderrWrite.mock.calls[0][0] as string;
      expect(output.endsWith('\n')).toBe(true);
    });
  });

  describe('warn and error are always stderr', () => {
    it('warn uses console.warn regardless of jsonMode', () => {
      logger.warn('warning');
      expect(consoleWarnSpy).toHaveBeenCalledOnce();

      setJsonMode(true);
      logger.warn('warning again');
      expect(consoleWarnSpy).toHaveBeenCalledTimes(2);
    });

    it('error uses console.error regardless of jsonMode', () => {
      logger.error('error');
      expect(consoleErrorSpy).toHaveBeenCalledOnce();

      setJsonMode(true);
      logger.error('error again');
      expect(consoleErrorSpy).toHaveBeenCalledTimes(2);
    });
  });
});
