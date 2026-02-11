import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  formatBytes,
  formatDate,
  formatDatetime,
  formatRelativeTime,
  generateFilename,
} from "../../utils/format.js";

// Mock the system module
vi.mock("../../utils/system.js", () => ({
  formatHostname: vi.fn((name?: string) => name || "test-host"),
}));

describe("formatBytes", () => {
  it("returns '0 B' for zero bytes", () => {
    expect(formatBytes(0)).toBe("0 B");
  });

  it("returns bytes with 'B' for values less than 1024", () => {
    expect(formatBytes(1)).toBe("1 B");
    expect(formatBytes(500)).toBe("500 B");
    expect(formatBytes(1023)).toBe("1023 B");
  });

  it("returns KB for values >= 1024", () => {
    expect(formatBytes(1024)).toBe("1.0 KB");
    expect(formatBytes(2048)).toBe("2.0 KB");
    expect(formatBytes(1536)).toBe("1.5 KB");
  });

  it("returns MB for larger values", () => {
    expect(formatBytes(1024 * 1024)).toBe("1.0 MB");
    expect(formatBytes(1024 * 1024 * 2.5)).toBe("2.5 MB");
  });

  it("returns GB for even larger values", () => {
    expect(formatBytes(1024 * 1024 * 1024)).toBe("1.0 GB");
    expect(formatBytes(1024 * 1024 * 1024 * 3.2)).toBe("3.2 GB");
  });

  it("returns TB for very large values", () => {
    expect(formatBytes(1024 * 1024 * 1024 * 1024)).toBe("1.0 TB");
    expect(formatBytes(1024 * 1024 * 1024 * 1024 * 1.5)).toBe("1.5 TB");
  });
});

describe("formatDate", () => {
  it("formats date as 'YYYY-MM-DD HH:mm'", () => {
    const date = new Date("2024-03-15T14:30:45");
    expect(formatDate(date)).toBe("2024-03-15 14:30");
  });

  it("pads single-digit months and days", () => {
    const date = new Date("2024-01-05T08:09:00");
    expect(formatDate(date)).toBe("2024-01-05 08:09");
  });

  it("handles midnight correctly", () => {
    const date = new Date("2024-12-31T00:00:00");
    expect(formatDate(date)).toBe("2024-12-31 00:00");
  });
});

describe("formatDatetime", () => {
  it("formats datetime as 'YYYY-MM-DD_HHmmss'", () => {
    const date = new Date("2024-03-15T14:30:45");
    expect(formatDatetime(date)).toBe("2024-03-15_143045");
  });

  it("pads single-digit values", () => {
    const date = new Date("2024-01-05T08:09:03");
    expect(formatDatetime(date)).toBe("2024-01-05_080903");
  });

  it("handles midnight and end of year", () => {
    const date = new Date("2024-12-31T00:00:00");
    expect(formatDatetime(date)).toBe("2024-12-31_000000");
  });
});

describe("formatRelativeTime", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-01-01T12:00:00"));
  });

  it("returns seconds for times less than 60 seconds ago", () => {
    const date = new Date("2024-01-01T11:59:30");
    expect(formatRelativeTime(date)).toBe("30s ago");
  });

  it("returns minutes for times less than 60 minutes ago", () => {
    const date = new Date("2024-01-01T11:45:00");
    expect(formatRelativeTime(date)).toBe("15m ago");
  });

  it("returns hours for times less than 24 hours ago", () => {
    const date = new Date("2024-01-01T09:00:00");
    expect(formatRelativeTime(date)).toBe("3h ago");
  });

  it("returns days for times 24 hours or more ago", () => {
    const date = new Date("2023-12-30T12:00:00");
    expect(formatRelativeTime(date)).toBe("2d ago");
  });

  it("handles 0 seconds correctly", () => {
    const date = new Date("2024-01-01T12:00:00");
    expect(formatRelativeTime(date)).toBe("0s ago");
  });
});

describe("generateFilename", () => {
  const testDate = new Date("2024-03-15T14:30:45");

  it("replaces {hostname} placeholder", () => {
    const result = generateFilename("backup-{hostname}.tar.gz", {
      date: testDate,
      hostname: "my-host",
    });
    expect(result).toBe("backup-my-host.tar.gz");
  });

  it("replaces {date} placeholder", () => {
    const result = generateFilename("backup-{date}.tar.gz", { date: testDate });
    expect(result).toBe("backup-2024-03-15.tar.gz");
  });

  it("replaces {time} placeholder", () => {
    const result = generateFilename("backup-{time}.tar.gz", { date: testDate });
    expect(result).toBe("backup-143045.tar.gz");
  });

  it("replaces {datetime} placeholder", () => {
    const result = generateFilename("backup-{datetime}.tar.gz", { date: testDate });
    expect(result).toBe("backup-2024-03-15_143045.tar.gz");
  });

  it("replaces {tag} placeholder when tag is provided", () => {
    const result = generateFilename("backup-{tag}.tar.gz", {
      date: testDate,
      tag: "v1.0",
    });
    expect(result).toBe("backup-v1.0.tar.gz");
  });

  it("appends tag when pattern does not include {tag} placeholder", () => {
    const result = generateFilename("backup-{date}.tar.gz", {
      date: testDate,
      tag: "v1.0",
    });
    expect(result).toBe("backup-2024-03-15.tar.gz_v1.0");
  });

  it("removes {tag} placeholder when no tag is provided", () => {
    const result = generateFilename("backup-{date}-{tag}.tar.gz", { date: testDate });
    expect(result).toBe("backup-2024-03-15-.tar.gz");
  });

  it("handles multiple placeholders", () => {
    const result = generateFilename("backup-{hostname}-{datetime}.tar.gz", {
      date: testDate,
      hostname: "server1",
    });
    expect(result).toBe("backup-server1-2024-03-15_143045.tar.gz");
  });

  it("uses current date when date option is not provided", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-01-01T00:00:00"));

    const result = generateFilename("backup-{date}.tar.gz");
    expect(result).toBe("backup-2024-01-01.tar.gz");

    vi.useRealTimers();
  });

  it("uses formatHostname when custom hostname is provided", () => {
    const result = generateFilename("backup-{hostname}.tar.gz", {
      date: testDate,
      hostname: "custom-host",
    });
    expect(result).toBe("backup-custom-host.tar.gz");
  });
});
