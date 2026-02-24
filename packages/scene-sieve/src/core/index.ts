export { runPipeline } from './orchestrator.js';
export {
  analyzeFrames,
  computeIoU,
  computeInformationGain,
} from './analyzer.js';
export { extractFrames } from './extractor.js';
export {
  pruneTo,
  pruneByThreshold,
  pruneByThresholdWithCap,
  suppressConsecutiveRuns,
} from './pruner.js';
export { dbscan } from './dbscan.js';
export type { Point2D } from './dbscan.js';
export { resolveInput, resolveOptions } from './input-resolver.js';
export {
  createWorkspace,
  cleanupWorkspace,
  finalizeOutput,
  readFramesAsBuffers,
  writeInputBuffer,
  writeInputFrames,
} from './workspace.js';
