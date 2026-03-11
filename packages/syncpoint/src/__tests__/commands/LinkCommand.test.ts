import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockInkRender = vi.hoisted(() => vi.fn());

vi.mock('ink', async () => {
  const actual = await vi.importActual<typeof import('ink')>('ink');
  return {
    ...actual,
    render: mockInkRender,
  };
});

describe('registerLinkCommand', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInkRender.mockReturnValue({
      waitUntilExit: vi.fn().mockResolvedValue(undefined),
    });
  });

  it('registers the --ref option', async () => {
    const { registerLinkCommand } = await import('../../commands/Link.js');
    const { Command } = await import('commander');

    const program = new Command();
    registerLinkCommand(program);

    const linkCommand = program.commands.find((cmd) => cmd.name() === 'link');
    const refOption = linkCommand?.options.find((opt) => opt.long === '--ref');

    expect(linkCommand).toBeDefined();
    expect(refOption).toBeDefined();
  });

  it('passes the reference path via refPath prop instead of React ref', async () => {
    const { registerLinkCommand } = await import('../../commands/Link.js');
    const { Command } = await import('commander');

    const program = new Command();
    program.option('--yes');
    registerLinkCommand(program);

    await program.parseAsync([
      'node',
      'syncpoint',
      'link',
      '-r',
      '/tmp/reference',
    ]);

    expect(mockInkRender).toHaveBeenCalledTimes(1);

    const renderedElement = mockInkRender.mock.calls[0][0];
    expect(renderedElement.props.refPath).toBe('/tmp/reference');
    expect(renderedElement.props.yes).toBe(false);
    expect(renderedElement.props.ref).toBeUndefined();
  });
});
