import { ajv } from "./ajv.js";
import type { TemplateConfig } from "../utils/types.js";

const templateSchema = {
  type: "object",
  required: ["name", "steps"],
  properties: {
    name: { type: "string", minLength: 1 },
    description: { type: "string" },
    backup: { type: "string" },
    sudo: { type: "boolean" },
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
