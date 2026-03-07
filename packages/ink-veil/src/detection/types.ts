export type DetectionMethod = 'MANUAL' | 'REGEX' | 'NER';

export interface DetectionSpan {
  start: number;
  end: number;
  text: string;
  category: string;
  method: DetectionMethod;
  confidence: number;
  priority?: number;
}

export interface DetectionConfig {
  priorityOrder: DetectionMethod[];
  categoryPriority?: Record<string, DetectionMethod[]>;
  nerThreshold?: number;
  categories?: string[];
}

export interface DetectionEngine {
  detect(text: string, config?: DetectionConfig): DetectionSpan[];
}
