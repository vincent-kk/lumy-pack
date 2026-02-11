import type { BackupMetadata, FileEntry, SyncpointConfig, TemplateConfig } from "../../utils/types.js";

export function makeConfig(overrides?: Partial<SyncpointConfig>): SyncpointConfig {
  return {
    backup: {
      targets: ["~/.zshrc", "~/.gitconfig"],
      exclude: ["**/*.swp"],
      filename: "{hostname}_{datetime}",
      ...overrides?.backup,
    },
    scripts: {
      includeInBackup: true,
      ...overrides?.scripts,
    },
  } as SyncpointConfig;
}

export function makeFileEntry(overrides?: Partial<FileEntry>): FileEntry {
  return {
    path: "~/.zshrc",
    absolutePath: "/home/user/.zshrc",
    size: 1024,
    hash: "sha256:abc123def456",
    type: "file",
    ...overrides,
  } as FileEntry;
}

export function makeMetadata(overrides?: Partial<BackupMetadata>): BackupMetadata {
  return {
    version: "1.0.0",
    toolVersion: "0.0.1",
    createdAt: new Date().toISOString(),
    hostname: "test-host",
    system: { platform: "darwin", release: "24.0.0", arch: "arm64" },
    config: { filename: "{hostname}_{datetime}" },
    files: [makeFileEntry()],
    summary: { fileCount: 1, totalSize: 1024 },
    ...overrides,
  } as BackupMetadata;
}

export function makeTemplate(overrides?: Partial<TemplateConfig>): TemplateConfig {
  return {
    name: "test-template",
    description: "A test template",
    steps: [{ name: "step1", command: "echo hello" }],
    ...overrides,
  } as TemplateConfig;
}
