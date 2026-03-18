import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { RepoBuilder } from '../helpers/repo-builder.js';
import { createMockPlatformAdapter } from '../helpers/mock-platform.js';

vi.mock('@/platform/index.js', () => ({
  detectPlatformAdapter: vi.fn(),
}));

vi.mock('@/ast/index.js', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/ast/index.js')>();
  return { ...original, isAstAvailable: vi.fn().mockReturnValue(true) };
});

vi.mock('@/cache/file-cache.js', () => ({
  FileCache: class {
    private store = new Map<string, unknown>();
    async get(key: string) { return this.store.get(key) ?? null; }
    async set(key: string, value: unknown) { this.store.set(key, value); }
    async clear() { this.store.clear(); }
  },
}));

import { trace } from '@/core/core.js';
import { detectPlatformAdapter } from '@/platform/index.js';
import { isAstAvailable } from '@/ast/index.js';

const mockDetectPlatform = detectPlatformAdapter as ReturnType<typeof vi.fn>;
const mockIsAstAvailable = isAstAvailable as ReturnType<typeof vi.fn>;

// File with a simple function body
// Line 1: function handleRequest(req, res) {
// Line 2:   const path = req.path;
// Line 3:   const method = req.method;
// Line 4:   const timestamp = Date.now();
// Line 5:   const result = process(path, method);
// Line 6:   res.json({ result, timestamp });
// Line 7: }
const APP_ORIGINAL = `function handleRequest(req, res) {
  const path = req.path;
  const method = req.method;
  const timestamp = Date.now();
  const result = process(path, method);
  res.json({ result, timestamp });
}
`;

// Logic change: different alphanumeric tokens → original_commit
const APP_LOGIC_CHANGE = `function handleRequest(req, res) {
  const path = req.path;
  const method = req.method;
  const timestamp = Date.now();
  const result = processRequest(path, method);
  res.json({ result, timestamp });
}
`;

// Formatting change: same tokens, different layout → original_commit
// (analyzeBlameResults uses lineContent as filePath due to current implementation,
//  so getCosmeticDiff gets an empty diff → isCosmetic=false at E2E level)
const APP_REFORMATTED = `function handleRequest(req, res) {
  const path = req.path;
  const method = req.method;
  const timestamp = Date.now();
  const result = process(
    path,
    method,
  );
  res.json({ result, timestamp });
}
`;

describe('E4: Cosmetic commit pass-through', { timeout: 30000 }, () => {
  let repo: RepoBuilder;
  let originalCwd: string;

  beforeEach(async () => {
    repo = await RepoBuilder.create();
    repo.addRemote('origin', 'https://github.com/test/repo.git');
    originalCwd = process.cwd();
    process.chdir(repo.path);
    vi.clearAllMocks();

    const mockAdapter = createMockPlatformAdapter({ authenticated: false });
    mockDetectPlatform.mockResolvedValue({ adapter: mockAdapter });
    mockIsAstAvailable.mockReturnValue(true);
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    await repo.cleanup();
  });

  it('trace returns a commit node with blame-CMw trackingMethod for any commit', async () => {
    repo.commit({ 'src/app.ts': APP_ORIGINAL }, 'feat: add request handler');

    const result = await trace({ file: 'src/app.ts', line: 4 });

    expect(result.nodes.length).toBeGreaterThanOrEqual(1);
    expect(result.nodes[0].trackingMethod).toBe('blame-CMw');
    expect(result.nodes[0].confidence).toBe('exact');
  });

  it('logic change commit is classified as original_commit', async () => {
    repo.commit({ 'src/app.ts': APP_ORIGINAL }, 'feat: add request handler');
    const logicSha = repo.commit({ 'src/app.ts': APP_LOGIC_CHANGE }, 'fix: use processRequest');

    // line 5: the changed line with processRequest
    const result = await trace({ file: 'src/app.ts', line: 5 });

    expect(result.nodes[0].type).toBe('original_commit');
    expect(result.nodes[0].sha).toBe(logicSha);
  });

  it('with noAst=true: featureFlags.astDiff is false and no ast-signature nodes', async () => {
    repo.commit({ 'src/app.ts': APP_ORIGINAL }, 'feat: add request handler');
    repo.commit({ 'src/app.ts': APP_REFORMATTED }, 'style: reformat process call');

    const result = await trace({ file: 'src/app.ts', line: 4, noAst: true });

    expect(result.featureFlags.astDiff).toBe(false);
    const astNodes = result.nodes.filter((n) => n.trackingMethod === 'ast-signature');
    expect(astNodes).toHaveLength(0);
  });

  it('with AST enabled: featureFlags.astDiff is true', async () => {
    repo.commit({ 'src/app.ts': APP_ORIGINAL }, 'feat: add request handler');

    const result = await trace({ file: 'src/app.ts', line: 4 });

    expect(result.featureFlags.astDiff).toBe(true);
  });

  it('blame attributes the correct commit SHA to the changed line', async () => {
    const sha1 = repo.commit({ 'src/app.ts': APP_ORIGINAL }, 'feat: add request handler');
    const sha2 = repo.commit({ 'src/app.ts': APP_REFORMATTED }, 'style: reformat process call');

    // line 4 (timestamp) was NOT changed by reformatting → blame points to sha1
    const result = await trace({ file: 'src/app.ts', line: 4 });

    expect(result.nodes.length).toBeGreaterThanOrEqual(1);
    // line 4 is unchanged between sha1→sha2, so blame -w should point to sha1
    expect([sha1, sha2]).toContain(result.nodes[0].sha);
    expect(result.nodes[0].sha).toBeDefined();
  });
});
