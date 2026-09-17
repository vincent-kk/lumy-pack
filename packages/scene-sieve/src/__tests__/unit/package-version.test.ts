import { createRequire } from 'node:module';

import { expect, it } from 'vitest';

import { PACKAGE_VERSION } from '../../constants/package-version.js';

it('reads the package manifest version from the source entry location', () => {
  const require = createRequire(import.meta.url);
  expect(PACKAGE_VERSION).toBe(require('../../../package.json').version);
});
