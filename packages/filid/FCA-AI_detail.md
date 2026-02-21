# **프랙탈 컨텍스트 아키텍처(FCA-AI) 기반 자율형 소프트웨어 공학: 다중 에이전트 시스템의 맥락 관리 및 운영 명세 심층 분석**

대규모 언어 모델(LLM)과 자율형 AI 에이전트가 소프트웨어 엔지니어링 및 대규모 코드베이스 관리에 본격적으로 도입되면서, 아키텍처 설계의 패러다임은 근본적인 전환기를 맞이하고 있다. 하지만 모델의 물리적 컨텍스트 윈도우(Context Window)가 수백만 토큰 단위로 확장되었음에도 불구하고, 에이전트의 실질적인 추론 능력과 작업 수행 품질은 특정 임계점을 넘어서면 급격히 저하되는 현상이 지속적으로 보고되고 있다.1 이러한 현상은 '컨텍스트 부패(Context Rot)' 또는 '주의력 희석(Attention Dilution)'으로 정의되며, 에이전트의 작업 메모리 내에 관련성이 낮거나 중복되고 상충하는 과거의 로그, 도구 호출 기록, 불필요한 코드 구문이 누적될 때 필연적으로 발생한다.1 컨텍스트 부패가 진행되면 에이전트는 당면한 핵심 명령어에 집중하지 못하고 과거의 패턴에 집착하거나 심각한 환각(Hallucination) 오류를 일으키게 된다.1

이러한 물리적 토큰 한계와 논리적 인지 한계의 격차를 극복하기 위해 제안된 개념적 모델이 바로 'AI 에이전트를 위한 프랙탈 컨텍스트 아키텍처(Fractal Context Architecture for AI Agents, 이하 FCA-AI)'이다.1 단순한 프롬프트 엔지니어링을 넘어선 이 아키텍처는 컨텍스트를 단순한 무한대의 문자열 버퍼로 취급하는 관행에서 벗어나, 시스템의 디렉토리 구조, 문서의 계층, 그리고 테스트 코드를 공간적이고 시간적인 제약 하에 동기화하는 '컴파일된 뷰(Compiled View)'로써 다루는 시스템 공학적 접근법을 취한다.1

본 보고서는 FCA-AI를 기반으로 작동하는 다중 에이전트 시스템의 핵심을 해부한다. 구체적으로 CLAUDE.md와 SPEC.md 문서의 형태와 구조, test.ts와 spec.ts의 수명 주기 관리, 사용자 요청 및 수동 코드 수정에 따른 추상 구문 트리(AST) 기반 맥락 문서 동기화 기술, 초기 대규모 저장소 순회 전략, 풀 리퀘스트(PR) 평가 규칙, 그리고 이러한 복잡한 일련의 작업을 수행하는 하위 에이전트(Sub-agent)들의 역할과 책임을 심층적으로 직조하여 논의한다.

## **1\. 프랙탈 구획화 및 맥락 문서의 형태와 구조적 제약**

FCA-AI의 근본적인 철학은 전체 시스템의 코드베이스를 논리적 의미를 지니는 독립적인 단위로 구획하고, 각 단위가 스스로의 의도와 상태를 자가 설명(Self-describing)할 수 있도록 구조화하는 데 있다.1 이를 달성하기 위해 아키텍처는 시스템의 디렉토리와 모듈을 '프랙탈(Fractal)'과 '부속품(Organ)'이라는 두 가지 계층으로 엄격히 공간적으로 분리한다.1 프랙탈은 독립적인 비즈니스 로직이나 완결된 사용자 인터페이스(UI) 흐름을 가지는 도메인 경계(Bounded Context)로 정의되며, 전체 시스템을 구성하는 아키텍처의 핵심 노드 역할을 수행한다.1 반면 부속품은 프랙탈 내부에 종속되어 존재하는 컴포넌트, 유틸리티, 타입 등의 디렉토리로 프랙탈을 구동하기 위한 내부 부품에 해당한다.1

가장 중요한 아키텍처적 제약은 부속품 계층에는 독자적인 맥락 파일(CLAUDE.md)을 부여하지 않는다는 점이다.1 에이전트가 모든 유틸리티 함수나 단순 컴포넌트의 파편화된 맥락을 각각 읽어들이게 되면, 컨텍스트의 파편화와 중복이 발생하여 추론의 품질이 하락하기 때문이다.1 예외적으로 외부 의존성 없이 인터페이스만으로 기능이 완벽히 설명되는 순수 함수는 프랙탈이라 하더라도 맥락 파일을 생략하여 컨텍스트의 밀도를 극대화한다.1 이러한 공간적 구획화 위에서, 프랙탈 노드에는 에이전트의 인지를 돕는 두 가지 형태의 핵심 문서인 CLAUDE.md와 SPEC.md가 배치된다.

### **1.1. 의도와 아키텍처 히스토리의 응집체: CLAUDE.md**

CLAUDE.md 파일은 프랙탈의 진입점에 위치하며, 소스 코드의 추상 구문 트리(AST)만으로는 파악할 수 없는 개발자의 '의도'와 아키텍처 결정의 '히스토리'를 저장하는 공간이다.1 LLM은 본질적으로 상태를 갖지 않는(Stateless) 함수이므로, 에이전트가 새로운 세션을 시작할 때마다 프로젝트의 기술 스택, 디렉토리 구조, 그리고 코딩 규칙을 학습시키기 위해 이 파일이 매번 로드된다.5

효율적인 컨텍스트 관리를 위해 CLAUDE.md는 최대 100줄 이하로 유지되어야 한다는 강력한 길이 제약을 받는다.1 이 제약은 모델의 주의력 희석을 막기 위한 필수적인 안전장치이며, 상위 프랙탈의 정보를 하위 프랙탈에 중복 기입하지 않는 데이터 정규화(Deduplication) 원칙을 통해 달성된다.1 문서의 구조는 일관성을 띄어야 하며, 실행 가능한 명령어(테스트, 빌드, 린트 명령어), 프로젝트 구조, 그리고 명확한 코드 스타일 스니펫이 포함되어야 한다.6

특히 CLAUDE.md는 에이전트의 행동 반경을 제어하기 위해 3계층 경계(Three-Tier Boundaries) 시스템을 도입하여 규칙을 서술해야 한다.6 '항상 해야 할 일(Always do)'은 커밋 전 테스트 실행과 같은 필수 규범을 정의하고, '먼저 물어봐야 할 일(Ask first)'은 데이터베이스 스키마 변경이나 외부 의존성 추가와 같이 파급력이 커서 인간의 승인이 필요한 영역을 규정하며, '절대 해서는 안 될 일(Never do)'은 비밀키 커밋이나 벤더 디렉토리(node\_modules 등) 직접 수정과 같은 하드 스톱(Hard stop) 제약을 명시한다.6

형제 프랙탈 간의 수평적 참조(Horizontal Dependency)가 발생할 때 CLAUDE.md는 도메인 주도 설계(DDD)의 '공개 언어(Published Language)' 모델로 기능한다.1 프랙탈 A의 에이전트가 프랙탈 B의 기능을 참조해야 할 때, 에이전트 A는 프랙탈 B의 내부 구현 파일이나 부속품 소스 코드를 자신의 컨텍스트 윈도우로 직접 로드해서는 안 된다.1 대신 프랙탈 B가 외부에 자신의 핵심 논리와 인터페이스만을 압축하여 제공하는 CLAUDE.md 파일만을 지연 로딩(Lazy Loading) 방식으로 획득함으로써, 레거시 데이터나 이질적인 규칙이 신규 작업 공간으로 침투하는 것을 막는 에이전트 기반 충돌 방지 계층(Agentic Anti-Corruption Layer, ACL)을 형성한다.1

### **1.2. 지속적 압축과 명세 주도 개발의 원천: SPEC.md**

CLAUDE.md가 메타데이터와 의도를 제공한다면, 이와 링크로 연결되는 SPEC.md는 모듈의 상세 기능 명세를 담고 있는 문서이다.1 명세 주도 개발(Spec-Driven Development, SDD) 방법론 내에서 SPEC.md는 코드를 작성한 후 남기는 사후 문서가 아니라, 코드를 생성해 내는 '진실의 원천(Source of Truth)'이자 살아있는 실행 가능한 아티팩트(Living, executable artifact)로 취급된다.6 코드는 단지 명세를 구현한 파생물일 뿐이며, 에이전트가 코드를 탐색하다 길을 잃었을 때 기준점이 되는 닻(Anchor)의 역할을 한다.6

SPEC.md 문서는 길이 제한을 받지 않지만, 컨텍스트 부패를 막기 위해 정보가 단순히 하단에 누적(Append-only)되는 것을 엄격히 금지하며 항상 최신 상태의 로직만을 반영하도록 지속적으로 압축(Compressed)되어야 한다.1 이 압축 과정에서 시스템은 두 가지 고도화된 기법을 병행한다. 첫 번째는 '가역적 압축(Reversible Compaction)'이다. 에이전트가 500줄의 코드 파일을 작성했을 때 그 전체 내용을 명세나 대화 이력에 남기는 대신, 파일의 절대 경로와 참조 메타데이터만을 남겨 토큰을 절약하면서도 필요시 언제든 100% 원상 복구가 가능하도록 조치한다.1 두 번째는 '손실 요약(Lossy Summarization)'이다. 에이전트가 한계 토큰을 초과하여 장기 세션을 이어갈 때, 오래된 도구 호출 이력, 실패한 디버깅 로그, 중간 추적 내역 등을 구조화된 JSON 형태로 병합하여 핵심 의미만을 보존하고 노이즈를 영구적으로 제거한다.1

| 분류 항목 | CLAUDE.md (맥락 및 의도 문서) | SPEC.md (상세 명세 문서) |
| :---- | :---- | :---- |
| **핵심 목적** | 개발자 의도, 아키텍처 히스토리, 도메인 경계 규정 | 기능적 명세, API 계약, 실행 가능한 요구사항 |
| **길이 및 제약** | 최대 100줄 이하 (엄격한 밀도 통제) | 길이 제한 없음 (단, 최신화 및 구조적 압축 필수) |
| **수평적 통신** | 외부 모듈 참조 시 공개 언어(Published Language) 및 ACL 역할 수행 | 내부 모듈의 정밀 구현 및 검증을 위한 세부 지침 |
| **관리 및 최적화** | 데이터 정규화(Deduplication), 지연 로딩(Lazy Loading), 3계층 경계 | 가역적 압축(Reversible Compaction), 손실 요약(Lossy Summarization) |

## **2\. 테스트 주도 아키텍처와 3+12 규칙에 따른 승격(Promotion) 로직**

에이전트가 자율적으로 코드베이스를 진화시키기 위해서는 인간의 직관을 대체할 수 있는 정량적이고 수학적인 구조 통제 알고리즘이 필요하다. FCA-AI 아키텍처는 이를 위해 테스트 코드를 기능 검증 도구에서 아키텍처 복잡도 측정 및 상태 제어 도구로 격상시켰다. 이 체계 내에서 ./\_\_tests\_\_ 디렉토리 내의 파일은 목적에 따라 명세 테스트인 .spec.ts와 회귀 및 QA 테스트인 .test.ts로 엄격하게 분리된다.1

### **2.1. 복잡도 한계 통제를 위한 3+12 규칙**

특정 컴포넌트가 무한정 비대해지는 것을 방지하기 위해, 모든 .spec.ts 파일은 '3+12 규칙(3+12 Rule)'이라는 구조적 하드 리밋(Hard Limit)을 적용받는다.1 이는 하나의 명세 파일 내에 핵심 동작을 정의하는 3개의 기본 테스트와 엣지 케이스를 검증하는 최대 12개의 복잡한 테스트, 즉 총 15개의 테스트 케이스만을 허용하는 임계값이다.1

이 15개의 임계값을 초과하는 순간, 에이전트는 해당 프랙탈이 단일 책임 원칙(Single Responsibility Principle, SRP)을 명백히 위배하여 과도한 복잡성을 띄게 되었다고 판단하고 아키텍처 개입 파이프라인을 가동한다.1 이때 에이전트가 직면하는 문제는 해당 컴포넌트의 내부 로직을 재배치하는 '압축(Compression)'을 수행할 것인지, 아니면 완전히 독립된 하위 프랙탈로 쪼개는 '분할(Splitting)'을 수행할 것인지를 결정하는 것이다.1

이 결정은 두 가지 정량적 소프트웨어 공학 지표를 통해 자율적으로 이루어진다. 첫째, 에이전트는 해당 모듈의 AST를 분석하여 의존성 그래프를 그리고, '메소드 응집도 결여(Lack of Cohesion of Methods, LCOM4)' 지표를 계산한다.1 서로 데이터나 로직을 공유하지 않는 분절된 덩어리가 존재하여 LCOM4 값이 2 이상으로 도출될 경우, 이는 이질적 로직의 혼재를 의미하므로 에이전트는 무조건 클래스 추출을 통한 '신규 하위 프랙탈 창출(Splitting)'을 지시한다.1 반대로 LCOM4 값이 1을 유지하여 응집도는 높지만, '순환 복잡도(Cyclomatic Complexity, CC)'가 15를 초과하는 경우에는 제어 흐름이 지나치게 꼬인 상태이므로 '메서드 추출'이나 다형성(Polymorphism)을 적용하는 '로직 압축(Compression)'을 수행한다.1

### **2.2. 회귀 테스트(.test.ts)의 수명 주기와 승격(Promotion) 알고리즘**

테스트 주도 개발(TDD) 기반의 에이전트 워크플로우에서 버그 픽스나 새로운 요구사항이 발생하면 에이전트는 반드시 실패하는 테스트를 먼저 작성(Red 단계)하고, 이를 통과하는 코드를 구현(Green 단계)한 뒤 리팩토링하는 사이클을 거친다.12 이 과정에서 발견된 결함이나 특정 엣지 케이스를 방어하기 위한 임시 코드들은 모두 .test.ts (회귀 테스트) 파일에 저장된다.1

그러나 방대한 회귀 테스트가 영구적으로 보존되면 에이전트의 구문 분석 토큰을 낭비하고 빌드 파이프라인의 속도를 저하시킨다. 이를 해결하기 위해 에이전트 시스템은 '테스트 승격(Promotion)'이라는 수명 주기 관리 알고리즘을 백그라운드에서 실행한다.1 에이전트는 특정 .test.ts 파일이 3개월 등 사전 정의된 안정화 기간 동안 단 한 번의 실패 없이 회귀 검증을 통과하는지 모니터링한다.1 안정성이 수학적으로 증명된 테스트는 일회성 방어 코드가 아니라 모듈의 근본적인 성질로 인정된다. 이때 에이전트는 중복되는 여러 회귀 테스트 케이스들을 데이터 주도형(Data-driven)의 파라미터화(Parameterized)된 단일 테스트로 압축하고, 이를 .spec.ts 문서로 이관(승격)시킨 뒤 원본 .test.ts 파일을 코드베이스에서 완전히 삭제한다.1 이 동적인 정리 작업은 테스트 스위트의 품질을 극대화하고 에이전트가 참조해야 할 컨텍스트 부하를 최소화한다.

## **3\. 초기 맥락 구축을 위한 대규모 프랙탈 순회 및 조립 전략**

새로운 레거시 시스템이나 방대한 크기의 저장소에 AI 에이전트 시스템이 최초로 투입될 때, 전통적인 텍스트 검색 도구처럼 파일 시스템의 루트 디렉토리부터 하향식으로 모든 코드를 스캔하는 것은 치명적인 오류를 낳는다.1 이러한 접근은 에이전트의 컨텍스트 윈도우를 의미 없는 유틸리티 코드나 외부 라이브러리로 가득 채워, 장기 추론 능력의 붕괴를 초래하기 때문이다.15 따라서 FCA-AI는 추상 구문 트리(AST) 파싱과 의존성 그래프에 기반한 다중 에이전트 순회 전략을 채택하여 맥락 문서를 상향식으로 조립한다.16

### **3.1. 위상 정렬을 통한 의존성 최우선(Dependencies First) 순회**

초기화 프로세스의 핵심은 논리적 의존성 구조를 파악하는 데 있다. 시스템 내비게이터(Navigator) 에이전트는 소스 코드 전체를 대상으로 Tree-sitter와 같은 구문 분석 도구를 활용하여 추상 구문 트리(AST)를 추출하고, 클래스 상속 및 함수 호출 관계를 추적하여 거대한 방향성 비순환 그래프(Dependency DAG)를 구축한다.16

문서 생성 및 순회는 이 그래프를 바탕으로 위상 정렬(Topological Sorting)을 수행하여 '의존성 최우선(Dependencies First)' 원칙을 엄격하게 따른다.16 이는 외부 의존성이 전혀 없는 최하단의 부속품(Leaf Node)이나 독립된 순수 프랙탈에서부터 시작하여, 상위 호출자 방향인 루트(Root)를 향해 상향식(Bottom-up)으로 올라가며 맥락 문서를 생성함을 의미한다.1 특정 상위 프랙탈의 CLAUDE.md와 SPEC.md를 작성할 시점이 되면 하위 모듈들의 기능이 이미 요약 및 문서화되어 있으므로, 문서 작성 에이전트는 무한한 배경 지식 탐색의 늪에 빠지지 않고 자신이 담당하는 현재 노드의 비즈니스 로직에만 집중할 수 있게 된다.16

### **3.2. 기업 아키텍처 연동 및 모델 컨텍스트 프로토콜(MCP) 주입**

초기 맥락은 소스 코드에만 한정되지 않는다. 기업 환경에서는 Jira, Confluence, 슬랙 논의 내역 등 코드 외부에 흩어진 지식을 통합해야만 완벽한 의도 추론이 가능하다.18 이른바 NxM 통합 문제(다수의 모델과 다수의 데이터 소스 간의 연결 난제)를 해결하기 위해, 에이전트 시스템은 '모델 컨텍스트 프로토콜(MCP, Model Context Protocol)' 서버를 활용한다.1

순회 과정 중 지식 그래프 구축을 담당하는 Context Manager 에이전트는 MCP 클라이언트로서 사내 다양한 MCP 서버(문서 서버, 지식 그래프 서버 등)에 접근한다.20 에이전트는 특정 프랙탈의 도메인 경계를 식별할 때 MCP를 통해 레거시 제품 요구사항 문서(PRD)나 API 계약 문서를 쿼리하여 가져오고, 이를 정제된 지식으로 압축하여 최초의 SPEC.md에 주입한다.18 이 거대한 병렬 순회가 끝나면 시스템은 파편화된 코드의 집합이 아니라, 프랙탈 단위로 의도와 명세가 완벽하게 결합된 전사적 지식 그래프(AI Context Skyscraper)를 보유하게 된다.22

## **4\. 수동 코드 수정에 대응하는 AST 기반 맥락 문서 동기화 기술**

AI가 주도하는 생태계 내에서도 인간 개발자의 수동 개입은 긴급한 보안 패치나 고도의 알고리즘 최적화를 위해 빈번하게 발생한다.23 그러나 인간이 코드만 수정하고 관련 CLAUDE.md와 SPEC.md를 갱신하지 않을 경우, 시스템은 코드 구현체와 명세 사이의 치명적인 상태 불일치(Drift)를 겪게 되며, 이는 후속 AI 작업 시 심각한 환각 오류를 유발한다.25 FCA-AI는 이러한 문제를 해결하기 위해 전통적인 텍스트 라인 기반의 Diff 대신, 의미론적 코드 변경을 감지하는 추상 구문 트리(AST) 기반의 동기화 파이프라인을 운영한다.27

### **4.1. Tree-sitter와 AST를 결합한 의미론적 파급 반경(Blast Radius) 추론**

일반적인 버전 관리 시스템(예: Git)의 텍스트 기반 Diff는 코드를 문자열로 취급하여 변경된 줄(+/-)만을 보여준다.27 이는 변수명의 단순 변경, 줄바꿈, 들여쓰기와 같은 비구조적 변경과 실제 비즈니스 로직의 수정을 에이전트가 명확히 구분하지 못하게 만들어 막대한 인지 노이즈를 발생시킨다.27

이를 타개하기 위해 에이전트 시스템은 '의미론적 구문 파싱(Semantic Code Indexing)'을 수행한다.28 구체적으로, 코드의 논리적 구조를 대변하는 AST와 구문 및 띄어쓰기 등 소스 코드의 원형을 100% 보존하는 Tree-sitter 트리를 결합하여 사용한다.28 Context Manager 에이전트는 인간이 수정한 커밋 발생 전후의 Tree-sitter 트리를 비교하여 노드 간의 트리 차이(Tree Diff)를 도출한다.27 이를 통해 단순한 포맷팅 변경은 무시하고, 예외 처리 블록의 확장, 새로운 API 호출 추가, 조건문 로직의 변경 등 시스템의 의도가 변경된 '의미론적 파급 반경(Blast Radius)'만을 정확하게 식별해 낸다.31

### **4.2. 문맥 역전파(Backpropagation)와 문서의 자율적 갱신**

의미론적 변경이 감지되면 에이전트는 즉각적인 문서 동기화 사이클을 가동한다.25 먼저, 수정된 코드가 포함된 리프 노드의 기능 변경 사항을 바탕으로 해당 프랙탈의 SPEC.md 파일의 상세 명세와 API 인터페이스 정보를 갱신한다.25

만약 이 변경이 단일 함수 내부의 최적화에 그치지 않고, 프랙탈 간의 의존성 구조나 허용된 도메인 경계를 변화시켰다면(예: 새로운 인증 프로토콜 연동 등), 에이전트는 이 변경 의도를 CLAUDE.md의 메타데이터와 히스토리 섹션으로 역전파(Backpropagation)하여 수정한다.24 나아가 해당 모듈을 지연 로딩(Lazy Loading)으로 참조하고 있는 모든 상위 계층 프랙탈의 문서에도 연쇄적인 업데이트가 필요함을 분석하고 자동 변경 PR을 제안한다.24 이 과정을 통해 인간 개발자는 문서 작성의 부담에서 해방되며, 코드와 맥락 문서 간의 100% 동기화율이 기계적으로 보장된다.

## **5\. 다중 에이전트 협업 체계: 하위 에이전트(Sub-agent)의 역할, 스킬 및 도구 명세**

FCA-AI 아키텍처의 복잡한 맥락 관리와 코드 구현을 단일한 범용 AI 모델(Generalist)에게 전담시키는 것은 프롬프트 지시 사항 간의 충돌과 컨텍스트 윈도우 오버플로우를 유발한다.32 따라서 시스템은 계층형 다중 에이전트 아키텍처(HMAS) 원리에 따라, 특정 도메인과 도구에 특화된 '단기 하위 에이전트(Ephemeral Sub-agent)' 생태계를 동적으로 생성하고 오케스트레이션(Orchestration)한다.1

하위 에이전트들은 각자 메인 에이전트와 완벽히 분리된 \*\*고립된 컨텍스트 윈도우(Isolated Context Window)\*\*를 할당받아 작업을 수행하며, 임무가 완료되면 결과 데이터만을 반환하고 즉시 소멸하여 메인 작업 공간의 맥락 오염과 환각 누출을 구조적으로 차단한다.1 각 하위 에이전트는 부여받은 역할(Role)에 따라 접근할 수 있는 도구(Tools)와 보유한 스킬(Skills)이 엄격하게 제한된다.

| 에이전트 구분 | 주요 역할 및 책임 (Roles & Responsibilities) | 허용 도구 및 스킬 (Tools & Skills) | 작업 동작 및 운영 제약 |
| :---- | :---- | :---- | :---- |
| **Architect** (설계/계획자) | 요구사항 분석, 프랙탈 아키텍처 설계, SPEC.md 초안 작성 및 모듈 분할/압축 여부 판별 | Plan Mode 동작, MCP(Figma, 문서 서버 등), AST 구조 분석 스킬 | 파일 변경(Write/Edit) 권한이 영구 박탈된 읽기 전용 상태로 운영되며, 설계의 타당성 검토에 주력 35 |
| **Implementer** (구현자) | Architect가 승인한 SPEC.md의 제약 내에서 실제 코드를 작성하고 TDD 루프(작성-실행-수정)를 반복 | 터미널(Bash), 파일 편집(Write, Edit), Tree-sitter 렌더링 도구 | 승인된 명세를 벗어난 독단적인 아키텍처 변경이나 외부 프랙탈 영역 침투가 원천 금지됨 37 |
| **Context Manager** (맥락 관리자) | 프랙탈 순회 시 지식 그래프 구축, 인간의 수동 수정에 대한 AST 파싱, 문맥 역전파 및 가역적 압축/손실 요약 수행 | git diff, RAG 검색 도구, 텍스트 추상화 및 JSON 병합 스킬 | 애플리케이션의 비즈니스 로직에는 관여하지 않고, 오직 코드와 문서 계층 간의 상태 무결성 유지만 책임짐 38 |
| **QA / Reviewer** (품질/검토자) | 3+12 규칙 모니터링, LCOM4 및 순환 복잡도(CC) 계산, 보안 및 린트 검사, PR 검토 파이프라인 집행 | 정적 분석기(Linter), 회귀 테스트 프레임워크, 코드 커버리지 스캐너 | 직접 코드를 수정하지 않고, 오류를 감지하면 구체적인 실패 원인과 피드백 패킷을 Implementer에게 반환함 37 |

이러한 특화된 하위 에이전트 간의 통신은 문자열 텍스트 형태가 아니라 Agent-to-Agent(A2A) 프로토콜이나 MCP를 통해 구조화된 데이터 형태로 교환되므로, 전체 시스템은 하나의 교향악단처럼 조화롭게 구동된다.1

## **6\. 자율형 PR 생성 및 다차원 평가(Evaluation) 규칙 체계**

다중 에이전트 시스템이 생산해낸 코드와 수정된 맥락 문서를 메인 브랜치에 안전하게 병합하기 위해, FCA-AI는 매 커밋 단계의 동기화가 아닌 풀 리퀘스트(Pull Request, PR) 시점의 일괄 동기화(Batch Sync)를 강제한다.1 매번 컨텍스트를 동기화하는 것은 시스템 리소스 낭비이자 일시적 오류가 문맥에 스며드는 원인이 되기 때문이다.1 PR이 생성되면, 시스템은 인간 검토자가 개입하기 전에 엄격한 6단계의 자율 검증 및 평가(Evaluation) 체크리스트를 실행한다.42

1. **사전 검토 자동화 게이트 (Pre-Review Automated Gates):** 문법적 오류, 기본적인 린트(Lint) 위반, 명백한 타입 에러를 결정론적 도구(예: ruff, mypy 등)를 통해 즉각 필터링하여 인지적 낭비를 막는다.42  
2. **맥락 및 의도 무결성 검증 (Codebase Context Analysis):** QA/Reviewer 에이전트가 AST 기반 Diff를 생성하여, 변경된 구현체가 SPEC.md의 기능 명세와 CLAUDE.md의 3계층 경계 원칙(Always/Ask/Never)을 완벽히 준수했는지 LLM-as-Judge 방식으로 평가한다.6  
3. **테스트 및 정책 강제 (Policy and Standards Enforcement):** 새로 도입된 로직에 대한 .spec.ts 테스트가 100% 통과하는지, 그리고 해당 프랙탈의 테스트 케이스가 3+12 규칙(15개 임계값)을 초과하여 분할/압축 리팩토링이 필요한 것은 아닌지를 검사한다.1 더불어 하드코딩된 비밀 키 등 보안 위반 사항을 스캔한다.40  
4. **문서 압축률 및 동기화 커버리지 확인:** 코드가 수정된 만큼 관련된 모든 상/하위 프랙탈의 CLAUDE.md 및 SPEC.md가 가역적 압축을 거쳐 최신화되었는지 상태 일치 여부를 검증한다.1  
5. **리스크 기반 분류 및 라우팅 (Risk Classification and Routing):** 에이전트 내부의 예측 모델이 판단한 확신도가 임계값 미만이거나, 데이터베이스 스키마와 같은 핵심 도메인이 변경된 고위험 PR의 경우, 즉각 수동 검토 플래그를 부착하여 시니어 인간 개발자에게 알림을 발송(Routing)한다.42  
6. **결과 요약 및 승인 기록 (Auditability and Merge Decision):** 모든 단계가 성공적으로 통과되면, 에이전트는 PR 설명란에 변경 사항에 대한 요약, 구조적 다이어그램, 테스트 및 문서 갱신 로그를 마크다운 형식으로 작성하여 감사(Audit) 트레일을 확립한다.24

이러한 다차원 평가 파이프라인은 PR의 검토 시간을 며칠에서 단 몇 시간 수준으로 압축하며, 인간 개발자가 단순한 오타 검증이 아닌 고차원적인 아키텍처 의사결정에만 집중할 수 있게 한다.46

## **7\. 사용자 인터랙티브 질의 프로토콜 및 SPEC 업데이트 제어 기술**

코드베이스의 생명 주기를 유지함에 있어 가장 빈번하게 발생하는 인간과 AI의 접점은 사용자가 직접 새로운 명세를 요구하거나, AI가 변경 의도를 확신하지 못해 인간에게 질문을 던지는 상황이다.1 이 과정에서 에이전트가 사소한 내용까지 끊임없이 질문하게 되면, 사용자는 개발자에서 단순 검토자로 전락하여 심각한 '수정 피로도(Fix Fatigue)'와 '외생적 인지 부하(Extraneous Cognitive Load)'를 겪게 된다.1 FCA-AI는 이를 방지하기 위해 능동적 학습 전략과 인터랙티브 질의 통제 프로토콜을 구현한다.

### **7.1. 능동적 학습(Active Learning)과 객관식 제약 프로토콜**

에이전트는 사용자의 의도를 추론할 때 백지 상태에서 문장을 생성하게 만드는 개방형 질문(Open-ended Prompt)을 지양한다.1 시스템은 기계 학습의 '능동적 학습' 기법을 도입하여, 에이전트 내부의 '의도 확신도 점수(Uncertainty Sampling)'가 낮거나 다수의 백그라운드 모델 간 해석이 크게 엇갈릴 때(Committee-based Querying)에 한해서만 질의를 발생시킨다.1

질의가 트리거되면, 에이전트는 코드의 맥락을 '분할-조립(Decomposition)' 방식으로 선행 요약한 뒤, 자신이 도출한 3\~4개의 가장 그럴듯한 '의도 가설(Hypotheses)'을 생성하여 직관적인 객관식 메뉴(Bounded Choices) 형태로 렌더링한다.1 예를 들어, "코드 변경 의도가 무엇입니까?"가 아니라 "\[A\] 성능 최적화, 신규 인터페이스 연동, \[C\] 보안 패치" 중 하나를 클릭하도록 유도함으로써 사용자의 문맥 전환 비용을 대폭 삭감한다.1

### **7.2. 3-Prompt Limit 메커니즘과 명세-어서션 자동화**

사용자가 에이전트에게 SPEC.md의 업데이트를 지시할 때, 모호한 지시로 인해 양측의 대화가 끝없이 길어지는 프롬프트 소용돌이(Prompt Spiral) 현상을 차단해야 한다. 이를 위해 아키텍처는 단일 명세 파악을 위해 최대 3번의 대화 턴(Turn)까지만 허용하는 '3회 질의 제한(Three-Prompt Limit)' 규칙을 강제한다.1 3회 이내에 명확한 지시가 확립되지 않으면 시스템은 대화를 강제 종료하고 수동 리뷰 모드로 전환한다.

반대로 대화를 통해 의도가 확정되면, Context Manager는 즉시 SPEC.md를 갱신한다.1 이와 동시에 Implementer 에이전트는 단순한 텍스트 갱신에 머무르지 않고, 확정된 의도를 수학적으로 증명하기 위해 '의도 기반 어서션(Intent-Driven Assertions)'을 포함한 .spec.ts 테스트 코드를 즉석에서 생성하여 제안한다.1 사용자는 자신이 선택한 객관식 의도가 정확히 테스트 코드로 작성되었는지만 시각적으로 검증 및 승인하면 되며, 이를 바탕으로 인간과 에이전트 간의 완벽한 저마찰(Low-friction) 맥락 동기화 루프가 완성된다.1

## **결론**

프랙탈 컨텍스트 아키텍처(FCA-AI)는 다가오는 초거대 AI 시대에 자율형 코딩 에이전트가 방대한 엔터프라이즈 환경에서 환각과 컨텍스트 오버플로우 없이 소프트웨어를 안정적으로 진화시킬 수 있는 가장 강력한 청사진을 제공한다.

본 분석을 통해 규명된 바와 같이, 무분별하게 팽창하던 문서와 코드는 '프랙탈과 부속품'이라는 공간적 분리를 통해 통제되며, CLAUDE.md와 SPEC.md는 지연 로딩과 가역적 압축 기술을 통해 에이전트의 인지 밀도를 극대화하는 정교한 뷰(View)로 작동한다. 아울러 3+12 규칙에 기반한 엄격한 테스트 수명 주기 관리와 AST 분석을 통한 의미론적 동기화, 그리고 각자의 격리된 메모리를 바탕으로 오케스트레이션되는 하위 에이전트 생태계의 유기적인 결합은, 개발자의 인지적 피로도를 극단적으로 낮추면서도 시스템의 기계적 무결성을 100% 담보한다. 이러한 다차원적이고 정량적인 명세와 통제 규칙의 확립은 AI 기반 소프트웨어 공학이 불완전한 자동화를 넘어 진정한 자율성(Autonomy)의 궤도로 진입하기 위한 필수불가결한 초석이 될 것이다.

#### **참고 자료**

1. FCA-AI 아키텍처 심층 리서치 및 해결 방안  
2. Context Engineering for AI Agents: Part 2 \- Philschmid, 2월 21, 2026에 액세스, [https://www.philschmid.de/context-engineering-part-2](https://www.philschmid.de/context-engineering-part-2)  
3. Context engineering with OpenAI: How enterprises make AI agents production-ready, 2월 21, 2026에 액세스, [https://fractal.ai/blog/context-engineering-openai](https://fractal.ai/blog/context-engineering-openai)  
4. Architecting efficient context-aware multi-agent framework for production, 2월 21, 2026에 액세스, [https://developers.googleblog.com/architecting-efficient-context-aware-multi-agent-framework-for-production/](https://developers.googleblog.com/architecting-efficient-context-aware-multi-agent-framework-for-production/)  
5. Writing a good CLAUDE.md | HumanLayer Blog, 2월 21, 2026에 액세스, [https://www.humanlayer.dev/blog/writing-a-good-claude-md](https://www.humanlayer.dev/blog/writing-a-good-claude-md)  
6. How to write a good spec for AI agents \- Addy Osmani, 2월 21, 2026에 액세스, [https://addyosmani.com/blog/good-spec/](https://addyosmani.com/blog/good-spec/)  
7. Creating the Perfect CLAUDE.md for Claude Code \- Dometrain, 2월 21, 2026에 액세스, [https://dometrain.com/blog/creating-the-perfect-claudemd-for-claude-code/](https://dometrain.com/blog/creating-the-perfect-claudemd-for-claude-code/)  
8. Spec-Driven Development: When Intent Becomes the Source Code | by Deepak Babu Piskala | Feb, 2026, 2월 21, 2026에 액세스, [https://medium.com/@prdeepak.babu/spec-driven-development-when-intent-becomes-the-source-code-3af39f86b9d3](https://medium.com/@prdeepak.babu/spec-driven-development-when-intent-becomes-the-source-code-3af39f86b9d3)  
9. Diving Into Spec-Driven Development With GitHub Spec Kit \- Microsoft for Developers, 2월 21, 2026에 액세스, [https://developer.microsoft.com/blog/spec-driven-development-spec-kit](https://developer.microsoft.com/blog/spec-driven-development-spec-kit)  
10. Spec-Driven Development with AI Agents: From Build to Runtime Diagnostics \- Medium, 2월 21, 2026에 액세스, [https://medium.com/@dave-patten/spec-driven-development-with-ai-agents-from-build-to-runtime-diagnostics-415025fb1d62](https://medium.com/@dave-patten/spec-driven-development-with-ai-agents-from-build-to-runtime-diagnostics-415025fb1d62)  
11. Evaluating Context Compression for AI Agents | Factory.ai, 2월 21, 2026에 액세스, [https://factory.ai/news/evaluating-compression](https://factory.ai/news/evaluating-compression)  
12. A Guide to Test-Driven Development (TDD) with Real-World Examples \- Medium, 2월 21, 2026에 액세스, [https://medium.com/@dees3g/a-guide-to-test-driven-development-tdd-with-real-world-examples-d92f7c801607](https://medium.com/@dees3g/a-guide-to-test-driven-development-tdd-with-real-world-examples-d92f7c801607)  
13. Test Driven Development Custom Agent \- GitHub Gist, 2월 21, 2026에 액세스, [https://gist.github.com/pierceboggan/c5653332c523a3765192cdeaa93c8554](https://gist.github.com/pierceboggan/c5653332c523a3765192cdeaa93c8554)  
14. I got obsessed with making AI agents follow TDD automatically : r/ClaudeCode \- Reddit, 2월 21, 2026에 액세스, [https://www.reddit.com/r/ClaudeCode/comments/1mjg1m1/i\_got\_obsessed\_with\_making\_ai\_agents\_follow\_tdd/](https://www.reddit.com/r/ClaudeCode/comments/1mjg1m1/i_got_obsessed_with_making_ai_agents_follow_tdd/)  
15. Prometheus: Towards Long-Horizon Codebase Navigation for Repository-Level Problem Solving \- arXiv, 2월 21, 2026에 액세스, [https://arxiv.org/html/2507.19942v2](https://arxiv.org/html/2507.19942v2)  
16. DocAgent: A Multi-Agent System for Automated Code Documentation Generation \- arXiv, 2월 21, 2026에 액세스, [https://arxiv.org/html/2504.08725v1](https://arxiv.org/html/2504.08725v1)  
17. DocAgent: A Multi-Agent System for Automated Code Documentation Generation \- arXiv, 2월 21, 2026에 액세스, [https://arxiv.org/html/2504.08725v2](https://arxiv.org/html/2504.08725v2)  
18. The Model Context Protocol: The Architecture of Agentic Intelligence | by Greg Robison, 2월 21, 2026에 액세스, [https://gregrobison.medium.com/the-model-context-protocol-the-architecture-of-agentic-intelligence-cfc0e4613c1e](https://gregrobison.medium.com/the-model-context-protocol-the-architecture-of-agentic-intelligence-cfc0e4613c1e)  
19. Model Context Protocol (MCP): Turning Enterprise Architecture Into AI-Ready Intelligence, 2월 21, 2026에 액세스, [https://bizzdesign.com/blog/model-context-protocol-mcp-turning-enterprise-architecture-ai-ready-intelligence](https://bizzdesign.com/blog/model-context-protocol-mcp-turning-enterprise-architecture-ai-ready-intelligence)  
20. Advancing Multi-Agent Systems Through Model Context Protocol: Architecture, Implementation, and Applications \- arXiv.org, 2월 21, 2026에 액세스, [https://arxiv.org/html/2504.21030v1](https://arxiv.org/html/2504.21030v1)  
21. Architecture overview \- What is the Model Context Protocol (MCP)?, 2월 21, 2026에 액세스, [https://modelcontextprotocol.io/docs/learn/architecture](https://modelcontextprotocol.io/docs/learn/architecture)  
22. A guidebook to mastering the architecture of context \- STAC Research, 2월 21, 2026에 액세스, [https://stacresearch.com/news/the-ai-context-skyscraper/](https://stacresearch.com/news/the-ai-context-skyscraper/)  
23. AI for code documentation: automating comments and docs \- Graphite, 2월 21, 2026에 액세스, [https://graphite.com/guides/ai-code-documentation-automation](https://graphite.com/guides/ai-code-documentation-automation)  
24. Automate Multi-File Code Refactoring With AI Agents: A Step-by-Step Guide, 2월 21, 2026에 액세스, [https://www.augmentcode.com/learn/automate-multi-file-code-refactoring-with-ai-agents-a-step-by-step-guide](https://www.augmentcode.com/learn/automate-multi-file-code-refactoring-with-ai-agents-a-step-by-step-guide)  
25. DeepDocs: Keep Your Documentation in Sync with Your Code \- Medium, 2월 21, 2026에 액세스, [https://medium.com/@deepdocs/deepdocs-keep-your-documentation-in-sync-with-your-code-73699b73c1d2](https://medium.com/@deepdocs/deepdocs-keep-your-documentation-in-sync-with-your-code-73699b73c1d2)  
26. Standardizing the Context for AI Agents in Software Development:A Controlled, Reproducible, and Governed Approach Based on Empirical Evidence | by More Emanuel \- Medium, 2월 21, 2026에 액세스, [https://medium.com/@more.emanuel/standardizing-the-context-for-ai-agents-in-software-development-a-controlled-reproducible-and-d17dce563a11](https://medium.com/@more.emanuel/standardizing-the-context-for-ai-agents-in-software-development-a-controlled-reproducible-and-d17dce563a11)  
27. Why Your AI Code Gen Doesn't Understand Diffs \- Baz, 2월 21, 2026에 액세스, [https://baz.co/resources/why-your-code-gen-ai-doesnt-understand-diffs](https://baz.co/resources/why-your-code-gen-ai-doesnt-understand-diffs)  
28. Semantic Code Indexing with AST and Tree-sitter for AI Agents (Part — 1 of 3\) \- Medium, 2월 21, 2026에 액세스, [https://medium.com/@email2dineshkuppan/semantic-code-indexing-with-ast-and-tree-sitter-for-ai-agents-part-1-of-3-eb5237ba687a](https://medium.com/@email2dineshkuppan/semantic-code-indexing-with-ast-and-tree-sitter-for-ai-agents-part-1-of-3-eb5237ba687a)  
29. Building an AI Code Review Agent: Advanced Diffing, Parsing, and Agentic Workflows \- Baz, 2월 21, 2026에 액세스, [https://baz.co/resources/building-an-ai-code-review-agent-advanced-diffing-parsing-and-agentic-workflows](https://baz.co/resources/building-an-ai-code-review-agent-advanced-diffing-parsing-and-agentic-workflows)  
30. Building a Visual Diff System for AI Edits (Like Git Blame for LLM Changes) \- Medium, 2월 21, 2026에 액세스, [https://medium.com/illumination/building-a-visual-diff-system-for-ai-edits-like-git-blame-for-llm-changes-171899c36971](https://medium.com/illumination/building-a-visual-diff-system-for-ai-edits-like-git-blame-for-llm-changes-171899c36971)  
31. Building AI Agents That Actually Understand Your Codebase : r/ChatGPTCoding \- Reddit, 2월 21, 2026에 액세스, [https://www.reddit.com/r/ChatGPTCoding/comments/1gvjpfd/building\_ai\_agents\_that\_actually\_understand\_your/](https://www.reddit.com/r/ChatGPTCoding/comments/1gvjpfd/building_ai_agents_that_actually_understand_your/)  
32. Single-responsibility agents and multi-agent workflows in AI-powered development tools \- EPAM, 2월 21, 2026에 액세스, [https://www.epam.com/insights/ai/blogs/single-responsibility-agents-and-multi-agent-workflows](https://www.epam.com/insights/ai/blogs/single-responsibility-agents-and-multi-agent-workflows)  
33. How to Build Multi-Agent Systems: Complete 2026 Guide \- DEV Community, 2월 21, 2026에 액세스, [https://dev.to/eira-wexford/how-to-build-multi-agent-systems-complete-2026-guide-1io6](https://dev.to/eira-wexford/how-to-build-multi-agent-systems-complete-2026-guide-1io6)  
34. Claude Code Subagents Collection: 35 Specialized AI Agents. : r/ClaudeAI \- Reddit, 2월 21, 2026에 액세스, [https://www.reddit.com/r/ClaudeAI/comments/1mc6mzu/claude\_code\_subagents\_collection\_35\_specialized/](https://www.reddit.com/r/ClaudeAI/comments/1mc6mzu/claude_code_subagents_collection_35_specialized/)  
35. Create custom subagents \- Claude Code Docs, 2월 21, 2026에 액세스, [https://code.claude.com/docs/en/sub-agents](https://code.claude.com/docs/en/sub-agents)  
36. Understanding Claude Skills vs. Subagents. It's not that confusing : r/ClaudeAI \- Reddit, 2월 21, 2026에 액세스, [https://www.reddit.com/r/ClaudeAI/comments/1obq6wq/understanding\_claude\_skills\_vs\_subagents\_its\_not/](https://www.reddit.com/r/ClaudeAI/comments/1obq6wq/understanding_claude_skills_vs_subagents_its_not/)  
37. Build an AI Software Engineering Team using Claude Subagents in under 30 min for ANY project — part 1 | by Mateusz Kowalewski | Medium, 2월 21, 2026에 액세스, [https://awsomedevs.medium.com/complete-claude-team-of-agents-setup-for-software-engineers-and-pms-part-1-afc7aa4a02e1](https://awsomedevs.medium.com/complete-claude-team-of-agents-setup-for-software-engineers-and-pms-part-1-afc7aa4a02e1)  
38. Claude Code \+ Step 3.5 Flash Best Practices Guide \- GitHub, 2월 21, 2026에 액세스, [https://github.com/stepfun-ai/Step-3.5-Flash/blob/main/cookbooks/claude-code-best-practices/README.en.md](https://github.com/stepfun-ai/Step-3.5-Flash/blob/main/cookbooks/claude-code-best-practices/README.en.md)  
39. Automating Documentation Updates with Continue CLI, 2월 21, 2026에 액세스, [https://docs.continue.dev/guides/doc-writing-agent-cli](https://docs.continue.dev/guides/doc-writing-agent-cli)  
40. VoltAgent/awesome-claude-code-subagents \- GitHub, 2월 21, 2026에 액세스, [https://github.com/VoltAgent/awesome-claude-code-subagents](https://github.com/VoltAgent/awesome-claude-code-subagents)  
41. How I Built a Multi-Agent AI System That Changed My Development Workflow Forever | by Vedantparmarsingh | Medium, 2월 21, 2026에 액세스, [https://medium.com/@vedantparmarsingh/how-i-built-a-multi-agent-ai-system-that-changed-my-development-workflow-forever-2fede7780d0f](https://medium.com/@vedantparmarsingh/how-i-built-a-multi-agent-ai-system-that-changed-my-development-workflow-forever-2fede7780d0f)  
42. How to Build an AI-Powered Pull Request Review That Scales With Development Speed?, 2월 21, 2026에 액세스, [https://www.qodo.ai/blog/ai-pull-request-review/](https://www.qodo.ai/blog/ai-pull-request-review/)  
43. Demystifying evals for AI agents \- Anthropic, 2월 21, 2026에 액세스, [https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents](https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents)  
44. Best Practices for an Efficient PR Review Process \- Entelligence AI, 2월 21, 2026에 액세스, [https://entelligence.ai/blogs/pr-review-best-practices](https://entelligence.ai/blogs/pr-review-best-practices)  
45. How to Use PR-Agent: A Practical Guide to AI-Powered Pull Requests \- Sider.AI, 2월 21, 2026에 액세스, [https://sider.ai/blog/ai-tools/how-to-use-pr-agent-a-practical-guide-to-ai-powered-pull-requests](https://sider.ai/blog/ai-tools/how-to-use-pr-agent-a-practical-guide-to-ai-powered-pull-requests)  
46. AI Agent Workflow Implementation Guide for Dev Teams \- Augment Code, 2월 21, 2026에 액세스, [https://www.augmentcode.com/guides/ai-agent-workflow-implementation-guide](https://www.augmentcode.com/guides/ai-agent-workflow-implementation-guide)  
47. How Agentic AI Is Reshaping Modern Code Reviews \- DEV Community, 2월 21, 2026에 액세스, [https://dev.to/yeahiasarker/code-review-ai-agent-how-agentic-ai-is-reshaping-modern-code-reviews-2bdo](https://dev.to/yeahiasarker/code-review-ai-agent-how-agentic-ai-is-reshaping-modern-code-reviews-2bdo)