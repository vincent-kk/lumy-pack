import { lstat } from 'node:fs/promises';

import { respond, respondError } from '@lumy-pack/shared';
import { Command } from 'commander';
import { Box, Text, useApp } from 'ink';
import { render } from 'ink';
import React, { useEffect, useState } from 'react';

import { Confirm } from '../components/Confirm.js';
import { loadConfig } from '../core/config.js';
import { linkSyncpoint, linkSyncpointByRef } from '../core/link.js';
import { classifyError } from '../errors.js';
import { SyncpointErrorCode } from '../errors.js';
import { getAppDir } from '../constants.js';
import { COMMANDS } from '../utils/command-registry.js';
import { contractTilde } from '../utils/paths.js';
import type { LinkResult } from '../utils/types.js';
import { VERSION } from '../version.js';

type Phase = 'checking' | 'confirming' | 'linking' | 'done' | 'error';

interface LinkViewProps {
  refPath?: string;
  yes: boolean;
}

export const LinkView: React.FC<LinkViewProps> = ({ refPath, yes }) => {
  const { exit } = useApp();
  const [phase, setPhase] = useState<Phase>('checking');
  const [result, setResult] = useState<LinkResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [existingType, setExistingType] = useState<string>('directory');

  // Phase 1: check if ~/.syncpoint exists
  useEffect(() => {
    (async () => {
      try {
        if (!refPath) {
          // No --ref: use existing logic directly
          setPhase('linking');
          return;
        }

        const appDir = getAppDir();
        try {
          const stats = await lstat(appDir);
          setExistingType(stats.isSymbolicLink() ? 'symlink' : 'directory');
          if (yes) {
            setPhase('linking');
          } else {
            setPhase('confirming');
          }
        } catch {
          // appDir doesn't exist — proceed directly
          setPhase('linking');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
        setPhase('error');
        setTimeout(() => exit(), 100);
      }
    })();
  }, []);

  // Phase 2: perform link
  useEffect(() => {
    if (phase !== 'linking') return;

    (async () => {
      try {
        let linkResult: LinkResult;
        if (refPath) {
          linkResult = await linkSyncpointByRef(refPath);
        } else {
          const config = await loadConfig();
          const destination = config.backup.destination;
          if (!destination) {
            throw new Error(
              'backup.destination is not set in config.yml. Set it before running "syncpoint link".',
            );
          }
          linkResult = await linkSyncpoint(destination);
        }
        setResult(linkResult);
        setPhase('done');
        setTimeout(() => exit(), 100);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
        setPhase('error');
        setTimeout(() => exit(), 100);
      }
    })();
  }, [phase]);

  if (phase === 'error' || error) {
    return (
      <Box flexDirection="column">
        <Text color="red">✗ Link failed: {error}</Text>
      </Box>
    );
  }

  if (phase === 'confirming') {
    return (
      <Box flexDirection="column">
        <Text color="yellow">
          ⚠ ~/.syncpoint already exists as a {existingType}.
        </Text>
        <Confirm
          message="Overwrite with symlink?"
          defaultYes={false}
          onConfirm={(confirmed) => {
            if (confirmed) {
              setPhase('linking');
            } else {
              setError('Aborted.');
              setPhase('error');
              setTimeout(() => exit(), 100);
            }
          }}
        />
      </Box>
    );
  }

  if (phase === 'checking' || phase === 'linking') {
    return (
      <Box>
        <Text>▸ Linking ~/.syncpoint to destination...</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column">
      <Text color="green" bold>
        ✓ Link complete
      </Text>
      {result && (
        <>
          <Text>
            {'  '}From: {contractTilde(result.appDir)}
          </Text>
          <Text>
            {'  '}To:   {contractTilde(result.targetDir)}
          </Text>
          {result.wasAlreadyLinked && (
            <Text color="yellow">{'  '}(previous link was removed and re-linked)</Text>
          )}
        </>
      )}
    </Box>
  );
};

export function registerLinkCommand(program: Command): void {
  const cmdInfo = COMMANDS.link;
  const cmd = program.command('link').description(cmdInfo.description);

  cmd.option(
    '-r, --ref <path>',
    'Adopt <path>/.syncpoint as ~/.syncpoint via symlink',
  );

  cmd.action(async (opts: { ref?: string }) => {
    const globalOpts = program.opts();
    const startTime = Date.now();

    if (globalOpts.json) {
      try {
        if (opts.ref) {
          const appDir = getAppDir();
          let appDirExists = false;
          try {
            await lstat(appDir);
            appDirExists = true;
          } catch {
            // doesn't exist
          }

          if (appDirExists && !globalOpts.yes) {
            respondError(
              'link',
              SyncpointErrorCode.LINK_FAILED,
              '~/.syncpoint already exists. Use --yes to overwrite.',
              startTime,
              VERSION,
            );
            return;
          }

          const linkResult = await linkSyncpointByRef(opts.ref);
          respond(
            'link',
            {
              appDir: linkResult.appDir,
              targetDir: linkResult.targetDir,
              wasAlreadyLinked: linkResult.wasAlreadyLinked,
            },
            startTime,
            VERSION,
          );
        } else {
          const config = await loadConfig();
          const destination = config.backup.destination;
          if (!destination) {
            throw new Error('backup.destination is not set in config.yml.');
          }
          const linkResult = await linkSyncpoint(destination);
          respond(
            'link',
            {
              appDir: linkResult.appDir,
              targetDir: linkResult.targetDir,
              wasAlreadyLinked: linkResult.wasAlreadyLinked,
            },
            startTime,
            VERSION,
          );
        }
      } catch (error) {
        const code = classifyError(error);
        respondError('link', code, (error as Error).message, startTime, VERSION);
      }
      return;
    }

    const { waitUntilExit } = render(
      <LinkView refPath={opts.ref} yes={globalOpts.yes ?? false} />,
    );
    await waitUntilExit();
  });
}
