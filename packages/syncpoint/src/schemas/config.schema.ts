import configSchema from '../../assets/schemas/config.schema.json';
import type { SyncpointConfig } from '../utils/types.js';

import { ajv } from './ajv.js';

const validate = ajv.compile<SyncpointConfig>(configSchema);

export function validateConfig(data: unknown): {
  valid: boolean;
  errors?: string[];
} {
  const valid = validate(data);
  if (valid) return { valid: true };
  const errors = validate.errors?.map(
    (e) => `${e.instancePath || '/'} ${e.message ?? 'unknown error'}`,
  );
  return { valid: false, errors };
}
