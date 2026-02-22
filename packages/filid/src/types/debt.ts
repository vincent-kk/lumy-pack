/**
 * @file debt.ts
 * @description 기술 부채 관리 시스템의 데이터 모델 정의.
 */

/** 부채 심각도 */
export type DebtSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

/** 바이어스 수준 */
export type BiasLevel = 'LOW_PRESSURE' | 'MODERATE_PRESSURE' | 'HIGH_PRESSURE' | 'CRITICAL_PRESSURE';

/** 부채 항목 */
export interface DebtItem {
  /** 고유 식별자 (fractal-path-normalized + hash) */
  id: string;
  /** 프랙탈 경로 */
  fractal_path: string;
  /** 파일 경로 */
  file_path: string;
  /** 생성 시각 (ISO 8601) */
  created_at: string;
  /** 리뷰 브랜치 */
  review_branch: string;
  /** 원래 수정 요청 ID (FIX-001 등) */
  original_fix_id: string;
  /** 심각도 */
  severity: DebtSeverity;
  /** 현재 가중치 */
  weight: number;
  /** 후속 수정 횟수 */
  touch_count: number;
  /** 마지막 리뷰 커밋 SHA (멱등성 보호) */
  last_review_commit: string | null;
  /** 위반된 규칙 */
  rule_violated: string;
  /** 메트릭 값 */
  metric_value: string;
  /** 부채 제목 */
  title: string;
  /** 원래 수정 요청 내용 */
  original_request: string;
  /** 개발자 소명 */
  developer_justification: string;
  /** 정제된 ADR */
  refined_adr: string;
}

/** 부채 생성 시 입력 (id, weight, touch_count, last_review_commit는 자동 생성) */
export type DebtItemCreate = Omit<DebtItem, 'id' | 'weight' | 'touch_count' | 'last_review_commit'>;

/** 바이어스 계산 결과 */
export interface BiasResult {
  /** 바이어스 수준 */
  biasLevel: BiasLevel;
  /** 전체 부채 점수 */
  totalScore: number;
  /** 업데이트된 부채 목록 */
  updatedDebts: DebtItem[];
}

/** 가중치 상한선 */
export const DEBT_WEIGHT_CAP = 16;

/** 기본 가중치 */
export const DEBT_BASE_WEIGHT = 1;
