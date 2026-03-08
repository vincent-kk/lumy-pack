import { existsSync } from 'node:fs';

import { respond, respondError } from '@lumy-pack/shared';
import type { Command } from 'commander';
import { Box, Text, useApp } from 'ink';
import { render } from 'ink';
import React, { useEffect, useState } from 'react';

import { PhaseStep } from '../components/PhaseStep.js';
import type { PhaseState } from '../components/PhaseStep.js';
import {
  DEFAULT_FPS,
  DEFAULT_MAX_FRAMES,
  DEFAULT_QUALITY,
  DEFAULT_SCALE,
} from '../constants.js';
import { runPipeline } from '../core/orchestrator.js';
import { runPipelineInWorker } from '../core/run-in-worker.js';
import { cleanupStaleWorkspaces } from '../core/workspace.js';
import { classifyError, SieveErrorCode } from '../errors.js';
import type { ProgressPhase, SieveResult } from '../types/index.js';
import { SIEVE_COMMAND } from '../utils/command-registry.js';
import { parsePipelineOptions } from '../utils/parse-options.js';
import type { RawCliOptions } from '../utils/parse-options.js';

const PHASE_DEFS: { key: string; label: string; hasProgress: boolean }[] = [
  { key: 'INIT', label: 'Initializing workspace', hasProgress: false },
  { key: 'EXTRACTING', label: 'Extracting frames', hasProgress: false },
  { key: 'ANALYZING', label: 'Analyzing frame similarity', hasProgress: true },
  { key: 'PRUNING', label: 'Pruning similar frames', hasProgress: false },
  { key: 'FINALIZING', label: 'Finalizing output', hasProgress: false },
];

function createInitialPhases(): PhaseState[] {
  return PHASE_DEFS.map((def) => ({
    label: def.label,
    status: 'pending',
    hasProgress: def.hasProgress,
    percent: 0,
  }));
}

function phaseKeyToIndex(phase: ProgressPhase | 'INIT'): number {
  return PHASE_DEFS.findIndex((d) => d.key === phase);
}

export interface SieveViewProps {
  input: string;
  count?: number;
  threshold?: number;
  output?: string;
  fps: number;
  maxFrames: number;
  scale: number;
  quality: number;
  iouThreshold?: number;
  animationThreshold?: number;
  maxSegmentDuration?: number;
  concurrency?: number;
  debug: boolean;
}

export function registerSieveCommand(program: Command, version: string): void {
  const cmd = SIEVE_COMMAND;

  program
    .argument('<input>', cmd.arguments![0].description)
    .option('-n, --count <number>', cmd.options!.find((o) => o.flag.includes('--count'))!.description)
    .option(
      '-t, --threshold <number>',
      cmd.options!.find((o) => o.flag.includes('--threshold'))!.description,
    )
    .option('-o, --output <path>', cmd.options!.find((o) => o.flag.includes('--output'))!.description)
    .option('--fps <number>', cmd.options!.find((o) => o.flag.includes('--fps'))!.description, String(DEFAULT_FPS))
    .option(
      '-mf, --max-frames <number>',
      cmd.options!.find((o) => o.flag.includes('--max-frames'))!.description,
      String(DEFAULT_MAX_FRAMES),
    )
    .option(
      '-s, --scale <number>',
      cmd.options!.find((o) => o.flag.includes('--scale'))!.description,
      String(DEFAULT_SCALE),
    )
    .option(
      '-q, --quality <number>',
      cmd.options!.find((o) => o.flag.includes('--quality'))!.description,
      String(DEFAULT_QUALITY),
    )
    .option(
      '-it, --iou-threshold <number>',
      cmd.options!.find((o) => o.flag.includes('--iou-threshold'))!.description,
    )
    .option(
      '-at, --anim-threshold <number>',
      cmd.options!.find((o) => o.flag.includes('--anim-threshold'))!.description,
    )
    .option(
      '--max-segment-duration <number>',
      cmd.options!.find((o) => o.flag.includes('--max-segment-duration'))!.description,
    )
    .option(
      '--concurrency <number>',
      cmd.options!.find((o) => o.flag.includes('--concurrency'))!.description,
    )
    .option('--debug', cmd.options!.find((o) => o.flag.includes('--debug'))!.description)
    .option('--json', cmd.options!.find((o) => o.flag.includes('--json'))!.description)
    .option('--describe', cmd.options!.find((o) => o.flag.includes('--describe'))!.description)
    .action(async (input: string, opts: RawCliOptions & { json?: boolean }) => {
      const parsed = parsePipelineOptions(opts);

      if (opts.json) {
        const startTime = Date.now();

        if (!existsSync(input)) {
          respondError('extract', SieveErrorCode.FILE_NOT_FOUND, `File not found: ${input}`, startTime, version);
          return;
        }

        try {
          const result = await runPipeline({
            mode: 'file',
            inputPath: input,
            ...parsed,
            onProgress: (phase, percent) => {
              process.stderr.write(JSON.stringify({ phase, percent }) + '\n');
            },
          });

          const data = {
            success: result.success,
            originalFrames: result.originalFramesCount,
            selectedFrames: result.prunedFramesCount,
            outputFiles: result.outputFiles,
            animations: result.animations ?? [],
            video: result.video ?? null,
          };
          respond('extract', data, startTime, version);
        } catch (error) {
          const err = error instanceof Error ? error : new Error(String(error));
          respondError('extract', classifyError(err), err.message, startTime, version);
        }
        return;
      }

      const { outputPath, ...viewOpts } = parsed;
      const { waitUntilExit } = render(
        React.createElement(SieveView, {
          input,
          ...viewOpts,
          output: outputPath,
        }),
      );
      await waitUntilExit();
    });
}

export const SieveView: React.FC<SieveViewProps> = (props) => {
  const { exit } = useApp();
  const [phases, setPhases] = useState<PhaseState[]>(createInitialPhases);
  const [result, setResult] = useState<SieveResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const phaseStartTimes: number[] = PHASE_DEFS.map(() => 0);
    let currentPhaseKey: string = '';

    (async () => {
      try {
        // Clean up stale workspaces from previous interrupted runs
        await cleanupStaleWorkspaces().catch(() => {});

        // Mark INIT as running
        phaseStartTimes[0] = Date.now();
        setPhases((prev) => {
          const next = [...prev];
          next[0] = { ...next[0], status: 'running' };
          return next;
        });

        const res = await runPipelineInWorker(
          {
            mode: 'file',
            inputPath: props.input,
            ...(props.threshold !== undefined
              ? { threshold: props.threshold }
              : {}),
            ...(props.count !== undefined ? { count: props.count } : {}),
            outputPath: props.output,
            fps: props.fps,
            maxFrames: props.maxFrames,
            scale: props.scale,
            quality: props.quality,
            iouThreshold: props.iouThreshold,
            animationThreshold: props.animationThreshold,
            maxSegmentDuration: props.maxSegmentDuration,
            concurrency: props.concurrency,
            debug: props.debug,
          },
          (phase: ProgressPhase, percent: number) => {
            const phaseIdx = phaseKeyToIndex(phase);
            if (phaseIdx < 0) return;

            // Phase transition: mark all previous phases as done
            if (phase !== currentPhaseKey) {
              const now = Date.now();
              currentPhaseKey = phase;
              phaseStartTimes[phaseIdx] = now;

              setPhases((prev) => {
                const next = [...prev];
                for (let i = 0; i < next.length; i++) {
                  if (i < phaseIdx) {
                    if (next[i].status !== 'done') {
                      next[i] = {
                        ...next[i],
                        status: 'done',
                        percent: 100,
                        durationMs: phaseStartTimes[i]
                          ? now - phaseStartTimes[i]
                          : 0,
                      };
                    }
                  } else if (i === phaseIdx) {
                    next[i] = { ...next[i], status: 'running', percent: 0 };
                  }
                }
                return next;
              });
            }

            // Update progress for current phase
            setPhases((prev) => {
              const next = [...prev];
              if (next[phaseIdx].status === 'running') {
                next[phaseIdx] = {
                  ...next[phaseIdx],
                  percent: Math.round(percent),
                };
              }
              return next;
            });
          },
        );

        // Mark all remaining phases as done
        const now = Date.now();
        setPhases((prev) =>
          prev.map((p, i) => {
            if (p.status !== 'done') {
              return {
                ...p,
                status: 'done' as const,
                percent: 100,
                durationMs: phaseStartTimes[i] ? now - phaseStartTimes[i] : 0,
              };
            }
            return p;
          }),
        );
        setResult(res);

        setTimeout(() => exit(), 100);
      } catch (err) {
        const now = Date.now();
        setPhases((prev) => {
          const next = [...prev];
          for (let i = 0; i < next.length; i++) {
            if (next[i].status === 'running') {
              next[i] = {
                ...next[i],
                status: 'failed',
                durationMs: phaseStartTimes[i]
                  ? now - phaseStartTimes[i]
                  : 0,
              };
            }
          }
          return next;
        });
        setError(err instanceof Error ? err.message : String(err));
        setTimeout(() => exit(), 100);
      }
    })();
  }, []);

  return (
    <Box flexDirection="column">
      <Text bold>{'▸ scene-sieve'} — {props.input.split('/').pop()}</Text>
      <Text> </Text>

      {phases.map((phase, i) => (
        <PhaseStep key={i} phase={phase} />
      ))}

      {/* Error */}
      {error && (
        <Box marginTop={1}>
          <Text color="red">✗ Failed — {error}</Text>
        </Box>
      )}

      {/* Result summary */}
      {result && (
        <Box flexDirection="column" marginTop={1}>
          <Text color="gray">  ────────────────────</Text>
          <Text color="green" bold>
            {'✓ Done'} — {result.originalFramesCount} frames →{' '}
            {result.prunedFramesCount} scenes (
            {(result.executionTimeMs / 1000).toFixed(1)}s)
          </Text>
          {result.animations && result.animations.length > 0 && (
            <Text color="blue">
              {'ℹ Found'} {result.animations.length} animations (recorded in
              .metadata.json)
            </Text>
          )}
          {props.debug && result.outputFiles.length > 0 && (
            <Box flexDirection="column" marginTop={1}>
              <Text color="gray">
                Output: {result.outputFiles[0]?.replace(/\/[^/]+$/, '/')}
              </Text>
              {result.outputFiles.map((f, i) => (
                <Text key={i} color="gray">  - {f}</Text>
              ))}
            </Box>
          )}
        </Box>
      )}
    </Box>
  );
};
