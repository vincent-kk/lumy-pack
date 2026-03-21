export type TraceNodeType =
  | 'original_commit'
  | 'cosmetic_commit'
  | 'merge_commit'
  | 'rebased_commit'
  | 'pull_request'
  | 'issue';

export type TrackingMethod =
  | 'blame'
  | 'blame-CMw'
  | 'ast-signature'
  | 'ancestry-path'
  | 'patch-id'
  | 'api'
  | 'message-parse'
  | 'issue-link';

export type Confidence = 'exact' | 'structural' | 'heuristic';

export interface TraceNode {
  type: TraceNodeType;
  sha?: string;
  trackingMethod: TrackingMethod;
  confidence: Confidence;
  prNumber?: number;
  prUrl?: string;
  prTitle?: string;
  patchId?: string;
  note?: string;
  mergedAt?: string;
  issueNumber?: number;
  issueUrl?: string;
  issueTitle?: string;
  issueState?: 'open' | 'closed';
  issueLabels?: string[];
}

export type OperatingLevel = 0 | 1 | 2;

export interface FeatureFlags {
  astDiff: boolean;
  deepTrace: boolean;
  commitGraph: boolean;
  graphql: boolean;
}
