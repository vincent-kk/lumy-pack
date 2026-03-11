import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from 'ink-testing-library';

import { LinkView } from '../../commands/Link.js';
import { waitForText } from '../helpers/ink-test-helpers.js';

const mockLstat = vi.hoisted(() => vi.fn());
const mockLinkSyncpoint = vi.hoisted(() => vi.fn());
const mockLinkSyncpointByRef = vi.hoisted(() => vi.fn());
const mockLoadConfig = vi.hoisted(() => vi.fn());
const mockGetAppDir = vi.hoisted(() => vi.fn(() => '/home/user/.syncpoint'));

vi.mock('node:fs/promises', () => ({
  lstat: mockLstat,
}));

vi.mock('../../core/link.js', () => ({
  linkSyncpoint: mockLinkSyncpoint,
  linkSyncpointByRef: mockLinkSyncpointByRef,
}));

vi.mock('../../core/config.js', () => ({
  loadConfig: mockLoadConfig,
}));

vi.mock('../../constants.js', async () => {
  const actual =
    await vi.importActual<typeof import('../../constants.js')>(
      '../../constants.js',
    );
  return {
    ...actual,
    getAppDir: mockGetAppDir,
  };
});

describe('LinkView', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockLoadConfig.mockResolvedValue({
      backup: { destination: '/backup' },
    });
    mockLinkSyncpoint.mockResolvedValue({
      appDir: '/home/user/.syncpoint',
      targetDir: '/backup/.syncpoint',
      wasAlreadyLinked: false,
    });
    mockLinkSyncpointByRef.mockResolvedValue({
      appDir: '/home/user/.syncpoint',
      targetDir: '/tmp/reference',
      wasAlreadyLinked: false,
    });
  });

  it('shows overwrite confirmation when refPath is provided and app dir exists', async () => {
    mockLstat.mockResolvedValue({
      isSymbolicLink: () => false,
    });

    const instance = render(<LinkView refPath="/tmp/reference" yes={false} />);

    await waitForText(instance, 'Overwrite with symlink?');

    const frame = instance.lastFrame() || '';
    expect(frame).toContain('already exists as a directory');
    expect(mockLinkSyncpointByRef).not.toHaveBeenCalled();
  });

  it('links immediately with refPath when yes=true', async () => {
    mockLstat.mockResolvedValue({
      isSymbolicLink: () => true,
    });

    const instance = render(<LinkView refPath="/tmp/reference" yes={true} />);

    await waitForText(instance, 'Link complete');

    expect(mockLinkSyncpointByRef).toHaveBeenCalledWith('/tmp/reference');
    expect(instance.lastFrame()).toContain('/tmp/reference');
  });
});
