import { describe, it, expect } from 'vitest';
import {
  ErrorCode,
  InkVeilError,
  FileNotFoundError,
  UnsupportedFormatError,
  DictionaryError,
  NERModelError,
  VerificationError,
} from '../../errors/types.js';

describe('ErrorCode enum', () => {
  it('SUCCESS === 0', () => expect(ErrorCode.SUCCESS).toBe(0));
  it('GENERAL_ERROR === 1', () => expect(ErrorCode.GENERAL_ERROR).toBe(1));
  it('INVALID_ARGUMENTS === 2', () => expect(ErrorCode.INVALID_ARGUMENTS).toBe(2));
  it('FILE_NOT_FOUND === 3', () => expect(ErrorCode.FILE_NOT_FOUND).toBe(3));
  it('UNSUPPORTED_FORMAT === 4', () => expect(ErrorCode.UNSUPPORTED_FORMAT).toBe(4));
  it('DICTIONARY_ERROR === 5', () => expect(ErrorCode.DICTIONARY_ERROR).toBe(5));
  it('NER_MODEL_FAILED === 6', () => expect(ErrorCode.NER_MODEL_FAILED).toBe(6));
  it('VERIFICATION_FAILED === 7', () => expect(ErrorCode.VERIFICATION_FAILED).toBe(7));
  it('TOKEN_INTEGRITY_BELOW_THRESHOLD === 8', () => expect(ErrorCode.TOKEN_INTEGRITY_BELOW_THRESHOLD).toBe(8));
});

describe('InkVeilError base class', () => {
  it('is instance of Error', () => {
    const e = new InkVeilError(ErrorCode.GENERAL_ERROR, 'test');
    expect(e).toBeInstanceOf(Error);
  });

  it('is instance of InkVeilError', () => {
    const e = new InkVeilError(ErrorCode.GENERAL_ERROR, 'test');
    expect(e).toBeInstanceOf(InkVeilError);
  });

  it('carries correct code', () => {
    const e = new InkVeilError(ErrorCode.GENERAL_ERROR, 'test');
    expect(e.code).toBe(ErrorCode.GENERAL_ERROR);
  });

  it('carries message', () => {
    const e = new InkVeilError(ErrorCode.GENERAL_ERROR, 'my message');
    expect(e.message).toBe('my message');
  });

  it('context passes through correctly', () => {
    const ctx = { key: 'value', num: 42 };
    const e = new InkVeilError(ErrorCode.GENERAL_ERROR, 'test', ctx);
    expect(e.context).toEqual(ctx);
  });

  it('context is undefined when not provided', () => {
    const e = new InkVeilError(ErrorCode.GENERAL_ERROR, 'test');
    expect(e.context).toBeUndefined();
  });
});

describe('FileNotFoundError', () => {
  it('has correct code', () => {
    const e = new FileNotFoundError('/path/to/file.txt');
    expect(e.code).toBe(ErrorCode.FILE_NOT_FOUND);
  });

  it('is instance of InkVeilError', () => {
    const e = new FileNotFoundError('/path/to/file.txt');
    expect(e).toBeInstanceOf(InkVeilError);
  });

  it('includes path in message', () => {
    const e = new FileNotFoundError('/path/to/file.txt');
    expect(e.message).toContain('/path/to/file.txt');
  });

  it('context.path matches provided path', () => {
    const e = new FileNotFoundError('/path/to/file.txt');
    expect(e.context?.path).toBe('/path/to/file.txt');
  });

  it('name is FileNotFoundError', () => {
    const e = new FileNotFoundError('/path/to/file.txt');
    expect(e.name).toBe('FileNotFoundError');
  });
});

describe('UnsupportedFormatError', () => {
  it('has correct code', () => {
    const e = new UnsupportedFormatError('.xyz');
    expect(e.code).toBe(ErrorCode.UNSUPPORTED_FORMAT);
  });

  it('is instance of InkVeilError', () => {
    const e = new UnsupportedFormatError('.xyz');
    expect(e).toBeInstanceOf(InkVeilError);
  });

  it('context.format matches provided format', () => {
    const e = new UnsupportedFormatError('.xyz');
    expect(e.context?.format).toBe('.xyz');
  });
});

describe('DictionaryError', () => {
  it('has correct code', () => {
    const e = new DictionaryError('corrupt dictionary');
    expect(e.code).toBe(ErrorCode.DICTIONARY_ERROR);
  });

  it('is instance of InkVeilError', () => {
    const e = new DictionaryError('corrupt dictionary');
    expect(e).toBeInstanceOf(InkVeilError);
  });

  it('context passes through', () => {
    const ctx = { file: 'dict.json', version: '1.0' };
    const e = new DictionaryError('version mismatch', ctx);
    expect(e.context).toEqual(ctx);
  });
});

describe('NERModelError', () => {
  it('has correct code', () => {
    const e = new NERModelError('model load failed');
    expect(e.code).toBe(ErrorCode.NER_MODEL_FAILED);
  });

  it('is instance of InkVeilError', () => {
    const e = new NERModelError('model load failed');
    expect(e).toBeInstanceOf(InkVeilError);
  });

  it('context passes through', () => {
    const ctx = { model: 'kiwi-base', checksum: 'mismatch' };
    const e = new NERModelError('checksum failed', ctx);
    expect(e.context).toEqual(ctx);
  });
});

describe('VerificationError', () => {
  it('has correct code', () => {
    const e = new VerificationError('sha256 mismatch');
    expect(e.code).toBe(ErrorCode.VERIFICATION_FAILED);
  });

  it('is instance of InkVeilError', () => {
    const e = new VerificationError('sha256 mismatch');
    expect(e).toBeInstanceOf(InkVeilError);
  });

  it('context passes through', () => {
    const ctx = { expected: 'abc', actual: 'def' };
    const e = new VerificationError('hash mismatch', ctx);
    expect(e.context).toEqual(ctx);
  });
});
