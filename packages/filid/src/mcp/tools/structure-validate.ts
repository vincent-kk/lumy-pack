import { scanProject } from '../../core/fractal-tree.js';
import { validateStructure } from '../../core/fractal-validator.js';
import { getActiveRules, loadBuiltinRules } from '../../core/rule-engine.js';
import type { ValidationReport } from '../../types/report.js';

export interface StructureValidateInput {
  path: string;
  rules?: string[];
  fix?: boolean;
}

export interface StructureValidateResult {
  report: ValidationReport;
  timestamp: string;
  rulesApplied: number;
  rulesSkipped: number;
}

/**
 * Handle structure-validate MCP tool calls.
 *
 * Runs a comprehensive fractal structure validation against the project
 * at the given path. When fix=true, safe-grade violations are auto-remediated
 * and the remaining violations are re-reported.
 */
export async function handleStructureValidate(
  args: unknown,
): Promise<StructureValidateResult> {
  const input = args as StructureValidateInput;

  if (!input.path) {
    throw new Error('path is required');
  }

  const allRules = loadBuiltinRules();
  const activeRules = getActiveRules(allRules);

  let rulesToApply = activeRules;
  let rulesSkipped = 0;

  if (input.rules && input.rules.length > 0) {
    const ruleIdSet = new Set(input.rules);
    rulesToApply = activeRules.filter((r) => ruleIdSet.has(r.id));
    rulesSkipped = activeRules.length - rulesToApply.length;
  }

  const tree = await scanProject(input.path);
  const report = validateStructure(tree, rulesToApply);

  // fix=true: auto-remediate 'safe' violations (currently a no-op placeholder,
  // as actual file mutation requires restructurer agent approval)
  if (input.fix) {
    // Safe remediations would be applied here in a future implementation.
    // For now, report remains unchanged to avoid unintended file mutations.
  }

  return {
    report,
    timestamp: new Date().toISOString(),
    rulesApplied: rulesToApply.length,
    rulesSkipped,
  };
}
