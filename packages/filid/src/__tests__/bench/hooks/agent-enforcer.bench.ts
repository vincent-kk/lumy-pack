import { bench, describe } from 'vitest';
import { enforceAgentRole } from '../../../hooks/agent-enforcer.js';
import { generateSubagentInput } from '../fixtures/generator.js';

// 알려진 역할들
const knownRoles = ['architect', 'qa-reviewer', 'implementer', 'context-manager'];
const unknownRoles = ['executor', 'researcher', 'unknown-role', 'custom-agent', ''];

// 입력 사전 생성
const knownInputs = knownRoles.map((role) => generateSubagentInput(role));
const unknownInputs = unknownRoles.map((role) => generateSubagentInput(role));

describe('agent-enforcer: known roles', () => {
  for (let i = 0; i < knownRoles.length; i++) {
    const role = knownRoles[i];
    const input = knownInputs[i];
    bench(`role: ${role}`, () => {
      enforceAgentRole(input);
    });
  }
});

describe('agent-enforcer: unknown/pass-through roles', () => {
  for (let i = 0; i < unknownRoles.length; i++) {
    const role = unknownRoles[i] || '(empty)';
    const input = unknownInputs[i];
    bench(`role: ${role}`, () => {
      enforceAgentRole(input);
    });
  }
});

describe('agent-enforcer: rapid role switching', () => {
  bench('cycle through all 4 known roles', () => {
    for (const input of knownInputs) {
      enforceAgentRole(input);
    }
  });

  bench('mixed known + unknown roles (10 calls)', () => {
    const allInputs = [...knownInputs, ...unknownInputs.slice(0, 6)];
    for (const input of allInputs) {
      enforceAgentRole(input);
    }
  });
});
