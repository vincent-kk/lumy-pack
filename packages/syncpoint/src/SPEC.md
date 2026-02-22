# syncpoint/src Specification

## Requirements

- CLI 진입점(`cli.ts`)은 모든 명령을 등록하고 Commander.js로 파싱해야 한다
- 라이브러리 API(`index.ts`)는 core 함수와 타입만 re-export한다
- `loadConfig()` — `~/.syncpoint/config.yml`을 로드하고 AJV 스키마로 검증 후 반환
- `createBackup(options)` — 설정 기반 대상 파일을 스캔하고 tar.gz 아카이브를 생성
- `restoreBackup(backupId, options)` — 아카이브를 tmpdir에 추출 후 해시 비교로 변경 파일만 복원
- `runProvision(template, options)` — 템플릿 스텝을 순서대로 실행하며 `AsyncGenerator<StepResult>`로 실시간 상태 yield
- 민감 파일(`SENSITIVE_PATTERNS`)은 명시적 opt-in 없이는 아카이브에서 제외

## API Contracts

```typescript
// index.ts re-exports
import {
  loadConfig, saveConfig, initDefaultConfig,  // core/config
  createBackup, scanTargets,                   // core/backup
  restoreBackup, getBackupList, getRestorePlan, // core/restore
  runProvision, loadTemplate, listTemplates,   // core/provision
} from '@lumy-pack/syncpoint';

// Types
import type {
  SyncpointConfig, BackupMetadata, FileEntry,
  TemplateConfig, TemplateStep,
  BackupResult, RestoreResult, RestorePlan, RestoreAction,
  StepResult, BackupOptions, RestoreOptions, ProvisionOptions,
  BackupInfo, StatusInfo,
} from '@lumy-pack/syncpoint';
```

| 함수 | 반환 타입 | 예외 조건 |
|------|-----------|-----------|
| `loadConfig()` | `Promise<SyncpointConfig>` | 파일 없음 또는 스키마 위반 시 throw |
| `createBackup(opts)` | `Promise<BackupResult>` | 대상 파일 없음, 권한 오류 시 throw |
| `restoreBackup(id, opts)` | `Promise<RestoreResult>` | 백업 ID 없음, 해시 불일치 처리 포함 |
| `runProvision(tpl, opts)` | `AsyncGenerator<StepResult>` | `curl \| sh` 패턴 감지 시 step을 error로 yield |
| `getRestorePlan(id)` | `Promise<RestorePlan>` | 변경된 파일만 RestoreAction 목록으로 반환 |

## Last Updated

2026-02-23
