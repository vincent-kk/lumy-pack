import { describe, it, expect } from 'vitest';

import { isCosmeticDiff } from '../cosmetic-detector.js';

const WHITESPACE_DIFF = `diff --git a/src/index.ts b/src/index.ts
--- a/src/index.ts
+++ b/src/index.ts
@@ -1,3 +1,3 @@
-const x = 42;
+const x  =  42;
-const y = 10;
+const y =   10;`;

const IMPORT_REORDER_DIFF = `diff --git a/src/index.ts b/src/index.ts
--- a/src/index.ts
+++ b/src/index.ts
@@ -1,3 +1,3 @@
-import { b } from 'b';
-import { a } from 'a';
-import { c } from 'c';
+import { a } from 'a';
+import { b } from 'b';
+import { c } from 'c';`;

const LOGIC_CHANGE_DIFF = `diff --git a/src/index.ts b/src/index.ts
--- a/src/index.ts
+++ b/src/index.ts
@@ -1,3 +1,3 @@
-const x = 42;
+const x = 100;`;

const FORMATTING_DIFF = `diff --git a/src/index.ts b/src/index.ts
--- a/src/index.ts
+++ b/src/index.ts
@@ -1,3 +1,5 @@
-function foo() { return 42; }
+function foo() {
+  return 42;
+}`;

const MIXED_DIFF = `diff --git a/src/index.ts b/src/index.ts
--- a/src/index.ts
+++ b/src/index.ts
@@ -1,3 +1,3 @@
-const x = 42;
+const x = 100;
@@ -10,3 +10,3 @@
-const y = 10;
+const y  =  10;`;

describe('isCosmeticDiff', () => {
  it('detects whitespace-only changes', () => {
    const result = isCosmeticDiff(WHITESPACE_DIFF);
    expect(result.isCosmetic).toBe(true);
    expect(result.reason).toBe('whitespace');
  });

  it('detects import reorder', () => {
    const result = isCosmeticDiff(IMPORT_REORDER_DIFF);
    expect(result.isCosmetic).toBe(true);
    expect(result.reason).toBe('import-order');
  });

  it('rejects logic changes', () => {
    const result = isCosmeticDiff(LOGIC_CHANGE_DIFF);
    expect(result.isCosmetic).toBe(false);
  });

  it('detects formatting-only changes', () => {
    const result = isCosmeticDiff(FORMATTING_DIFF);
    expect(result.isCosmetic).toBe(true);
    expect(result.reason).toBe('formatting');
  });

  it('rejects mixed changes (cosmetic + logic)', () => {
    const result = isCosmeticDiff(MIXED_DIFF);
    expect(result.isCosmetic).toBe(false);
  });

  it('returns false for empty diff', () => {
    const result = isCosmeticDiff('');
    expect(result.isCosmetic).toBe(false);
  });
});
