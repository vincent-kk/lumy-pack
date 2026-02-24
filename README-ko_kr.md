# Lumy Pack

[![TypeScript](https://img.shields.io/badge/typescript-✔-blue.svg)]()
[![CLI](https://img.shields.io/badge/cli-✔-brightgreen.svg)]()
[![Tools](https://img.shields.io/badge/tools-✔-orange.svg)]()
[![Node.js](https://img.shields.io/badge/node.js-20+-green.svg)]()

---

## 개요

**Lumy Pack**은 **npm 패키지**(CLI 및 라이브러리)를 위한 모노레포입니다. 모든 것이 TypeScript로 빌드되었습니다. 이 저장소는 환경 관리부터 작업 자동화까지 개발자의 워크플로우를 간소화하고 업무를 단순화하기 위한 실용적이고 일상적인 도구들을 한 곳에 모은 장소입니다.

---

## 모노레포 구조

이 저장소는 독립적인 버전 관리 및 배포를 갖춘 여러 패키지를 호스팅합니다:

- **npm 모듈** — npm 레지스트리에 배포되며 종속성 또는 CLI로 사용됩니다.

각 패키지는 사용법, 종속성 및 예제를 포함한 자체 `README.md`를 가집니다.

### 패키지

| Package                                                      | Type          | 설명                                                                                              |
| ------------------------------------------------------------ | ------------- | -------------------------------------------------------------------------------------------------------- |
| **[`@lumy-pack/syncpoint`](./packages/syncpoint/README.md)**     | npm module | 개인 환경 동기화, 백업/복원 및 머신 프로비저닝을 위한 CLI. npm에 배포됩니다.            |
| **[`@lumy-pack/scene-sieve`](./packages/scene-sieve/README.md)** | npm module | 컴퓨터 비전을 사용하여 동영상/GIF에서 키 프레임을 추출하기 위한 CLI 및 라이브러리. npm에 배포됩니다.         |

---

## 개발 환경 설정

```bash
# 저장소 복제
dir=your-lumy-pack && git clone https://github.com/vincent-kk/lumy-pack.git "$dir" && cd "$dir"

# 종속성 설치
nvm use && yarn install && yarn build:all

# yarn 워크스페이스 사용
yarn workspace <package-name> <command>

# 테스트 실행
yarn workspace <package-name> test

# 빌드
yarn workspace <package-name> build
```

---

## 호환성

이 패키지는 ECMAScript 2022(ES2022) 구문으로 빌드되었습니다.

ES2022를 지원하지 않는 JavaScript 환경을 사용 중이라면, 이 패키지를 트랜스파일 프로세스에 포함해야 합니다.

**지원되는 환경:**

- Node.js 20.0.0 이상

**레거시 환경 지원의 경우:**
대상 환경을 위해 코드를 변환하려면 Babel 같은 트랜스파일러를 사용하세요.

---

## 버전 관리

이 프로젝트는 버전 관리 및 배포를 위해 [Changesets](https://github.com/changesets/changesets)를 사용합니다.

### Changeset 생성

패키지를 변경할 때마다 changeset을 생성하여 변경 사항을 기록하세요:

```bash
yarn changeset
```

### 릴리스

```bash
# Changeset을 기반으로 패키지 버전 업데이트
yarn changeset:version

# npm에 패키지 배포
yarn changeset:publish
```

### Changeset 가이드라인

- **patch**: 버그 수정, 문서 업데이트, 내부 리팩토링
- **minor**: 새로운 기능, 새로운 export, 하위 호환성이 있는 변경
- **major**: 주요 변경, 제거된 export, API 변경

---

## 스크립트

- `yarn build:all` — 모든 패키지 빌드
- `yarn test` — 모든 패키지에서 테스트 실행
- `yarn lint` — 코드 스타일 검사
- `yarn typecheck` — TypeScript 타입 검증
- `yarn changeset` — 새로운 changeset 생성
- `yarn changeset:version` — Changeset을 기반으로 버전 업데이트
- `yarn changeset:publish` — npm에 패키지 배포
- `yarn tag:packages <commit>` — 패키지 버전을 기반으로 모든 패키지에 대한 Git 태그 생성

---

## 라이선스

이 저장소는 MIT 라이선스 하에 제공됩니다. 자세한 내용은 [`LICENSE`](./LICENSE) 파일을 참조하세요.

---

## 연락처

프로젝트와 관련하여 질문이나 제안이 있으시면 이슈를 생성해주세요.
