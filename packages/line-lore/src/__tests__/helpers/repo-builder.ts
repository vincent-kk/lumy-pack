import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';

/**
 * Builds temporary git repositories for E2E tests.
 *
 * Uses deterministic timestamps so that identical content always
 * produces the same commit hash, enabling snapshot-based assertions.
 */
export class RepoBuilder {
  readonly path: string;
  private commitIndex = 0;

  private constructor(path: string) {
    this.path = path;
  }

  static async create(): Promise<RepoBuilder> {
    const path = mkdtempSync(join(tmpdir(), 'line-lore-e2e-'));
    const builder = new RepoBuilder(path);
    builder.git('init', '-b', 'main');
    builder.git('config', 'user.name', 'Test User');
    builder.git('config', 'user.email', 'test@test.com');
    builder.git('config', 'commit.gpgsign', 'false');
    builder.git('config', 'merge.ff', 'false');
    return builder;
  }

  /** Write files, stage, and commit. Returns the new commit SHA. */
  commit(files: Record<string, string>, message: string): string {
    for (const [filePath, content] of Object.entries(files)) {
      const fullPath = join(this.path, filePath);
      mkdirSync(dirname(fullPath), { recursive: true });
      writeFileSync(fullPath, content);
    }
    this.git('add', '-A');
    const date = this.nextDate();
    this.gitWithEnv(['commit', '-m', message], {
      GIT_AUTHOR_DATE: date,
      GIT_COMMITTER_DATE: date,
    });
    return this.getHead();
  }

  /** Create and checkout a new branch. */
  branch(name: string): this {
    this.git('checkout', '-b', name);
    return this;
  }

  /** Checkout an existing branch or ref. */
  checkout(ref: string): this {
    this.git('checkout', ref);
    return this;
  }

  /** Merge with --no-ff (creates a merge commit). Returns the merge commit SHA. */
  merge(branch: string, message?: string): string {
    const msg = message ?? `Merge branch '${branch}'`;
    const date = this.nextDate();
    this.gitWithEnv(['merge', '--no-ff', branch, '-m', msg], {
      GIT_AUTHOR_DATE: date,
      GIT_COMMITTER_DATE: date,
    });
    return this.getHead();
  }

  /** Squash merge (all commits collapsed into one). Returns the squash commit SHA. */
  squashMerge(branch: string, message: string): string {
    this.git('merge', '--squash', branch);
    const date = this.nextDate();
    this.gitWithEnv(['commit', '-m', message], {
      GIT_AUTHOR_DATE: date,
      GIT_COMMITTER_DATE: date,
    });
    return this.getHead();
  }

  /**
   * Rebase current branch onto `onto`, then fast-forward merge into `onto`.
   * Returns the HEAD SHA after the fast-forward.
   */
  rebaseOnto(onto: string): string {
    this.git('rebase', onto);
    return this.getHead();
  }

  /** Fast-forward merge (no merge commit). */
  fastForwardMerge(branch: string): string {
    this.git('merge', '--ff-only', branch);
    return this.getHead();
  }

  /** Cherry-pick a commit. Returns the new commit SHA. */
  cherryPick(sha: string): string {
    const date = this.nextDate();
    this.gitWithEnv(['cherry-pick', sha], {
      GIT_AUTHOR_DATE: date,
      GIT_COMMITTER_DATE: date,
    });
    return this.getHead();
  }

  /** Move a file via git mv. Returns the commit SHA. */
  moveFile(from: string, to: string, message: string): string {
    const toDir = dirname(join(this.path, to));
    mkdirSync(toDir, { recursive: true });
    this.git('mv', from, to);
    const date = this.nextDate();
    this.gitWithEnv(['commit', '-m', message], {
      GIT_AUTHOR_DATE: date,
      GIT_COMMITTER_DATE: date,
    });
    return this.getHead();
  }

  /** Get git log output. */
  log(format = '%H %s'): string[] {
    return this.git('log', `--format=${format}`)
      .split('\n')
      .filter(Boolean);
  }

  /** Return the current HEAD SHA (full 40-char). */
  getHead(): string {
    return this.git('rev-parse', 'HEAD');
  }

  /** Return the current branch name. */
  currentBranch(): string {
    return this.git('rev-parse', '--abbrev-ref', 'HEAD');
  }

  /** Add a git remote. */
  addRemote(name: string, url: string): this {
    this.git('remote', 'add', name, url);
    return this;
  }

  /** Remove the temporary repository. */
  async cleanup(): Promise<void> {
    rmSync(this.path, { recursive: true, force: true });
  }

  private git(...args: string[]): string {
    return execFileSync('git', args, {
      cwd: this.path,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
  }

  private gitWithEnv(args: string[], env: Record<string, string>): string {
    return execFileSync('git', args, {
      cwd: this.path,
      encoding: 'utf-8',
      env: { ...process.env, ...env },
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
  }

  private nextDate(): string {
    this.commitIndex++;
    const date = new Date('2024-01-01T00:00:00Z');
    date.setMinutes(date.getMinutes() + this.commitIndex);
    return date.toISOString();
  }
}
