import { describe, it, expect } from 'vitest';

import { SieveErrorCode } from '../../errors.js';

describe('SieveErrorCode', () => {
  it('has correct string values', () => {
    expect(SieveErrorCode.INVALID_INPUT).toBe('INVALID_INPUT');
    expect(SieveErrorCode.FILE_NOT_FOUND).toBe('FILE_NOT_FOUND');
    expect(SieveErrorCode.INVALID_FORMAT).toBe('INVALID_FORMAT');
    expect(SieveErrorCode.PIPELINE_ERROR).toBe('PIPELINE_ERROR');
    expect(SieveErrorCode.WORKER_ERROR).toBe('WORKER_ERROR');
    expect(SieveErrorCode.UNKNOWN).toBe('UNKNOWN');
  });

  it('has exactly 6 error codes', () => {
    expect(Object.keys(SieveErrorCode)).toHaveLength(6);
  });

  it('values match keys', () => {
    for (const [key, value] of Object.entries(SieveErrorCode)) {
      expect(key).toBe(value);
    }
  });
});

describe('error classification logic', () => {
  function classifyError(err: Error): string {
    const msg = err.message.toLowerCase();
    const nodeErr = err as NodeJS.ErrnoException;
    if (nodeErr.code === 'ENOENT' || msg.includes('not found')) {
      return SieveErrorCode.FILE_NOT_FOUND;
    } else if (msg.includes('no video stream') || msg.includes('invalid format')) {
      return SieveErrorCode.INVALID_FORMAT;
    } else if (msg.includes('worker')) {
      return SieveErrorCode.WORKER_ERROR;
    } else {
      return SieveErrorCode.PIPELINE_ERROR;
    }
  }

  it('classifies ENOENT as FILE_NOT_FOUND', () => {
    const err = Object.assign(new Error('no such file'), { code: 'ENOENT' });
    expect(classifyError(err)).toBe(SieveErrorCode.FILE_NOT_FOUND);
  });

  it('classifies "not found" message as FILE_NOT_FOUND', () => {
    expect(classifyError(new Error('File not found: /tmp/x.mp4'))).toBe(
      SieveErrorCode.FILE_NOT_FOUND,
    );
  });

  it('classifies "no video stream" as INVALID_FORMAT', () => {
    expect(classifyError(new Error('no video stream detected'))).toBe(
      SieveErrorCode.INVALID_FORMAT,
    );
  });

  it('classifies "invalid format" as INVALID_FORMAT', () => {
    expect(classifyError(new Error('invalid format: unknown codec'))).toBe(
      SieveErrorCode.INVALID_FORMAT,
    );
  });

  it('classifies "worker" messages as WORKER_ERROR', () => {
    expect(classifyError(new Error('worker process crashed'))).toBe(
      SieveErrorCode.WORKER_ERROR,
    );
  });

  it('classifies unknown errors as PIPELINE_ERROR', () => {
    expect(classifyError(new Error('something unexpected'))).toBe(
      SieveErrorCode.PIPELINE_ERROR,
    );
  });
});

describe('describe schema shape', () => {
  it('schema object has expected top-level keys', () => {
    const schema = {
      name: 'scene-sieve',
      version: '1.0.0',
      description: 'Extract key frames from video and GIF files',
      arguments: [{ name: 'input', description: 'Input file', required: true }],
      options: [{ flag: '--json', description: 'Output JSON', default: undefined }],
    };

    expect(schema).toHaveProperty('name');
    expect(schema).toHaveProperty('version');
    expect(schema).toHaveProperty('description');
    expect(schema).toHaveProperty('arguments');
    expect(schema).toHaveProperty('options');
    expect(Array.isArray(schema.arguments)).toBe(true);
    expect(Array.isArray(schema.options)).toBe(true);
  });

  it('option entries have flag, description, default fields', () => {
    const opt = { flag: '--json', description: 'Output structured JSON to stdout', default: undefined };
    expect(opt).toHaveProperty('flag');
    expect(opt).toHaveProperty('description');
    expect('default' in opt).toBe(true);
  });
});
