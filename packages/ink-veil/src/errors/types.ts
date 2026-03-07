export enum ErrorCode {
  SUCCESS = 0,
  GENERAL_ERROR = 1,
  INVALID_ARGUMENTS = 2,
  FILE_NOT_FOUND = 3,
  UNSUPPORTED_FORMAT = 4,
  DICTIONARY_ERROR = 5,
  NER_MODEL_FAILED = 6,
  VERIFICATION_FAILED = 7,
  TOKEN_INTEGRITY_BELOW_THRESHOLD = 8,
}

export class InkVeilError extends Error {
  readonly code: ErrorCode;
  readonly context?: Record<string, unknown>;

  constructor(code: ErrorCode, message: string, context?: Record<string, unknown>) {
    super(message);
    this.name = 'InkVeilError';
    this.code = code;
    this.context = context;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class FileNotFoundError extends InkVeilError {
  constructor(path: string) {
    super(ErrorCode.FILE_NOT_FOUND, `File not found: ${path}`, { path });
    this.name = 'FileNotFoundError';
  }
}

export class UnsupportedFormatError extends InkVeilError {
  constructor(format: string) {
    super(ErrorCode.UNSUPPORTED_FORMAT, `Unsupported format: ${format}`, { format });
    this.name = 'UnsupportedFormatError';
  }
}

export class DictionaryError extends InkVeilError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(ErrorCode.DICTIONARY_ERROR, message, context);
    this.name = 'DictionaryError';
  }
}

export class NERModelError extends InkVeilError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(ErrorCode.NER_MODEL_FAILED, message, context);
    this.name = 'NERModelError';
  }
}

export class VerificationError extends InkVeilError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(ErrorCode.VERIFICATION_FAILED, message, context);
    this.name = 'VerificationError';
  }
}
