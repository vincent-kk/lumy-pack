// This source-root location preserves manifest resolution from both src and dist.
import { createRequire } from 'node:module';

/** Runtime manifest version shared by CLI responses and metadata documents. */
export const PACKAGE_VERSION: string = (
  createRequire(import.meta.url)('../package.json') as { version: string }
).version;
