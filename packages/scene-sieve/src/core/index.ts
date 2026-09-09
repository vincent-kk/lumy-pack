export { runPipeline, runPipelineInWorker } from './orchestrator/index.js';
export {
  analyzeFrames,
  computeIoU,
  computeInformationGain,
  dbscan,
} from './analyzer/index.js';
export type { Point2D } from './analyzer/index.js';
export { extractFrames } from './extractor/index.js';
export {
  pruneTo,
  pruneByThreshold,
  pruneByThresholdWithCap,
  suppressConsecutiveRuns,
} from './pruner/index.js';
export { resolveInput, resolveOptions } from './input-resolver/index.js';
export {
  shouldSegment,
  computeSegmentPlan,
  processSegment,
  mergeSegmentFrames,
  runSegmentedPipeline,
} from './segmenter/index.js';
export {
  createWorkspace,
  createSegmentWorkspace,
  cleanupWorkspace,
  cleanupStaleWorkspaces,
  finalizeOutput,
  readFramesAsBuffers,
  writeInputBuffer,
  writeInputFrames,
} from './workspace/index.js';
