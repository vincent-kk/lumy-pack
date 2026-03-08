/**
 * Universal CLI JSON response envelope.
 * Used by all lumy-pack CLI tools for structured, machine-readable output.
 */
export interface CliResponse<T = unknown> {
  ok: boolean;
  command: string;
  data?: T;
  error?: CliError;
  meta: CliMeta;
}

export interface CliError {
  code: string;
  message: string;
  details?: unknown;
}

export interface CliMeta {
  version: string;
  durationMs: number;
  timestamp: string;
}
