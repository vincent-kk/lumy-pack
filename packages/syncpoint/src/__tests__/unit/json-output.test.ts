import { describe, expect, it } from 'vitest';

import { SyncpointErrorCode, classifyError } from '../../errors.js';
import { COMMANDS } from '../../utils/command-registry.js';

describe('SyncpointErrorCode', () => {
  it('has all expected keys', () => {
    expect(SyncpointErrorCode.CONFIG_NOT_FOUND).toBe('CONFIG_NOT_FOUND');
    expect(SyncpointErrorCode.CONFIG_INVALID).toBe('CONFIG_INVALID');
    expect(SyncpointErrorCode.BACKUP_FAILED).toBe('BACKUP_FAILED');
    expect(SyncpointErrorCode.RESTORE_FAILED).toBe('RESTORE_FAILED');
    expect(SyncpointErrorCode.TEMPLATE_NOT_FOUND).toBe('TEMPLATE_NOT_FOUND');
    expect(SyncpointErrorCode.PROVISION_FAILED).toBe('PROVISION_FAILED');
    expect(SyncpointErrorCode.MISSING_ARGUMENT).toBe('MISSING_ARGUMENT');
    expect(SyncpointErrorCode.INVALID_ARGUMENT).toBe('INVALID_ARGUMENT');
    expect(SyncpointErrorCode.UNKNOWN).toBe('UNKNOWN');
  });

  it('values are unique', () => {
    const values = Object.values(SyncpointErrorCode);
    expect(new Set(values).size).toBe(values.length);
  });
});

describe('classifyError', () => {
  it('classifies config not found errors', () => {
    const err = new Error('Config file not found: ~/.syncpoint/config.yml\nRun "syncpoint init" first.');
    expect(classifyError(err)).toBe(SyncpointErrorCode.CONFIG_NOT_FOUND);
  });

  it('classifies config invalid errors', () => {
    const err = new Error('Invalid config:\nfield is required');
    expect(classifyError(err)).toBe(SyncpointErrorCode.CONFIG_INVALID);
  });

  it('classifies template not found errors', () => {
    const err = new Error('Template not found: dev-setup');
    expect(classifyError(err)).toBe(SyncpointErrorCode.TEMPLATE_NOT_FOUND);
  });

  it('classifies template file not found errors', () => {
    const err = new Error('Template file not found: ./my-template.yml');
    expect(classifyError(err)).toBe(SyncpointErrorCode.TEMPLATE_NOT_FOUND);
  });

  it('classifies unknown errors as UNKNOWN', () => {
    const err = new Error('Some unexpected error');
    expect(classifyError(err)).toBe(SyncpointErrorCode.UNKNOWN);
  });

  it('handles non-Error objects', () => {
    expect(classifyError('some string error')).toBe(SyncpointErrorCode.UNKNOWN);
    expect(classifyError(42)).toBe(SyncpointErrorCode.UNKNOWN);
  });
});

describe('COMMANDS registry type field completeness', () => {
  it('all options with value arguments have type string or number', () => {
    for (const [cmdName, cmdInfo] of Object.entries(COMMANDS)) {
      if (!cmdInfo.options) continue;
      for (const opt of cmdInfo.options) {
        // Options with <value> in flag should have type defined
        if (opt.flag.includes('<')) {
          expect(
            opt.type,
            `${cmdName} option "${opt.flag}" should have a type`,
          ).toBeDefined();
          expect(['string', 'number']).toContain(opt.type);
        }
      }
    }
  });

  it('boolean options have type boolean when specified', () => {
    for (const [cmdName, cmdInfo] of Object.entries(COMMANDS)) {
      if (!cmdInfo.options) continue;
      for (const opt of cmdInfo.options) {
        if (opt.type !== undefined) {
          expect(
            ['boolean', 'string', 'number'],
            `${cmdName} option "${opt.flag}" has invalid type`,
          ).toContain(opt.type);
        }
      }
    }
  });

  it('all commands exist in registry', () => {
    const expectedCommands = [
      'init', 'wizard', 'backup', 'restore', 'provision',
      'create-template', 'list', 'status', 'migrate', 'help',
    ];
    for (const cmd of expectedCommands) {
      expect(COMMANDS[cmd], `Command "${cmd}" missing from registry`).toBeDefined();
    }
  });
});
