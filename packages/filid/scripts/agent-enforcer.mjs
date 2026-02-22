#!/usr/bin/env node

// src/hooks/agent-enforcer.ts
var ROLE_RESTRICTIONS = {
  "fractal-architect": "ROLE RESTRICTION: You are a Fractal Architect agent. You MUST NOT use Write or Edit tools. You are read-only \u2014 analyze structure, design, plan, and draft proposals only.",
  "qa-reviewer": "ROLE RESTRICTION: You are a QA/Reviewer agent. You MUST NOT use Write or Edit tools. Review, analyze, and report only.",
  implementer: "ROLE RESTRICTION: You are an Implementer agent. You MUST only implement within the scope defined by SPEC.md. Do not make architectural changes beyond the approved specification.",
  "context-manager": "ROLE RESTRICTION: You are a Context Manager agent. You may only edit CLAUDE.md and SPEC.md documents. Do not modify business logic or source code.",
  "drift-analyzer": "ROLE RESTRICTION: You are a Drift Analyzer agent. You MUST NOT use Write or Edit tools. You are read-only \u2014 detect drift, classify severity, and produce correction plans only.",
  restructurer: "ROLE RESTRICTION: You are a Restructurer agent. You may only execute actions from an approved restructuring plan. Do not make structural decisions or modify business logic."
};
function enforceAgentRole(input2) {
  const agentType = input2.agent_type ?? "";
  const restriction = ROLE_RESTRICTIONS[agentType];
  if (!restriction) {
    return { continue: true };
  }
  return {
    continue: true,
    hookSpecificOutput: {
      additionalContext: restriction
    }
  };
}

// src/hooks/entries/agent-enforcer.entry.ts
var chunks = [];
for await (const chunk of process.stdin) {
  chunks.push(chunk);
}
var input = JSON.parse(
  Buffer.concat(chunks).toString("utf-8")
);
var result;
try {
  result = enforceAgentRole(input);
} catch {
  result = { continue: true };
}
process.stdout.write(JSON.stringify(result));
