import { respond, respondError } from '@lumy-pack/shared';
import { Command } from 'commander';
import { Box, Text, useApp } from 'ink';
import { render } from 'ink';
import React, { useEffect, useState } from 'react';

import { unlinkSyncpoint } from '../core/link.js';
import { classifyError } from '../errors.js';
import { COMMANDS } from '../utils/command-registry.js';
import { contractTilde } from '../utils/paths.js';
import type { UnlinkResult } from '../utils/types.js';
import { VERSION } from '../version.js';

type Phase = 'unlinking' | 'done' | 'error';

interface UnlinkViewProps {
  clean: boolean;
}

const UnlinkView: React.FC<UnlinkViewProps> = ({ clean }) => {
  const { exit } = useApp();
  const [phase, setPhase] = useState<Phase>('unlinking');
  const [result, setResult] = useState<UnlinkResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const unlinkResult = await unlinkSyncpoint({ clean });
        setResult(unlinkResult);
        setPhase('done');
        setTimeout(() => exit(), 100);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
        setPhase('error');
        setTimeout(() => exit(), 100);
      }
    })();
  }, []);

  if (phase === 'error' || error) {
    return (
      <Box flexDirection="column">
        <Text color="red">✗ Unlink failed: {error}</Text>
      </Box>
    );
  }

  if (phase === 'unlinking') {
    return (
      <Box>
        <Text>▸ Restoring ~/.syncpoint from destination...</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column">
      <Text color="green" bold>
        ✓ Unlink complete
      </Text>
      {result && (
        <>
          <Text>
            {'  '}Restored: {contractTilde(result.appDir)}
          </Text>
          <Text>
            {'  '}Source:   {contractTilde(result.targetDir)}
          </Text>
          {result.cleaned && (
            <Text color="yellow">{'  '}Destination copy removed (--clean)</Text>
          )}
        </>
      )}
    </Box>
  );
};

export function registerUnlinkCommand(program: Command): void {
  const cmdInfo = COMMANDS.unlink;
  const cmd = program.command('unlink').description(cmdInfo.description);

  cmdInfo.options?.forEach((opt) => {
    cmd.option(opt.flag, opt.description);
  });

  cmd.action(async (opts: { clean?: boolean }) => {
    const globalOpts = program.opts();
    const startTime = Date.now();

    if (globalOpts.json) {
      try {
        const unlinkResult = await unlinkSyncpoint({ clean: opts.clean });
        respond(
          'unlink',
          {
            appDir: unlinkResult.appDir,
            targetDir: unlinkResult.targetDir,
            cleaned: unlinkResult.cleaned,
          },
          startTime,
          VERSION,
        );
      } catch (error) {
        const code = classifyError(error);
        respondError('unlink', code, (error as Error).message, startTime, VERSION);
      }
      return;
    }

    const { waitUntilExit } = render(<UnlinkView clean={opts.clean ?? false} />);
    await waitUntilExit();
  });
}
