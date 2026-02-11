import { afterEach } from "vitest";

afterEach(() => {
  delete process.env.SYNCPOINT_HOME;
  vi.restoreAllMocks();
});
