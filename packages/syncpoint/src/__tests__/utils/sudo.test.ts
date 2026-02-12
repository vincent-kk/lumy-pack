import { execSync } from 'node:child_process';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ensureSudo, isSudoCached } from '../../utils/sudo.js';

vi.mock('node:child_process', () => ({
  execSync: vi.fn(),
}));

describe('utils/sudo', () => {
  const execSyncMock = execSync as ReturnType<typeof vi.fn>;

  beforeEach(() => {
    execSyncMock.mockClear();
  });

  describe('isSudoCached', () => {
    it('returns true when execSync succeeds', () => {
      execSyncMock.mockReturnValueOnce(Buffer.from(''));
      expect(isSudoCached()).toBe(true);
      expect(execSyncMock).toHaveBeenCalledWith('sudo -n true', {
        stdio: 'ignore',
      });
    });

    it('returns false when execSync throws', () => {
      execSyncMock.mockImplementationOnce(() => {
        throw new Error('sudo failed');
      });
      expect(isSudoCached()).toBe(false);
    });
  });

  describe('ensureSudo', () => {
    let consoleLogSpy: ReturnType<typeof vi.spyOn>;
    let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
    let processExitSpy: any; // process.exit has special 'never' return type incompatible with vi.spyOn

    beforeEach(() => {
      consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      processExitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {
        throw new Error('process.exit called');
      }) as () => never);
    });

    afterEach(() => {
      consoleLogSpy.mockRestore();
      consoleErrorSpy.mockRestore();
      processExitSpy.mockRestore();
    });

    it('returns immediately when sudo is cached', () => {
      execSyncMock.mockReturnValueOnce(Buffer.from('')); // sudo -n true succeeds
      ensureSudo('test-template');
      expect(consoleLogSpy).not.toHaveBeenCalled();
    });

    it('calls "sudo -v" when sudo is not cached', () => {
      execSyncMock
        .mockImplementationOnce(() => {
          throw new Error('not cached');
        }) // sudo -n true fails
        .mockReturnValueOnce(Buffer.from('')); // sudo -v succeeds

      ensureSudo('test-template');

      expect(consoleLogSpy).toHaveBeenCalled();
      expect(execSyncMock).toHaveBeenCalledWith('sudo -v', {
        stdio: 'inherit',
        timeout: 60_000,
      });
    });

    it('calls process.exit when sudo -v fails', () => {
      execSyncMock
        .mockImplementationOnce(() => {
          throw new Error('not cached');
        }) // sudo -n true fails
        .mockImplementationOnce(() => {
          throw new Error('sudo -v failed');
        }); // sudo -v fails

      expect(() => ensureSudo('test-template')).toThrow('process.exit called');
      expect(processExitSpy).toHaveBeenCalledWith(1);
      expect(consoleErrorSpy).toHaveBeenCalled();
    });
  });
});
