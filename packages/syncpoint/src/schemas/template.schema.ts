import Ajv from "ajv";
import addFormats from "ajv-formats";

import type { TemplateConfig } from "../utils/types.js";

const ajv = new Ajv({ allErrors: true });
addFormats(ajv);

const templateSchema = {
  type: "object",
  required: ["name", "steps"],
  properties: {
    name: { type: "string", minLength: 1 },
    description: { type: "string" },
    backup: { type: "string" },
    steps: {
      type: "array",
      minItems: 1,
      items: {
        type: "object",
        required: ["name", "command"],
        properties: {
          name: { type: "string", minLength: 1 },
          description: { type: "string" },
          command: { type: "string", minLength: 1 },
          skip_if: { type: "string" },
          continue_on_error: { type: "boolean" },
        },
        additionalProperties: false,
      },
    },
  },
  additionalProperties: false,
};

const validate = ajv.compile<TemplateConfig>(templateSchema);

export function validateTemplate(data: unknown): {
  valid: boolean;
  errors?: string[];
} {
  const valid = validate(data);
  if (valid) return { valid: true };
  const errors = validate.errors?.map(
    (e) => `${e.instancePath || "/"} ${e.message ?? "unknown error"}`,
  );
  return { valid: false, errors };
}
