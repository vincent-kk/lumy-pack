import { cleanupTmpDirs } from './cleanup-tmp.js';

const SCENE_SIEVE_TMP_PREFIXES = [
  'scene-sieve-test-',
  'scene-sieve-integration-',
  'scene-sieve-e2e-',
];

/**
 * Vitest globalSetup. Returned function runs as teardown after all tests.
 */
export default function globalSetup(): () => void {
  return () => {
    cleanupTmpDirs(SCENE_SIEVE_TMP_PREFIXES);
  };
}
