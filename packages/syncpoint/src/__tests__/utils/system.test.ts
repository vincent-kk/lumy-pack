import { describe, expect, it, vi } from 'vitest';

import {
  formatHostname,
  getHostname,
  getSystemInfo,
} from '../../utils/system.js';

// Mock node:os module
vi.mock('node:os', () => ({
  hostname: vi.fn(() => 'test-machine.local'),
  platform: vi.fn(() => 'linux'),
  release: vi.fn(() => '5.10.0-1234'),
  arch: vi.fn(() => 'x64'),
}));

describe('getHostname', () => {
  it('returns hostname from os.hostname', () => {
    const result = getHostname();
    expect(result).toBe('test-machine.local');
  });

  it('returns a string', () => {
    const result = getHostname();
    expect(typeof result).toBe('string');
  });
});

describe('getSystemInfo', () => {
  it('returns system information object', () => {
    const result = getSystemInfo();
    expect(result).toEqual({
      platform: 'linux',
      release: '5.10.0-1234',
      arch: 'x64',
    });
  });

  it('returns object with required properties', () => {
    const result = getSystemInfo();
    expect(result).toHaveProperty('platform');
    expect(result).toHaveProperty('release');
    expect(result).toHaveProperty('arch');
  });
});

describe('formatHostname', () => {
  it('replaces dots with dashes', () => {
    expect(formatHostname('server.example.com')).toBe('server-example-com');
  });

  it('replaces spaces with dashes', () => {
    expect(formatHostname('my server name')).toBe('my-server-name');
  });

  it('removes special characters', () => {
    expect(formatHostname('host@#$%name')).toBe('hostname');
  });

  it('collapses multiple dashes into one', () => {
    expect(formatHostname('host---name')).toBe('host-name');
  });

  it('trims leading dashes', () => {
    expect(formatHostname('---hostname')).toBe('hostname');
  });

  it('trims trailing dashes', () => {
    expect(formatHostname('hostname---')).toBe('hostname');
  });

  it('uses provided name when given', () => {
    expect(formatHostname('custom.host')).toBe('custom-host');
  });

  it('falls back to getHostname when name is not provided', () => {
    expect(formatHostname()).toBe('test-machine-local');
  });

  it('handles empty string by returning empty after sanitization', () => {
    // Empty string gets sanitized to empty string (no fallback happens)
    expect(formatHostname('')).toBe('');
  });

  it('handles complex sanitization scenarios', () => {
    expect(formatHostname('  my..host@@name..  ')).toBe('my-hostname');
  });

  it('preserves alphanumeric characters and dashes', () => {
    expect(formatHostname('host123-name456')).toBe('host123-name456');
  });

  it('handles mixed case', () => {
    expect(formatHostname('MyHost.Name')).toBe('MyHost-Name');
  });
});
