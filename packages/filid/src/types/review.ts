/**
 * @file review.ts
 * @description 코드 리뷰 거버넌스 시스템의 핵심 데이터 모델 정의.
 */

/** 변경 사항의 복잡도 등급 */
export type Complexity = 'LOW' | 'MEDIUM' | 'HIGH';

/** 페르소나 식별자 */
export type PersonaId =
  | 'engineering-architect'
  | 'knowledge-manager'
  | 'operations-sre'
  | 'business-driver'
  | 'product-manager'
  | 'design-hci';

/** 체크포인트 Phase */
export type CheckpointPhase = 'A' | 'B' | 'C' | 'DONE';

/** 체크포인트 상태 */
export interface CheckpointStatus {
  /** 현재 Phase */
  phase: CheckpointPhase;
  /** 존재하는 파일 목록 */
  files: string[];
}

/** 위원회 선출 결과 */
export interface CommitteeElection {
  /** 복잡도 등급 */
  complexity: Complexity;
  /** 선출된 위원 목록 */
  committee: PersonaId[];
  /** 적대적 짝짓기 쌍 */
  adversarialPairs: [PersonaId, PersonaId[]][];
}

/** 리뷰 세션 정보 (session.md frontmatter) */
export interface ReviewSession {
  /** 원본 브랜치 이름 */
  branch: string;
  /** 정규화된 브랜치 이름 */
  normalized_branch: string;
  /** merge-base commit SHA */
  base_ref: string;
  /** 복잡도 등급 */
  complexity: Complexity;
  /** 선출된 위원 목록 */
  committee: PersonaId[];
  /** 변경 파일 수 */
  changed_files_count: number;
  /** 변경된 프랙탈 경로 목록 */
  changed_fractals: string[];
  /** 인터페이스 변경 여부 */
  interface_changes: boolean;
  /** 세션 생성 시각 (ISO 8601) */
  created_at: string;
}

/** 상태 머신 상태 */
export type StateMachineState = 'PROPOSAL' | 'DEBATE' | 'VETO' | 'SYNTHESIS' | 'ABSTAIN' | 'CONCLUSION';

/** 리뷰 최종 판정 */
export type ReviewVerdict = 'APPROVED' | 'REQUEST_CHANGES' | 'INCONCLUSIVE';
