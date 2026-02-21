/**
 * AST analysis type definitions for TypeScript/JavaScript source parsing
 */

/** Import declaration info */
export interface ImportInfo {
  /** Module specifier (e.g., 'fs/promises') */
  source: string;
  /** Imported names (e.g., ['readFile', 'writeFile']) */
  specifiers: string[];
  /** Whether type-only import */
  isTypeOnly: boolean;
  /** Line number in source */
  line: number;
}

/** Export declaration info */
export interface ExportInfo {
  /** Exported name */
  name: string;
  /** Whether type-only export */
  isTypeOnly: boolean;
  /** Whether default export */
  isDefault: boolean;
  /** Line number in source */
  line: number;
}

/** Function/method call info */
export interface CallInfo {
  /** Callee expression (e.g., 'readFile', 'path.dirname') */
  callee: string;
  /** Line number in source */
  line: number;
}

/** Extracted dependency info from a source file */
export interface DependencyInfo {
  /** File path */
  filePath: string;
  /** Import declarations */
  imports: ImportInfo[];
  /** Export declarations */
  exports: ExportInfo[];
  /** Function/method calls */
  calls: CallInfo[];
}

/** Method info for LCOM4 analysis */
export interface MethodInfo {
  /** Method name */
  name: string;
  /** Field names accessed by this method */
  accessedFields: string[];
}

/** Class structure info for LCOM4 analysis */
export interface ClassInfo {
  /** Class name */
  name: string;
  /** Methods in the class */
  methods: MethodInfo[];
  /** Field names in the class */
  fields: string[];
}

/** Single change in a tree diff */
export interface TreeDiffChange {
  /** Change type */
  type: 'added' | 'removed' | 'modified';
  /** Declaration kind (function, class, variable, interface, etc.) */
  kind: string;
  /** Declaration name */
  name: string;
  /** Line in old source (for removed/modified) */
  oldLine?: number;
  /** Line in new source (for added/modified) */
  newLine?: number;
}

/** Semantic AST diff result */
export interface TreeDiffResult {
  /** List of semantic changes */
  changes: TreeDiffChange[];
  /** Whether there are any semantic (non-formatting) changes */
  hasSemanticChanges: boolean;
  /** Count of formatting-only differences (no semantic impact) */
  formattingOnlyChanges: number;
}
