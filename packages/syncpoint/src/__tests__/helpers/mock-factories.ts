import { vi } from "vitest";

export function mockExecSync(impl?: (...args: unknown[]) => unknown) {
  return vi.fn(impl ?? (() => Buffer.from("")));
}

export function mockLogger() {
  return {
    info: vi.fn(),
    success: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };
}
