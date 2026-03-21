import { map } from '@winglet/common-utils';

import metadataSchema from '../../assets/schemas/metadata.schema.json';
import type { BackupMetadata } from '../utils/types.js';

import { ajv } from './ajv.js';

const validate = ajv.compile<BackupMetadata>(metadataSchema);

export function validateMetadata(data: unknown): {
  valid: boolean;
  errors?: string[];
} {
  const valid = validate(data);
  if (valid) return { valid: true };
  const errors = validate.errors
    ? map(
        validate.errors,
        (e) => `${e.instancePath || '/'} ${e.message ?? 'unknown error'}`,
      )
    : undefined;
  return { valid: false, errors };
}
