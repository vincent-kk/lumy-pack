import Ajv from 'ajv';
import addFormats from 'ajv-formats';

import { isValidPattern } from '../utils/pattern.js';

const ajv = new Ajv({ allErrors: true });
addFormats(ajv);

// Add custom keyword for pattern validation
ajv.addKeyword({
  keyword: 'validPattern',
  type: 'string',
  validate: function validate(schema: boolean, data: string): boolean {
    if (!schema) return true;
    return isValidPattern(data);
  },
  errors: true,
});

export { ajv };
