import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';

/** Source constants are two levels below the manifest; runtime bundles are one level below. */
const manifestPath = existsSync(new URL('../package.json', import.meta.url))
  ? '../package.json'
  : '../../package.json';

/** Runtime manifest version shared by CLI responses and metadata documents. */
export const PACKAGE_VERSION: string = (
  createRequire(import.meta.url)(manifestPath) as { version: string }
).version;
