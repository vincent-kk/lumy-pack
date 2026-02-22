# 기술 부채 관리 시스템

> 원본: BLUE-PRINT.md §8 | 관련: [05-GOVERNANCE.md](./05-GOVERNANCE.md), [07-DATA-STORAGE.md](./07-DATA-STORAGE.md)

## 8. 기술 부채(Debt) 관리 시스템

### 8.1 부채 파일 스키마

파일명: `<fractal-path-normalized>-<hash>.md`
- `<fractal-path-normalized>`: 프랙탈 경로의 `/` → `-` 치환 (예: `src-features-auth`)
- `<hash>`: 부채 내용의 첫 6자리 SHA-256 해시 (고유성 보장)

```markdown
---
id: <fractal-path-normalized>-<hash>
fractal_path: src/features/auth
file_path: src/features/auth/validator.ts
created_at: 2026-02-22T10:30:00Z
review_branch: feature/issue-6
original_fix_id: FIX-002
severity: HIGH
weight: 1
touch_count: 0
last_review_commit: null
rule_violated: LCOM4 >= 2
metric_value: "LCOM4=3"
---

# 기술 부채: validator.ts LCOM4 임계값 초과

## 원래 수정 요청

LCOM4=3으로 응집도 결여 임계값(2)을 초과. tokenValidator와 inputValidator로 분할 권고.

## 개발자 소명

현재 스프린트 마감이 2일 남았으며, 분할 작업은 기존 테스트 전체 수정이 필요. 다음 스프린트에서 처리 예정.

## 정제된 ADR

ADR-2026-02-22: validator.ts 모듈 분할을 다음 스프린트로 연기.
사유: 스프린트 마감 압박, 비즈니스 가치 실현 우선.
영향 범위: src/features/auth 프랙탈 내부.
예상 해소 시점: 다음 스프린트 (1일 소요 예상).
```

### 8.2 가중치 계산 알고리즘

#### 기본 공식

```
weight(debt) = base_weight × 2^(touch_count)
```

| 변수 | 설명 | 초기값 |
|---|---|---|
| `base_weight` | 부채 생성 시 기본 가중치 | 1 |
| `touch_count` | 해당 프랙탈에 대한 후속 수정 횟수 | 0 |

#### 가중치 증가 규칙

1. 부채 생성 시: `weight = 1` (base_weight × 2^0)
2. 해당 프랙탈에 첫 번째 추가 수정 발생: `weight = 2` (1 × 2^1)
3. 두 번째 추가 수정: `weight = 4` (1 × 2^2)
4. 세 번째 추가 수정: `weight = 8` (1 × 2^3)

#### 상한선

- **최대 가중치: 16** (2^4)
- 이유: 지수적 증가의 경우 5번째 수정에서 32가 되어 과도한 바이어스 발생 방지
- 상한선 도달 시 더 이상 증가하지 않으나, 부채 자체는 유지

#### 전체 부채 점수

```
total_debt_score = Σ weight(debt_i)  for all debt_i in .filid/debt/
```

### 8.3 위원회 바이어스 주입 방식

#### 컨텍스트 프롬프트 기반 주입

의장(Chairperson)의 SKILL.md에 다음 구조로 부채 정보를 주입:

```markdown
## 기존 기술 부채 현황 (위원회 바이어스)

**전체 부채 점수**: 12.0 (5건)
**판정 바이어스**: MODERATE_PRESSURE

### 부채 목록

| ID | 프랙탈 경로 | 규칙 위반 | 가중치 | 생성일 |
|---|---|---|---|---|
| src-auth-validator-a1b2c3 | src/features/auth | LCOM4≥2 | 4 | 2026-01-15 |
| src-auth-flow-d4e5f6 | src/features/auth | CC>15 | 2 | 2026-02-01 |
| src-user-model-g7h8i9 | src/features/user | 3+12 규칙 | 1 | 2026-02-10 |
| ... | | | | |

### 이번 PR 관련 부채

**src/features/auth** 프랙탈에 기존 부채 2건 (가중치 합계: 6).
이번 PR이 해당 프랙탈을 수정하므로 가중치 2배 적용됨.

### 위원회 지침

부채 점수에 따른 바이어스 수준:
- 0~5: LOW_PRESSURE — 일반적 리뷰
- 6~15: MODERATE_PRESSURE — 부채 상환 강력 권고
- 16~30: HIGH_PRESSURE — 신규 부채 발행 거의 불허
- 31+: CRITICAL_PRESSURE — 부채 상환 없이는 PR 승인 불가
```

#### 바이어스 수준별 위원회 행동

| 바이어스 수준 | 위원회 행동 | 비즈니스 드라이버 영향 |
|---|---|---|
| LOW_PRESSURE | 일반 리뷰, 부채 발행 허용 | CoD 주장 수용 가능 |
| MODERATE_PRESSURE | 부채 상환 강력 권고, 신규 부채 발행 시 엄격한 소명 요구 | CoD 주장에 정량적 근거 필수 |
| HIGH_PRESSURE | 신규 부채 발행 거의 불허, 기존 부채 1건 이상 상환 요구 | CoD 주장 사실상 기각 |
| CRITICAL_PRESSURE | 부채 상환 없이는 PR 승인 불가 | VETO 기본 |

### 8.4 부채 해소 판정 기준

#### 해소 조건

부채가 해소되려면 다음 조건을 **모두** 충족해야 한다:

1. **파일 경로 일치**: 수정된 파일이 부채의 `file_path`와 일치
2. **규칙 준수**: 해당 파일에 대해 부채가 위반했던 규칙을 재검증 시 PASS
   - 예: `LCOM4≥2` 부채 → 수정 후 `ast-analyze(lcom4)` 결과 `LCOM4<2`
   - 예: `CC>15` 부채 → 수정 후 `ast-analyze(cyclomatic-complexity)` 결과 `CC≤15`
   - 예: `3+12 규칙` 부채 → 수정 후 `test-metrics(check-312)` 결과 PASS

3. **의장 확인**: 의장(Chairperson)이 MCP tool 결과를 바탕으로 해소를 확정

#### 해소 시 동작

1. 해당 `.filid/debt/<file>.md` 파일 삭제
2. `re-validate.md`에 해소 기록 추가
3. `total_debt_score` 재계산

#### 부분 해소

- 하나의 부채가 여러 규칙 위반을 포함하는 경우는 없음 (1 부채 = 1 규칙 위반)
- 따라서 부분 해소 개념 불필요 — 해소되면 전체 삭제

### 8.5 가중치 2배 규칙 상세 메커니즘

```
code-review 실행 시:

1. .filid/debt/ 전체 로딩
2. 이번 PR에서 변경된 파일의 프랙탈 경로 추출
3. 현재 HEAD 커밋 SHA 획득 (git rev-parse HEAD)
4. for each debt in debts:
     if debt.fractal_path in changed_fractal_paths:
       if debt.last_review_commit == current_commit_sha:
         SKIP (이미 이 커밋에서 카운트됨 — 멱등성 보호)
       else:
         debt.touch_count += 1
         debt.weight = min(base_weight × 2^touch_count, 16)
         debt.last_review_commit = current_commit_sha
         debt 파일 업데이트
5. total_debt_score 재계산
6. 바이어스 수준 결정
7. 위원회에 바이어스 주입
```

**멱등성 보호**: 동일 커밋에서 `code-review`를 여러 번 실행해도 가중치가 중복 증가하지 않는다. `last_review_commit` 필드가 현재 HEAD SHA와 일치하면 가중치 업데이트를 건너뛴다.

**주의**: 가중치 업데이트는 `code-review` 실행 시에만 발생하며, `resolve-review`나 `re-validate`에서는 가중치를 변경하지 않는다.

### 8.6 부채 목록과 프랙탈 경로 매핑

```
.filid/debt/
├── src-features-auth-validator-a1b2c3.md   ← fractal_path: src/features/auth
├── src-features-auth-flow-d4e5f6.md        ← fractal_path: src/features/auth
├── src-features-user-model-g7h8i9.md       ← fractal_path: src/features/user
└── src-core-api-handler-j0k1l2.md          ← fractal_path: src/core/api
```

매핑 방식:
1. 파일명에서 프랙탈 경로 추출: `src-features-auth-validator-a1b2c3` → frontmatter의 `fractal_path` 읽기
2. 파일명 자체는 **고유 식별자** 역할만 수행 (역변환에 사용하지 않음)
3. 프랙탈 경로 매핑은 항상 frontmatter의 `fractal_path` 필드를 기준으로 수행
