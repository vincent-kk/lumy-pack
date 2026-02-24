import { Box, Static, Text, useApp } from 'ink';
import React, { useEffect, useState } from 'react';

import { PhaseStep } from '../components/PhaseStep.js';
import type { PhaseState } from '../components/PhaseStep.js';
import { extractScenes } from '../index.js';
import type { ProgressPhase, SieveResult } from '../types/index.js';

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
  scale: number;
  quality: number;
  debug: boolean;
}

export const SieveView: React.FC<SieveViewProps> = (props) => {
  const { exit } = useApp();
  const [phases, setPhases] = useState<PhaseState[]>(createInitialPhases);
  const [result, setResult] = useState<SieveResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [completedCount, setCompletedCount] = useState(0);

  useEffect(() => {
    const phaseStartTimes: number[] = PHASE_DEFS.map(() => 0);
    let currentPhaseKey: string = '';

    (async () => {
      try {
        // Mark INIT as running
        phaseStartTimes[0] = Date.now();
        setPhases((prev) => {
          const next = [...prev];
          next[0] = { ...next[0], status: 'running' };
          return next;
        });

        const res = await extractScenes({
          mode: 'file',
          inputPath: props.input,
          ...(props.threshold !== undefined
            ? { threshold: props.threshold }
            : {}),
          ...(props.count !== undefined ? { count: props.count } : {}),
          outputPath: props.output,
          fps: props.fps,
          scale: props.scale,
          quality: props.quality,
          debug: props.debug,
          onProgress: (phase: ProgressPhase, percent: number) => {
            const phaseIdx = phaseKeyToIndex(phase);
            if (phaseIdx < 0) return;

            // Phase transition: mark all previous phases as done
            if (phase !== currentPhaseKey) {
              const now = Date.now();
              currentPhaseKey = phase;
              phaseStartTimes[phaseIdx] = now;

              setPhases((prev) => {
                const next = [...prev];
                let newCompleted = 0;
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
                    newCompleted++;
                  } else if (i === phaseIdx) {
                    next[i] = { ...next[i], status: 'running', percent: 0 };
                  }
                }
                setCompletedCount(newCompleted);
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
        });

        // Mark all remaining phases as done
        const now = Date.now();
        setPhases((prev) => {
          const next = prev.map((p, i) => {
            if (p.status !== 'done') {
              return {
                ...p,
                status: 'done' as const,
                percent: 100,
                durationMs: phaseStartTimes[i] ? now - phaseStartTimes[i] : 0,
              };
            }
            return p;
          });
          return next;
        });
        setCompletedCount(PHASE_DEFS.length);
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

  // Split phases into completed (Static) and active
  const completedPhases = phases.slice(0, completedCount);
  const activePhases = phases.slice(completedCount);

  return (
    <Box flexDirection="column">
      <Text bold>{'▸ scene-sieve'} — {props.input.split('/').pop()}</Text>
      <Text> </Text>

      {/* Completed phases — frozen, no re-render */}
      <Static items={completedPhases.map((p, i) => ({ ...p, id: String(i) }))}>
        {(item) => <PhaseStep key={item.id} phase={item} />}
      </Static>

      {/* Active + pending phases */}
      {activePhases.map((phase, i) => (
        <PhaseStep key={completedCount + i} phase={phase} />
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
            {'✓ Done'} — {result.originalFramesCount} frames → {result.prunedFramesCount} scenes ({(result.executionTimeMs / 1000).toFixed(1)}s)
          </Text>
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
