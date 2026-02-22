/**
 * MCP tool handler: review-manage
 * Manages review session lifecycle: branch normalization, directory creation,
 * checkpoint detection, committee election, and cleanup.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import type {
  CheckpointStatus,
  CommitteeElection,
  Complexity,
  PersonaId,
} from '../../types/review.js';

export interface ReviewManageInput {
  action: 'normalize-branch' | 'ensure-dir' | 'checkpoint' | 'elect-committee' | 'cleanup';
  projectRoot: string;
  branchName?: string;
  changedFilesCount?: number;
  changedFractalsCount?: number;
  hasInterfaceChanges?: boolean;
}

/**
 * Normalize a git branch name to a filesystem-safe string.
 *
 * Rules:
 * - `/` → `--`
 * - `#`, `@`, `~`, `^`, `:`, `?`, `*`, `[`, `]`, `\` → `_`
 * - Remove leading/trailing `.` and `-`
 * - Consecutive `--` are preserved (intentional for uniqueness)
 */
function normalizeBranch(branchName: string): string {
  let result = branchName;

  // Replace `/` with `--`
  result = result.replace(/\//g, '--');

  // Replace special characters with `_`
  result = result.replace(/[#@~^:?*[\]\\]/g, '_');

  // Remove leading `.` and `-`
  result = result.replace(/^[.\-]+/, '');

  // Remove trailing `.` and `-`
  result = result.replace(/[.\-]+$/, '');

  return result;
}

/**
 * Handle review-manage MCP tool calls.
 */
export async function handleReviewManage(args: unknown): Promise<Record<string, unknown>> {
  const input = args as ReviewManageInput;

  if (!input.action) {
    throw new Error('action is required');
  }
  if (!input.projectRoot) {
    throw new Error('projectRoot is required');
  }

  switch (input.action) {
    case 'normalize-branch': {
      if (!input.branchName) {
        throw new Error('branchName is required for normalize-branch action');
      }
      const normalized = normalizeBranch(input.branchName);
      return { normalized };
    }

    case 'ensure-dir': {
      if (!input.branchName) {
        throw new Error('branchName is required for ensure-dir action');
      }
      const normalized = normalizeBranch(input.branchName);
      const dirPath = path.join(input.projectRoot, '.filid', 'review', normalized);

      let created = false;
      try {
        await fs.access(dirPath);
      } catch {
        await fs.mkdir(dirPath, { recursive: true });
        created = true;
      }

      return { path: dirPath, created };
    }

    case 'checkpoint': {
      if (!input.branchName) {
        throw new Error('branchName is required for checkpoint action');
      }
      const normalized = normalizeBranch(input.branchName);
      const reviewDir = path.join(input.projectRoot, '.filid', 'review', normalized);

      const fileNames = ['session.md', 'verification.md', 'review-report.md'];
      const existingFiles: string[] = [];

      for (const fileName of fileNames) {
        try {
          await fs.access(path.join(reviewDir, fileName));
          existingFiles.push(fileName);
        } catch {
          // file does not exist
        }
      }

      const hasSession = existingFiles.includes('session.md');
      const hasVerification = existingFiles.includes('verification.md');
      const hasReport = existingFiles.includes('review-report.md');

      let phase: CheckpointStatus['phase'];
      if (!hasSession) {
        phase = 'A';
      } else if (!hasVerification) {
        phase = 'B';
      } else if (!hasReport) {
        phase = 'C';
      } else {
        phase = 'DONE';
      }

      const result: CheckpointStatus = { phase, files: existingFiles };
      return result as unknown as Record<string, unknown>;
    }

    case 'elect-committee': {
      if (input.changedFilesCount === undefined) {
        throw new Error('changedFilesCount is required for elect-committee action');
      }
      if (input.changedFractalsCount === undefined) {
        throw new Error('changedFractalsCount is required for elect-committee action');
      }
      if (input.hasInterfaceChanges === undefined) {
        throw new Error('hasInterfaceChanges is required for elect-committee action');
      }

      const { changedFilesCount, changedFractalsCount, hasInterfaceChanges } = input;

      // Determine complexity
      let complexity: Complexity;
      if (changedFilesCount <= 3 && changedFractalsCount <= 1 && !hasInterfaceChanges) {
        complexity = 'LOW';
      } else if (changedFilesCount > 10 || changedFractalsCount >= 4) {
        complexity = 'HIGH';
      } else {
        complexity = 'MEDIUM';
      }

      // Select committee based on complexity
      let committee: PersonaId[];
      if (complexity === 'LOW') {
        committee = ['engineering-architect', 'operations-sre'];
      } else if (complexity === 'MEDIUM') {
        committee = ['engineering-architect', 'knowledge-manager', 'business-driver', 'operations-sre'];
      } else {
        committee = [
          'engineering-architect',
          'knowledge-manager',
          'operations-sre',
          'business-driver',
          'product-manager',
          'design-hci',
        ];
      }

      // Build adversarial pairs from selected committee members
      const adversarialPairs: [PersonaId, PersonaId[]][] = [];

      if (committee.includes('business-driver')) {
        const challengers: PersonaId[] = [];
        if (committee.includes('knowledge-manager')) challengers.push('knowledge-manager');
        if (committee.includes('operations-sre')) challengers.push('operations-sre');
        if (challengers.length > 0) {
          adversarialPairs.push(['business-driver', challengers]);
        }
      }

      if (committee.includes('product-manager')) {
        const challengers: PersonaId[] = [];
        if (committee.includes('engineering-architect')) challengers.push('engineering-architect');
        if (challengers.length > 0) {
          adversarialPairs.push(['product-manager', challengers]);
        }
      }

      if (committee.includes('design-hci')) {
        const challengers: PersonaId[] = [];
        if (committee.includes('engineering-architect')) challengers.push('engineering-architect');
        if (challengers.length > 0) {
          adversarialPairs.push(['design-hci', challengers]);
        }
      }

      const result: CommitteeElection = { complexity, committee, adversarialPairs };
      return result as unknown as Record<string, unknown>;
    }

    case 'cleanup': {
      if (!input.branchName) {
        throw new Error('branchName is required for cleanup action');
      }
      const normalized = normalizeBranch(input.branchName);
      const reviewDir = path.join(input.projectRoot, '.filid', 'review', normalized);

      await fs.rm(reviewDir, { recursive: true, force: true });

      return { deleted: true };
    }

    default: {
      throw new Error(`Unknown action: ${(input as ReviewManageInput).action}`);
    }
  }
}
