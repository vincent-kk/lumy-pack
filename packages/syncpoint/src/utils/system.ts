import { arch, hostname as osHostname, platform, release } from 'node:os';

/**
 * Get the machine hostname.
 */
export function getHostname(): string {
  return osHostname();
}

/**
 * Get system information for metadata.
 */
export function getSystemInfo(): {
  platform: string;
  release: string;
  arch: string;
} {
  return {
    platform: platform(),
    release: release(),
    arch: arch(),
  };
}

/**
 * Sanitize hostname for use in filenames.
 * Replace dots and spaces with dashes, remove non-alphanumeric except dashes.
 */
export function formatHostname(name?: string): string {
  const raw = name ?? getHostname();
  return raw
    .replace(/\s+/g, '-')
    .replace(/\./g, '-')
    .replace(/[^a-zA-Z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}
