import { map } from '@winglet/common-utils';

import templateSchema from '../../assets/schemas/template.schema.json';
import type { TemplateConfig } from '../utils/types.js';

import { ajv } from './ajv.js';

const validate = ajv.compile<TemplateConfig>(templateSchema);

export function validateTemplate(data: unknown): {
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
