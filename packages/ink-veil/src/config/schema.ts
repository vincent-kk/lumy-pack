import type { JSONSchemaType } from 'ajv';
import type { InkVeilConfig } from './loader.js';

/**
 * JSON Schema for ~/.ink-veil/config.json
 * Validated with AJV 8 (draft-2020-12 semantics, useDefaults: true).
 */
export const CONFIG_SCHEMA = ({
  type: 'object',
  additionalProperties: false,
  required: ['tokenMode', 'signature', 'ner', 'detection', 'dictionary', 'output', 'manualRules'],
  properties: {
    tokenMode: {
      type: 'string',
      enum: ['tag', 'bracket', 'plain'],
      default: 'tag',
      nullable: false,
    },
    signature: {
      type: 'boolean',
      default: true,
      nullable: false,
    },
    ner: {
      type: 'object',
      additionalProperties: false,
      nullable: false,
      default: {},
      required: ['model', 'threshold', 'enabled'],
      properties: {
        model: {
          type: 'string',
          default: 'kiwi-base',
          nullable: false,
        },
        threshold: {
          type: 'number',
          minimum: 0,
          maximum: 1,
          default: 0.2,
          nullable: false,
        },
        enabled: {
          type: 'boolean',
          default: true,
          nullable: false,
        },
      },
    },
    detection: {
      type: 'object',
      additionalProperties: false,
      nullable: false,
      default: {},
      required: ['priorityOrder', 'categories'],
      properties: {
        priorityOrder: {
          type: 'array',
          items: {
            type: 'string',
            enum: ['MANUAL', 'REGEX', 'NER'],
            nullable: false,
          },
          default: ['MANUAL', 'REGEX', 'NER'],
          nullable: false,
        },
        categories: {
          type: 'array',
          items: { type: 'string', nullable: false },
          default: [],
          nullable: false,
        },
      },
    },
    dictionary: {
      type: 'object',
      additionalProperties: false,
      nullable: false,
      default: {},
      required: ['defaultPath'],
      properties: {
        defaultPath: {
          type: 'string',
          default: './dictionary.json',
          nullable: false,
        },
      },
    },
    output: {
      type: 'object',
      additionalProperties: false,
      nullable: false,
      default: {},
      required: ['directory', 'encoding'],
      properties: {
        directory: {
          type: 'string',
          default: './veiled/',
          nullable: false,
        },
        encoding: {
          type: 'string',
          default: 'utf-8',
          nullable: false,
        },
      },
    },
    manualRules: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['pattern', 'category'],
        nullable: false,
        properties: {
          pattern: { type: 'string', nullable: false },
          category: { type: 'string', nullable: false },
          isRegex: { type: 'boolean', default: false, nullable: false },
        },
      },
      default: [],
      nullable: false,
    },
  },
}) as unknown as JSONSchemaType<InkVeilConfig>;
