import { detectDrift, generateSyncPlan } from '../../core/drift-detector.js';
import { SEVERITY_ORDER } from '../../core/drift-detector.js';
import { scanProject } from '../../core/fractal-tree.js';
import { validateStructure } from '../../core/fractal-validator.js';
import type { DriftItem, DriftSeverity, SyncPlan } from '../../types/drift.js';

export interface DriftDetectInput {
  path: string;
  severity?: DriftSeverity;
  generatePlan?: boolean;
}

export interface McpDriftReport {
  items: DriftItem[];
  totalDrifts: number;
  bySeverity: Record<DriftSeverity, number>;
  scanTimestamp: string;
  syncPlan?: SyncPlan;
}

/**
 * Handle drift-detect MCP tool calls.
 *
 * Detects structural drift between the current project layout and
 * fractal principles. Optionally filters by severity and generates
 * a SyncPlan for correcting the detected drift items.
 */
export async function handleDriftDetect(
  args: unknown,
): Promise<McpDriftReport> {
  const input = args as DriftDetectInput;

  if (!input.path) {
    throw new Error('path is required');
  }

  const tree = await scanProject(input.path);
  const validation = validateStructure(tree);
  const driftResult = detectDrift(tree, validation.result.violations, {
    generatePlan: false,
  });

  let items: DriftItem[] = driftResult.items;

  // Apply severity filter if provided
  if (input.severity) {
    const minOrder = SEVERITY_ORDER[input.severity];
    items = items.filter((item) => SEVERITY_ORDER[item.severity] <= minOrder);
  }

  const bySeverity: Record<DriftSeverity, number> = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
  };
  for (const item of items) {
    bySeverity[item.severity]++;
  }

  const report: McpDriftReport = {
    items,
    totalDrifts: items.length,
    bySeverity,
    scanTimestamp: new Date().toISOString(),
  };

  if (input.generatePlan) {
    report.syncPlan = generateSyncPlan(items);
  }

  return report;
}
