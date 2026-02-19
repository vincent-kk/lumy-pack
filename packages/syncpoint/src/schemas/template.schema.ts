import type { TemplateConfig } from '../utils/types.js';

import templateSchema from '../../assets/schemas/template.schema.json';
import { ajv } from './ajv.js';

const validate = ajv.compile<TemplateConfig>(templateSchema);

export function validateTemplate(data: unknown): {
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
