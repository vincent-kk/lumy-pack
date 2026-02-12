import type { SyncpointConfig } from '../utils/types.js';
import { ajv } from './ajv.js';

const configSchema = {
  type: 'object',
  required: ['backup'],
  properties: {
    backup: {
      type: 'object',
      required: ['targets', 'exclude', 'filename'],
      properties: {
        targets: {
          type: 'array',
          items: { type: 'string', validPattern: true },
        },
        exclude: {
          type: 'array',
          items: { type: 'string', validPattern: true },
        },
        filename: {
          type: 'string',
          minLength: 1,
        },
        destination: {
          type: 'string',
        },
      },
      additionalProperties: false,
    },
    scripts: {
      type: 'object',
      properties: {
        includeInBackup: {
          type: 'boolean',
        },
      },
      additionalProperties: false,
    },
  },
  additionalProperties: false,
};

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
