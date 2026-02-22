/**
 * @file scan.ts
 * @description filid v2 스캔 옵션 타입 정의.
 *
 * 제로 설정(zero-config) 아키텍처: 외부 설정 파일 없이 내장 기본값 사용.
 * 필요 시 프로그래밍적으로 옵션을 전달할 수 있다.
 */

/** 프로젝트 스캔 옵션 */
export interface ScanOptions {
  /** 스캔 포함 glob 패턴. 기본값: ['**'] */
  include?: string[];
  /** 스캔 제외 glob 패턴. 기본값: ['node_modules/**', '.git/**', 'dist/**'] */
  exclude?: string[];
  /** 최대 스캔 깊이. 기본값: 10 */
  maxDepth?: number;
  /** 심볼릭 링크 추적 여부. 기본값: false */
  followSymlinks?: boolean;
}

/** 기본 스캔 옵션 (내장 하드코딩, 외부 설정 파일 없음) */
export const DEFAULT_SCAN_OPTIONS: Required<ScanOptions> = {
  include: ['**'],
  exclude: [
    '**/node_modules/**',
    '**/.git/**',
    '**/dist/**',
    '**/build/**',
    '**/coverage/**',
    '**/docs/**',
    '**/scripts/**',
    '**/.filid/**',
    '**/.claude/**',
    '**/.omc/**',
    '**/.metadata/**',
    '**/next/**',
    '**/libs/**',
  ],
  maxDepth: 10,
  followSymlinks: false,
};
