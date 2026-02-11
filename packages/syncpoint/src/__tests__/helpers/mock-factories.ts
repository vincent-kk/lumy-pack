import { vi } from "vitest";

export function mockExecSync(impl?: (...args: unknown[]) => unknown) {
  return vi.fn(impl ?? (() => Buffer.from("")));
}

export function mockChildProcessExec(results?: { stdout: string; stderr: string }) {
  return vi.fn(
    (_cmd: string, _opts: unknown, cb: (err: Error | null, stdout: string, stderr: string) => void) => {
      cb(null, results?.stdout ?? "", results?.stderr ?? "");
    },
  );
}

export function mockLogger() {
  return {
    info: vi.fn(),
    success: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };
}
