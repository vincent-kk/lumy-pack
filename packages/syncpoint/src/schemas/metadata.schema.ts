import Ajv from "ajv";
import addFormats from "ajv-formats";

import type { BackupMetadata } from "../utils/types.js";

const ajv = new Ajv({ allErrors: true });
addFormats(ajv);

const metadataSchema = {
  type: "object",
  required: [
    "version",
    "toolVersion",
    "createdAt",
    "hostname",
    "system",
    "config",
    "files",
    "summary",
  ],
  properties: {
    version: { type: "string" },
    toolVersion: { type: "string" },
    createdAt: { type: "string" },
    hostname: { type: "string" },
    system: {
      type: "object",
      required: ["platform", "release", "arch"],
      properties: {
        platform: { type: "string" },
        release: { type: "string" },
        arch: { type: "string" },
      },
      additionalProperties: false,
    },
    config: {
      type: "object",
      required: ["filename"],
      properties: {
        filename: { type: "string" },
        destination: { type: "string" },
      },
      additionalProperties: false,
    },
    files: {
      type: "array",
      items: {
        type: "object",
        required: ["path", "absolutePath", "size", "hash"],
        properties: {
          path: { type: "string" },
          absolutePath: { type: "string" },
          size: { type: "number", minimum: 0 },
          hash: { type: "string" },
          type: { type: "string" },
        },
        additionalProperties: false,
      },
    },
    summary: {
      type: "object",
      required: ["fileCount", "totalSize"],
      properties: {
        fileCount: { type: "integer", minimum: 0 },
        totalSize: { type: "number", minimum: 0 },
      },
      additionalProperties: false,
    },
  },
  additionalProperties: false,
};

const validate = ajv.compile<BackupMetadata>(metadataSchema);

export function validateMetadata(data: unknown): {
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
