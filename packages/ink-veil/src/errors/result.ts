import type { InkVeilError } from "./types.js";

export type Result<T, E = InkVeilError> =
  | { ok: true; value: T }
  | { ok: false; error: E };

export function ok<T>(value: T): Result<T, never> {
  return { ok: true, value };
}

export function err<E>(error: E): Result<never, E> {
  return { ok: false, error };
}

export interface BatchResult<T> {
  results: Result<T>[];
  succeeded: number;
  failed: number;
}
