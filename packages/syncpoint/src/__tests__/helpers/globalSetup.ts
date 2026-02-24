import { cleanupTmpDirs } from './cleanup-tmp.js';

const SYNCPOINT_TMP_PREFIXES = [
  'syncpoint-test-',
  'syncpoint-e2e-',
  'backup-test-',
  'syncpoint-',
  'syncpoint-read-',
  'syncpoint-restore-',
];

/**
 * Vitest globalSetup. Returned function runs as teardown after all tests.
 */
export default function globalSetup(): () => void {
  return () => {
    cleanupTmpDirs(SYNCPOINT_TMP_PREFIXES);
  };
}
