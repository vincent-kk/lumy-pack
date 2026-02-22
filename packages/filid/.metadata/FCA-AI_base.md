# **AI 에이전트를 위한 프랙탈 컨텍스트 아키텍처(FCA-AI) 심층 분석 및 미결제 과제 해결 보고서**

## **1\. 서론: AI 에이전트와 컨텍스트 부패(Context Rot)의 한계**

대규모 언어 모델(LLM)과 자율형 AI 에이전트가 소프트웨어 엔지니어링 및 대규모 코드베이스 관리에 도입되면서, 아키텍처 설계의 패러다임은 근본적인 전환기를 맞이하고 있다. 하지만 모델의 물리적 컨텍스트 윈도우(Context Window)가 수백만 토큰 단위로 확장되었음에도 불구하고, 에이전트의 실질적인 추론 능력과 작업 수행 품질은 특정 임계점을 넘어서면 급격히 저하되는 현상이 지속적으로 보고되고 있다.1 이러한 현상은 '컨텍스트 부패(Context Rot)' 또는 '주의력 희석(Attention Dilution)'으로 정의되며, 에이전트의 작업 메모리 내에 관련성이 낮거나 중복되고 상충하는 과거의 로그, 도구 호출 기록, 불필요한 코드 구문이 누적될 때 발생한다.2 결국 에이전트는 당면한 핵심 명령어에 집중하지 못하고 과거의 패턴에 집착하거나 심각한 환각(Hallucination) 오류를 일으키게 된다.2

이러한 물리적 토큰 한계와 논리적 인지 한계의 격차를 극복하기 위해 제안된 개념적 모델이 바로 'AI 에이전트를 위한 프랙탈 컨텍스트 아키텍처(Fractal Context Architecture for AI Agents, 이하 FCA-AI)'이다.1 FCA-AI는 단순히 프롬프트를 최적화하는 수준을 넘어, 시스템의 디렉토리 구조, 문서의 계층, 그리고 테스트 코드를 공간적이고 시간적인 제약 하에 동기화하는 상태 관리 시스템으로 작동한다.1 이 아키텍처는 에이전트가 전체 코드베이스를 맹목적으로 탐색하여 컨텍스트 윈도우를 낭비하는 것을 방지하고, 개발자의 명시적 의도(Intent)와 시스템의 명세(Specification)를 고밀도로 압축하여 에이전트에게 적시에 제공하는 것을 목표로 한다.1

그러나 FCA-AI 문서는 혁신적인 기본 구조를 제시함과 동시에, 이 아키텍처가 실제 엔터프라이즈 환경에서 완전한 자율성을 갖추기 위해 해결해야 할 세 가지 핵심 미결제 과제를 명시하고 있다.1 첫째, 형제 노드 간의 참조가 발생할 때 컨텍스트 오염을 막기 위한 '수평적 의존성 규칙'의 확립이다.1 둘째, 모듈의 복잡도가 한계에 달했을 때 에이전트가 이를 추상화(압축)할지, 혹은 하위 모듈로 분리(분할)할지 결정하는 '수학적/논리적 트리거 알고리즘'의 부재이다.1 셋째, 코드 변경에 따른 의도 추론이 모호할 때, 개발자의 인지적 피로도를 가중시키지 않으면서 필수 정보를 추출해내는 '인터랙티브 질의 프로토콜'의 구체화이다.1 본 보고서는 소프트웨어 공학의 정량적 지표, 도메인 주도 설계(DDD)의 통신 패턴, 그리고 인간-컴퓨터 상호작용(HCI) 관점의 인지 부하 이론을 종합하여 이 세 가지 난제에 대한 심층적인 분석과 기술적 해결 방안을 도출한다.

## **2\. FCA-AI 아키텍처의 기본 구조와 철학 분석**

FCA-AI의 근본적인 철학은 코드베이스를 논리적 의미를 지니는 독립적인 단위로 구획하고, 각 단위가 스스로의 의도와 상태를 자가 설명(Self-describing)할 수 있도록 구조화하는 데 있다.1 이를 달성하기 위해 아키텍처는 공간적 구획화와 상향식 정보 조립이라는 두 가지 주요 메커니즘을 채택하고 있다.

### **2.1. 프랙탈(Fractal)과 부속품(Organ)의 공간적 분리**

아키텍처는 시스템의 디렉토리와 모듈을 '프랙탈(Fractal)'과 '부속품(Organ)'이라는 두 가지 계층으로 엄격히 구분한다.1 프랙탈은 독립적인 비즈니스 로직이나 완결된 사용자 인터페이스(UI) 흐름을 가지는 도메인 경계(Bounded Context)로 정의되며, 전체 시스템을 구성하는 아키텍처의 핵심 노드 역할을 수행한다.1 반면 부속품은 프랙탈 내부에 종속되어 존재하는 components/, utils/, types/ 등의 디렉토리로, 프랙탈을 구동하기 위한 내부 부품에 해당한다.1

가장 중요한 아키텍처적 제약은 부속품에는 독자적인 맥락 파일(CLAUDE.md)을 부여하지 않는다는 점이다.1 에이전트가 모든 유틸리티 함수나 단순 UI 컴포넌트의 파편화된 맥락을 각각 읽어들이게 되면, 컨텍스트의 파편화와 중복이 발생하여 추론의 품질이 하락하기 때문이다.1 예외적으로 외부 의존성 없이 인터페이스만으로 기능이 완벽히 설명되는 순수 함수는 프랙탈이라 하더라도 맥락 파일을 생략하여 컨텍스트의 밀도를 극대화한다.1

### **2.2. 컨텍스트 문서의 계층적 제약**

프랙탈 노드에는 에이전트의 인지를 돕는 두 가지 형태의 핵심 문서가 배치된다.1 첫 번째는 프랙탈의 진입점에 위치하는 CLAUDE.md로, 이는 소스 코드의 추상 구문 트리(AST)만으로는 파악할 수 없는 개발자의 '의도'와 아키텍처 결정의 '히스토리'를 저장하는 공간이다.1 이 문서는 최대 100줄 이하로 유지되어야 한다는 강력한 길이 제약을 받으며, 상위 프랙탈의 정보를 하위 프랙탈에 중복 기입하지 않는 데이터 정규화(Deduplication) 원칙을 철저히 준수해야 한다.1 두 번째 문서는 CLAUDE.md와 링크로 연결되는 SPEC.md로, 모듈의 상세 명세를 담고 있다.1 이 명세 문서는 길이 제한은 없으나, 정보가 단순히 누적(Append-only)되는 것을 금지하며 항상 최신 상태의 로직만을 반영하도록 지속적으로 압축(Compressed)되어야 한다.1 이때 시스템은 컨텍스트 부패를 막기 위해 파일 내용 대신 파일 경로와 참조만 남겨 언제든 원상 복구가 가능한 가역적 압축(Reversible Compaction) 기법과, 한계 토큰을 넘었을 때 오래된 도구 호출 이력 등을 구조적 JSON 형태로 병합하는 손실 요약(Lossy Summarization) 기법을 병행하여 문서를 관리해야 한다.2

### **2.3. 에이전트 워크플로우: 상향식 파싱 및 지연 로딩**

AI 에이전트가 코드를 수정하거나 분석할 때, 전통적인 방식처럼 최상위 루트 디렉토리부터 하향식으로 모든 코드를 스캔하는 것은 비용적, 논리적 비효율을 초래한다.1 FCA-AI는 현재 작업이 이루어지는 리프 노드(Leaf Node)의 CLAUDE.md에서 출발하여 Root 방향으로 거슬러 올라가는 상향식(Bottom-up) 컨텍스트 탐색 방식을 규정한다.1 이때 상위나 하위의 프랙탈을 참조해야 할 경우, 전체 코드를 메모리에 적재하는 대신 해당 프랙탈의 CLAUDE.md만을 지연 로딩(Lazy Loading) 방식으로 획득한다.1 또한 매 커밋마다 컨텍스트를 동기화하여 발생하는 비용과 오작동을 막기 위해, 오직 PR(Pull Request) 생성 시점에만 에이전트가 코드 증분을 분석하여 맥락 파일을 일괄 동기화(Sync)하도록 설계되었다.1

### **2.4. 테스트 아키텍처와 3+12 규칙의 의미**

FCA-AI의 유지보수성은 테스트 코드의 엄격한 분리와 정량적 제약에 의해 보장된다.1 ./\_\_tests\_\_ 디렉토리 내의 파일은 목적에 따라 명세 테스트인 .spec.ts와 회귀 및 QA 테스트인 .test.ts로 분리된다.1 특히 .spec.ts 파일은 '3+12 규칙(3+12 Rule)'이라는 구조적 제약을 받는다.1 이는 하나의 명세 파일 내에 3개의 기본 동작과 최대 12개의 복잡한 동작(총 15개)만을 허용하는 임계값이다.1

이 임계값을 초과하는 것은 해당 프랙탈이 단일 책임 원칙(Single Responsibility Principle, SRP)을 위배하여 과도한 복잡성을 지니게 되었음을 의미하며, 에이전트는 즉각적으로 기존 명세를 '추상화 및 압축'하거나 하위 프랙탈로 '분리'할 것을 제안해야 한다.1 아울러 과거의 버그를 검증하는 .test.ts 파일은 3개월 등 일정 기간 동안 오류가 재발하지 않아 안정성이 확보되면, 여러 엣지 케이스들을 파라미터화(Parameterized)된 단일 테스트로 압축하여 .spec.ts로 승격(Promotion)시키고 기존 파일은 삭제하는 수명 주기 관리를 거친다.1

## ---

**3\. 미결제 과제 1: 수평적 의존성과 컨텍스트 오염 방지 메커니즘**

FCA-AI의 상향식 파싱은 수직적 계층 구조에서의 컨텍스트 수집을 효율적으로 통제하지만, 동일한 계층에 존재하는 형제(Sibling) 프랙탈 간의 수평적 참조(Horizontal Dependency)가 발생할 때 심각한 아키텍처적 취약점이 노출된다.1 형제 프랙탈 간의 직접적인 코드 및 컨텍스트 공유는 에이전트의 메모리 내에 교차 오염(Cross-task Context Pollution)을 유발하여, 모델이 현재의 목적을 망각하고 참조된 외부 모듈의 규칙에 동화되거나 과거의 환각이 현재의 맥락으로 침투하는 '컨텍스트 중독(Context Poisoning)' 현상을 낳는다.5

### **3.1. 에이전트 충돌 방지 계층(Agentic Anti-Corruption Layer) 도입**

이러한 수평적 의존성 문제를 해결하기 위한 가장 강력한 논리적 근거는 도메인 주도 설계(Domain-Driven Design, DDD)의 바운디드 컨텍스트 통신 패턴에서 찾을 수 있다.8 다수의 바운디드 컨텍스트(즉, 프랙탈)가 상호작용할 때, 공유 커널(Shared Kernel) 방식은 두 모듈 간의 강한 결합을 유발하여 맥락의 연쇄적인 붕괴를 초래한다.9 특히 공유 커널은 여러 바운디드 컨텍스트 간의 예기치 않은 모델 전파(Model Propagation) 위험을 높이므로 9, 시스템은 이를 배제하고 공개 언어(Published Language)와 결합된 역-부패 계층(Reverse Anti-Corruption Layer)으로 통신을 규격화해야 한다.10 이를 막기 위해 도입해야 하는 패턴이 바로 '충돌 방지 계층(Anti-Corruption Layer, ACL)'이다.8

기존 마이크로서비스 아키텍처에서 ACL이 레거시 시스템의 데이터 모델이 신규 시스템으로 침투하는 것을 막는 번역기 역할을 하듯, FCA-AI 시스템에서는 '에이전트 기반 충돌 방지 계층(Agentic ACL)'이 도입되어야 한다.8 프랙탈 A가 프랙탈 B의 기능을 참조해야 할 때, 에이전트 A는 프랙탈 B의 내부 구현 파일이나 부속품(Organ) 영역의 소스 코드를 자신의 컨텍스트 윈도우로 직접 복사하거나 로드해서는 안 된다.12 대신 프랙탈 B는 외부에 자신의 핵심 논리와 인터페이스만을 압축하여 제공하는 '공개 언어(Published Language)' 모델을 채택해야 하며, 이 역할을 프랙탈 B의 CLAUDE.md 파일이 수행하게 된다.10

### **3.2. 단기 하위 에이전트(Ephemeral Sub-agent)를 통한 컨텍스트 격리**

CLAUDE.md만으로 해소되지 않는 깊은 수준의 의존성 파악이 필요한 경우, 메인 에이전트가 직접 프랙탈 B로 침투하는 것은 맥락 부패의 직접적인 원인이 된다.2 계층형 에이전트 구조(HMAS)의 핵심 원리인 분할 정복(Divide-and-Conquer) 및 추상화 분리에 따라 50, 시스템은 수평적 상호작용을 처리하기 위해 '단기 하위 에이전트(Ephemeral Sub-agent)' 모델을 동적으로 생성하여 활용해야 한다.15

단기 하위 에이전트는 프랙탈 B의 환경 내에서만 제한적으로 인스턴스화되는 독립적인 작업자 에이전트이다.15 이 에이전트는 프랙탈 B의 맥락만을 보유한 완전히 고립된 컨텍스트 윈도우(Isolated Context Window)를 할당받는다.12 이들은 영구적인 상태를 갖지 않고 격리된 환경에서 실행되며, 네임스페이스 격리(Namespace isolation)와 추적 격리(Trace confinement)를 강제한다. 이를 통해 하위 작업에서 발생한 수많은 스택 트레이스, 중간 변수, 그리고 탐색 중 발생한 환각이 메인 에이전트의 작업 공간으로 누출되는 것을 구조적으로 완벽하게 차단한다.15

### **3.3. 수평적 의존성 해결을 위한 표준 프로토콜**

위와 같은 메커니즘을 시스템적으로 구현하기 위해서는 에이전트 간의 표준화된 상호작용 프로토콜이 필수적이다. 이를 위해 모델 컨텍스트 프로토콜(Model Context Protocol, MCP)이나 Agent-to-Agent(A2A) 통신 규약을 시스템 내부에 내장해야 한다.17 최근 산업계 표준으로 자리 잡은 MCP나 A2A 프로토콜을 사용하면 프랙탈 간의 기능 중복을 줄이고 일관된 컨텍스트 교환 명세를 유지할 수 있다.19 결론적으로, FCA-AI 내에서 수평적 의존성을 처리하는 규칙은 "원시 코드의 직접 참조를 전면 금지하고, MCP 기반의 단기 에이전트를 통해 필요한 결과값만을 구조적 형태로 변환하여 반환받는 것"이다. 이는 컨텍스트를 단순한 무한대의 문자열 버퍼(String Buffer)로 취급하는 관행에서 벗어나, 데이터베이스 뷰처럼 정제된 '컴파일된 뷰(Compiled View)'로써 다루는 시스템 공학적 접근이다.51

## ---

**4\. 미결제 과제 2: 압축 vs 분할의 수학적/논리적 트리거 알고리즘**

FCA-AI 아키텍처는 .spec.ts 테스트 코드에 15개(3개의 기본, 12개의 복잡)라는 하드 리밋(Hard Limit)을 설정하여 모듈의 비대화를 선제적으로 차단한다.1 특정 프랙탈의 컴포넌트가 이 테스트 임계값을 초과하는 순간, 시스템은 단일 책임 원칙(SRP)이 위배되었다고 판단하고 아키텍처 개입을 요구한다.1 그러나 여기서 AI 에이전트가 직면하는 근본적인 난제는 해당 컴포넌트를 기존 논리를 단순화하는 '압축(Compression/Abstraction)'으로 해결할 것인지, 아니면 완전히 새로운 하위 프랙탈 단위로 쪼개는 '분할(Splitting/Refactoring)'로 해결할 것인지를 결정하는 정량적 기준이 명확하지 않다는 점이다.1 이를 위해 소프트웨어 구조의 결합도, 응집도, 복잡도를 측정하는 정량적 지표 기반의 알고리즘이 도입되어야 한다.21

### **4.1. 분할(Splitting)의 기준: LCOM4 지표를 통한 다중 책임 검출**

컴포넌트를 완전히 새로운 하위 프랙탈로 '분할(Split)'해야 하는 상황은, 해당 컴포넌트 내부에 서로 관련이 없는 이질적인 비즈니스 로직들이 혼재되어 있을 때 발생한다.21 이를 에이전트가 수학적으로 판별하기 위해 사용할 수 있는 최적의 지표는 '메소드 응집도 결여(Lack of Cohesion of Methods)' 지표 중 LCOM4이다.24

LCOM4 지표는 클래스나 모듈 내부의 메소드와 인스턴스 변수들을 노드(Node)로, 그들 간의 호출 및 참조 관계를 간선(Edge)으로 하는 의존성 그래프(Dependency Graph)를 그렸을 때, 서로 연결되지 않은 독립적인 부분 그래프(Connected Components)가 몇 개 존재하는지를 수학적으로 계산한다.25

- **LCOM4 \= 1:** 내부의 모든 메소드와 변수가 직간접적으로 연결되어 있는 고도로 응집된(Cohesive) 상태를 의미한다. 이는 모듈이 단일한 책임을 수행하고 있음을 증명한다.25
- **LCOM4 ![][image1] 2:** 그래프 내에 서로 아무런 데이터나 로직을 공유하지 않는 분절된 덩어리들이 존재함을 의미한다. 이는 단일 책임 원칙(SRP)의 명백한 위반이다.25

**알고리즘 논리 1:** 테스트 케이스가 15개를 초과한 시점에서, 정적 분석 도구를 통해 계산된 해당 컴포넌트의 **LCOM4 값이 2 이상일 경우**, 에이전트는 알고리즘 트리거를 통해 무조건 \*\*'분할(Splitting)'\*\*을 지시한다. 분절된 컴포넌트 경계를 따라 '클래스 추출(Extract Class)' 리팩토링을 수행하여 독립적인 새로운 하위 프랙탈을 생성하고, 각각의 새로운 진입점에 CLAUDE.md를 신규 할당한다.25

### **4.2. 압축(Compression)의 기준: 순환 복잡도(Cyclomatic Complexity) 검출**

반대로 모듈의 책임은 하나로 잘 응집되어 있으나(LCOM4 \= 1), 책임을 구현하는 내부 제어 흐름(Control Flow)이 분기문으로 인해 지나치게 꼬여 테스트가 비대해진 경우가 존재한다.21 이 상황에서는 모듈 자체를 쪼개는 것이 아니라, 내부의 로직을 추상화하고 재배치하는 '메서드 추출(Extract Method)' 등의 '압축(Compression)' 작업이 요구된다.52 이를 판별하는 수학적 지표는 '순환 복잡도(Cyclomatic Complexity, CC)'이다.26

순환 복잡도는 수식 ![][image2] (E: 간선, N: 노드, P: 연결 요소)로 계산되며, if, switch, for, while 등의 조건문이 추가될 때마다 상승한다.27 미국 국립표준기술연구소(NIST)의 가이드라인에 따르면 CC의 기본 임계값은 10이지만, 포괄적인 테스트가 뒷받침될 경우 15까지 허용된다.53

**알고리즘 논리 2:** 모듈의 **LCOM4 값이 1을 유지**하고 있는 상태에서, 모듈의 **순환 복잡도(CC)가 15를 초과**하는 경우 트리거는 \*\*'압축(Compression)'\*\*을 지시한다.24 깊게 중첩된 조건문을 다형성(Polymorphism)이나 전략 패턴(Strategy Pattern)으로 교체하거나, 장황한 코드 블록을 캡슐화하여 함수의 평탄화(Flattening)를 진행한다.21 단, 클래스의 응집도(LCOM4) 개선 없이 단순히 긴 코드를 여러 메서드로 쪼개기만 하는 것은 수십 개의 의미 없는 메서드를 가진 '괴물 클래스(Monster Class)'를 양산할 위험이 있으므로, 분할(Splitting) 진단이 압축 진단보다 항상 선행되어야 한다.54

### **4.3. 정량적 의사결정 트리 알고리즘 종합 파이프라인**

이러한 지표들을 융합하여, AI 에이전트가 백그라운드에서 코드 품질을 모니터링하다가 15개의 테스트 케이스 한계(임계값 ![][image3])에 도달했을 때 수행하는 자율적 의사결정 파이프라인을 구축할 수 있다.1

| 단계        | 검출 조건 및 지표 (Metrics)                                       | 진단 논리 (Logic)                                                                    | 에이전트 실행 액션 트리거 (Agent Trigger)                                                      |
| :---------- | :---------------------------------------------------------------- | :----------------------------------------------------------------------------------- | :--------------------------------------------------------------------------------------------- |
| **Phase 1** | 테스트 개수 (![][image4]) \> 15                                   | 3+12 Rule 위반 발생, 검사 파이프라인 가동                                            | AST 분석 및 의존성 그래프 생성 엔진 구동                                                       |
| **Phase 2** | **LCOM4 ![][image1] 2**                                           | 단일 책임 원칙(SRP) 명시적 위반, 이질적 로직 혼재                                    | \*\*\*\* 클래스/모듈 추출을 통한 신규 하위 프랙탈 창출                                         |
| **Phase 3** | LCOM4 \= 1 이며, **CC \> 15**                                     | 응집도는 높으나 내부 제어 흐름 및 분기 구조가 과도하게 복잡함                        | **\[압축 \- Compression\]** 메서드 추출, 전략 패턴 적용, 조건부 로직의 다형성 추상화 수행      |
| **Phase 4** | LCOM4 \= 1 이며, CC ![][image5] 15 이나 ![][image4] \> 15 인 경우 | 로직과 응집도는 정상이지만, 단순 엣지 케이스 확인을 위한 테스트 코드만 비대해진 상태 | **\[테스트 파라미터화\]** 로직 변경 없이 중복 테스트들을 데이터 주도형 단일 테스트로 병합 압축 |

또한 이 알고리즘은 단순한 하드코딩 규칙을 넘어설 수 있다. 최근 연구에 따르면 LCOM4, CC, Halstead 볼륨 등 다양한 소프트웨어 공학 지표를 랜덤 포레스트(Random Forest)나 의사결정 트리(Decision Tree) 등 머신러닝 앙상블 모델에 학습시킬 경우, 90% 이상의 매우 높은 정확도로 '클래스 분할'과 '메서드 압축' 중 어떤 리팩토링이 필요한지 자율적으로 예측해 낼 수 있다.55

## ---

**5\. 미결제 과제 3: 개발자 인지 부하 최소화를 위한 인터랙티브 질의 프로토콜**

아키텍처를 유지함에 있어 가장 빈번하게 발생하는 인간과 AI의 접점은 PR 생성 시점에 코드 증분을 분석하여 CLAUDE.md와 SPEC.md를 동기화하는 단계이다.1 AI 에이전트가 해당 코드가 _왜(Why)_ 변경되었는지 비즈니스 의도를 소스 코드만으로 완벽히 역공학하지 못할 때, 필연적으로 개발자에게 의도를 묻는 '인터랙티브 질의(Interactive Prompt)'가 발생한다.1

그러나 지속적인 질의는 인간에게 큰 부담을 지운다. 개발자가 코드를 작성하는 '창작자(Creator)' 역할에서 끊임없이 AI의 제안과 질문을 평가해야 하는 '리뷰어(Reviewer)' 역할로 전락하게 될 때 발생하는 이른바 '수정 피로도(Fix Fatigue)'는 심각한 생산성 저하와 도구 이탈을 낳는다.42 따라서 질의 프로토콜은 소프트웨어 문제 해결을 위한 필수적인 사고 과정인 '내재적 인지 부하(Intrinsic Cognitive Load)'는 침해하지 않되, 도구와의 불필요한 상호작용이나 문맥 전환으로 인해 발생하는 '외생적 인지 부하(Extraneous Cognitive Load)'를 극단적으로 삭감하는 방향으로 설계되어야 한다.39

### **5.1. 능동적 학습(Active Learning) 전략을 통한 질의 통제**

에이전트가 사소한 변경 사항마다 개발자에게 질문하는 것을 막기 위해, 기계 학습의 '능동적 학습(Active Learning)' 방법론을 질의 발생 알고리즘에 도입해야 한다.35 에이전트는 무작위로 질문하는 것이 아니라, 다음 세 가지 샘플링 전략을 결합하여 자신이 가장 확신이 없는 핵심 정보에 대해서만 인간(Oracle)에게 개입을 요청한다.57

1. **불확실성 샘플링(Uncertainty Sampling):** 에이전트 내부 예측 모델의 '의도 확신도 점수'가 임계값 미만일 때만 질의한다.36
2. **위원회 기반 질의(Query-by-Committee):** 다수의 백그라운드 모델이 코드 변경의 의도에 대해 서로 크게 엇갈린 해석을 내놓을 때 질의를 발생시킨다.57
3. **다양성 샘플링(Diversity Sampling):** 시스템이 이전에 본 적 없는 완전히 새로운 아키텍처 패턴이나 외부 라이브러리가 도입되었을 때 질문하여 지식을 확장한다.58

### **5.2. 생성적 인지에서 평가적 인지로의 전환: 객관식 제약 프로토콜**

질의가 트리거되었을 때, 질문의 형태가 개발자의 인지 부하를 결정짓는다. "이 코드를 변경한 의도가 무엇입니까?"와 같은 개방형 질문(Open-ended Prompt)은 개발자에게 백지 상태에서 문장을 '생성(Generation)'하도록 강제하므로 높은 인지적 비용을 요구한다.39 따라서 프로토콜은 '평가(Evaluation) 및 인식(Recognition)' 중심으로 재설계되어야 한다.42

이를 위해 에이전트는 먼저 국소적인 코드 변경 사항이나 UI 화면을 각각 요약한 뒤, 이를 종합하여 전체적인 의도를 추론해 내는 '분할-조립(Decomposition)' 방식을 선행해야 한다.59 그리고 스스로 도출해 낸 3가지 정도의 가장 그럴듯한 '의도 가설(Hypotheses)'을 객관식 메뉴(Bounded Choices) 형태로 렌더링한다.44

**개선된 인터랙티브 질의 UI 예시:**

**\[AI Agent Alert\] AuthService의 코드가 대거 변경되었습니다. 변경 의도를 선택해 주십시오.**

\[A\] 레거시 토큰 시스템의 성능 저하로 인한 비동기 처리 최적화

신규 OAuth 공급자 연동을 위한 인터페이스 추상화

\[C\] 보안 취약점 패치를 위한 세션 타임아웃 강제 로직 추가

\[기타 직접 입력\]

이러한 설계는 개발자가 수 초 이내에 직관적인 클릭만으로 동기화 루프를 닫을 수 있게 하여 문맥 전환 비용을 대폭 줄여준다.42

### **5.3. 3-Prompt Limit 메커니즘과 의도 검증의 자동화**

개발자와 에이전트 간의 대화가 길어지는 것은 그 자체로 피로도를 높인다.42 개발자가 에이전트에게 의도를 학습시키기 위해 프롬프트를 끊임없이 수정하고 재입력하는 이른바 '프롬프트 소용돌이(Prompt Spiral)' 현상을 막기 위해, 상호작용에는 엄격한 '3회 질의 제한(Three-Prompt Limit)' 프로토콜이 적용되어야 한다.42

에이전트는 단일 의도 파악을 위해 최대 3번의 턴(Turn)까지만 대화를 시도할 수 있다.42 만약 3번의 시도 후에도 명세를 추출하지 못했다면 대화를 강제 종료하고 수동 리뷰 플래그를 부착한다.42 반대로 의도가 확정되면, 에이전트는 이를 마크다운 텍스트로 저장하는 데 그치지 않고 즉석에서 '의도 기반 어서션(Intent-Driven Assertions)' 테스트 코드를 생성하여 .spec.ts에 제안한다.1 개발자는 자신이 전달한 의도가 정확히 테스트 코드로 구현되었는지만 시각적으로 검증하면 되므로, 인간과 기계 간의 완벽한 맥락 동기화(PR Sync) 루프가 저마찰(Low-friction) 환경에서 완성된다.48

## ---

**6\. 결론: FCA-AI의 완성 및 에이전트 소프트웨어 공학의 미래**

FCA-AI(Fractal Context Architecture for AI Agents)는 방대한 코드베이스 환경에서 LLM의 환각과 컨텍스트 윈도우의 제약을 극복하기 위해 설계된 패러다임이다. 본 보고서는 이 아키텍처가 당면한 세 가지 난제에 대하여 구조적이고 정량적인 해답을 제시했다. 수평적 의존성에 의한 컨텍스트 중독을 막기 위해 단기 에이전트 기반의 충돌 방지 계층(ACL)을 도입하였고, 15개 테스트 임계값 도달 시 LCOM4와 순환 복잡도(CC)를 통해 분할과 압축을 수학적으로 판별하는 알고리즘을 확립했다. 마지막으로, PR 동기화 과정에서 개발자의 외생적 인지 부하와 피로도를 덜어내기 위한 능동적 객관식 질의 프로토콜을 규정하였다. 이러한 솔루션이 통합된 FCA-AI 아키텍처는 다가오는 초거대 AI 시대에 자율형 에이전트가 소프트웨어를 안정적으로 진화시킬 수 있는 가장 강력한 기반이 될 것이다.

#### **참고 자료**

1. Fractal Context Architecture for AI Agents
2. Context Engineering for AI Agents: Part 2 \- Philschmid, 2월 21, 2026에 액세스, [https://www.philschmid.de/context-engineering-part-2](https://www.philschmid.de/context-engineering-part-2)
3. The Complete Guide to Claude Code V2: CLAUDE.md, MCP, Commands, Skills & Hooks — Updated Based on Your Feedback : r/ClaudeAI \- Reddit, 2월 21, 2026에 액세스, [https://www.reddit.com/r/ClaudeAI/comments/1qcwckg/the_complete_guide_to_claude_code_v2_claudemd_mcp/](https://www.reddit.com/r/ClaudeAI/comments/1qcwckg/the_complete_guide_to_claude_code_v2_claudemd_mcp/)
4. Git Context Controller: Manage the Context of LLM-based Agents like Git \- arXiv, 2월 21, 2026에 액세스, [https://arxiv.org/html/2508.00031v1](https://arxiv.org/html/2508.00031v1)
5. How Long Contexts Fail, 2월 21, 2026에 액세스, [https://www.dbreunig.com/2025/06/22/how-contexts-fail-and-how-to-fix-them.html](https://www.dbreunig.com/2025/06/22/how-contexts-fail-and-how-to-fix-them.html)
6. Intelligent Agent Architecture: Context Engineering, 2월 21, 2026에 액세스, [https://chuckrussell.medium.com/intelligent-agent-architecture-context-engineering-9d1d5208fffd](https://chuckrussell.medium.com/intelligent-agent-architecture-context-engineering-9d1d5208fffd)
7. Context Engineering for Multi-Agent LLM Code Assistants Using Elicit, NotebookLM, ChatGPT, and Claude Code \- arXiv, 2월 21, 2026에 액세스, [https://arxiv.org/html/2508.08322v1](https://arxiv.org/html/2508.08322v1)
8. Anti-corruption layer pattern \- AWS Prescriptive Guidance, 2월 21, 2026에 액세스, [https://docs.aws.amazon.com/prescriptive-guidance/latest/cloud-design-patterns/acl.html](https://docs.aws.amazon.com/prescriptive-guidance/latest/cloud-design-patterns/acl.html)
9. Relationships Between Bounded Contexts in DDD | by iamprovidence | Medium, 2월 21, 2026에 액세스, [https://medium.com/@iamprovidence/relationships-between-bounded-contexts-in-ddd-ce5cfe3aaa04](https://medium.com/@iamprovidence/relationships-between-bounded-contexts-in-ddd-ce5cfe3aaa04)
10. Strategic DDD by Example: Bounded Contexts Mapping | by Jarek Orzel | Level Up Coding, 2월 21, 2026에 액세스, [https://levelup.gitconnected.com/strategic-ddd-by-example-bounded-contexts-mapping-d94ffcd45954](https://levelup.gitconnected.com/strategic-ddd-by-example-bounded-contexts-mapping-d94ffcd45954)
11. Anti-corruption Layer pattern \- Azure Architecture Center | Microsoft Learn, 2월 21, 2026에 액세스, [https://learn.microsoft.com/en-us/azure/architecture/patterns/anti-corruption-layer](https://learn.microsoft.com/en-us/azure/architecture/patterns/anti-corruption-layer)
12. Securing Multi-Agent AI Development Systems \- Knostic, 2월 21, 2026에 액세스, [https://www.knostic.ai/blog/multi-agent-security](https://www.knostic.ai/blog/multi-agent-security)
13. DDD.14 – Maintaining model integrity \- @hgraca, 2월 21, 2026에 액세스, [https://herbertograca.com/2016/02/05/ddd-14-maintaining-model-integrity/](https://herbertograca.com/2016/02/05/ddd-14-maintaining-model-integrity/)
14. Context Engineering: The Invisible Discipline Keeping AI Agents from Drowning in Their Own Memory | by Juan C Olamendy | Medium, 2월 21, 2026에 액세스, [https://medium.com/@juanc.olamendy/context-engineering-the-invisible-discipline-keeping-ai-agents-from-drowning-in-their-own-memory-c0283ca6a954](https://medium.com/@juanc.olamendy/context-engineering-the-invisible-discipline-keeping-ai-agents-from-drowning-in-their-own-memory-c0283ca6a954)
15. CodeDelegator: Mitigating Context Pollution via Role Separation in Code-as-Action Agents, 2월 21, 2026에 액세스, [https://arxiv.org/html/2601.14914v1](https://arxiv.org/html/2601.14914v1)
16. Create custom subagents \- Claude Code Docs, 2월 21, 2026에 액세스, [https://code.claude.com/docs/en/sub-agents](https://code.claude.com/docs/en/sub-agents)
17. Open Protocols for Agent Interoperability Part 1: Inter-Agent Communication on MCP \- AWS, 2월 21, 2026에 액세스, [https://aws.amazon.com/blogs/opensource/open-protocols-for-agent-interoperability-part-1-inter-agent-communication-on-mcp/](https://aws.amazon.com/blogs/opensource/open-protocols-for-agent-interoperability-part-1-inter-agent-communication-on-mcp/)
18. How Model Context Protocol (MCP) breaks AI silos and powers the Agentic AI revolution, 2월 21, 2026에 액세스, [https://fractal.ai/blog/how-model-context-protocol-mcp-breaks-ai-silos-and-powers-the-agentic-ai-revolution](https://fractal.ai/blog/how-model-context-protocol-mcp-breaks-ai-silos-and-powers-the-agentic-ai-revolution)
19. A Survey of Agent Interoperability Protocols: Model Context Protocol (MCP), Agent Communication Protocol (ACP), Agent-to-Agent Protocol (A2A), and Agent Network Protocol (ANP) \- arXiv.org, 2월 21, 2026에 액세스, [https://arxiv.org/html/2505.02279v1](https://arxiv.org/html/2505.02279v1)
20. Beyond Self-Talk: A Communication-Centric Survey of LLM-Based Multi-Agent Systems, 2월 21, 2026에 액세스, [https://arxiv.org/html/2502.14321v2](https://arxiv.org/html/2502.14321v2)
21. Cohesion Metrics for Improving Software Quality \- SciSpace, 2월 21, 2026에 액세스, [https://scispace.com/pdf/cohesion-metrics-for-improving-software-quality-1w7z5jzrxf.pdf](https://scispace.com/pdf/cohesion-metrics-for-improving-software-quality-1w7z5jzrxf.pdf)
22. Measuring Software Complexity: What Metrics to Use? \- The Valuable Dev, 2월 21, 2026에 액세스, [https://thevaluable.dev/complexity-metrics-software/](https://thevaluable.dev/complexity-metrics-software/)
23. Best Practices for Identifying and Eliminating Code Smells \- Codacy | Blog, 2월 21, 2026에 액세스, [https://blog.codacy.com/best-practices-for-identifying-and-eliminating-code-smells](https://blog.codacy.com/best-practices-for-identifying-and-eliminating-code-smells)
24. Project Metrics Help \- Cohesion metrics \- Aivosto, 2월 21, 2026에 액세스, [https://www.aivosto.com/project/help/pm-oo-cohesion.html](https://www.aivosto.com/project/help/pm-oo-cohesion.html)
25. Lack of Cohesion in Methods (LCOM4) | objectscriptQuality, 2월 21, 2026에 액세스, [https://objectscriptquality.com/docs/metrics/lack-cohesion-methods-lcom4](https://objectscriptquality.com/docs/metrics/lack-cohesion-methods-lcom4)
26. Managing Code Complexity \- Developer Guidelines, 2월 21, 2026에 액세스, [https://devguide.trimble.com/development-practices/managing-code-complexity/](https://devguide.trimble.com/development-practices/managing-code-complexity/)
27. Cyclomatic complexity \- Wikipedia, 2월 21, 2026에 액세스, [https://en.wikipedia.org/wiki/Cyclomatic_complexity](https://en.wikipedia.org/wiki/Cyclomatic_complexity)
28. Cyclomatic Complexity Guide | How To Calculate & Test \- Sonar, 2월 21, 2026에 액세스, [https://www.sonarsource.com/resources/library/cyclomatic-complexity/](https://www.sonarsource.com/resources/library/cyclomatic-complexity/)
29. CA1502: Avoid excessive complexity (code analysis) \- .NET \- Microsoft Learn, 2월 21, 2026에 액세스, [https://learn.microsoft.com/en-us/dotnet/fundamentals/code-analysis/quality-rules/ca1502](https://learn.microsoft.com/en-us/dotnet/fundamentals/code-analysis/quality-rules/ca1502)
30. Cyclomatic Complexity explained: How it measures (and misleads) code quality \- LinearB, 2월 21, 2026에 액세스, [https://linearb.io/blog/cyclomatic-complexity](https://linearb.io/blog/cyclomatic-complexity)
31. Understanding Cyclomatic Complexity & its Importance in Code Analysis Metrics | T/DG Blog, 2월 21, 2026에 액세스, [https://blog.thedigitalgroup.com/understanding-cyclomatic-complexity-and-its-importance-in-code-analysis-metrics](https://blog.thedigitalgroup.com/understanding-cyclomatic-complexity-and-its-importance-in-code-analysis-metrics)
32. Understanding Decision Trees: Algorithms, Splits, and Interpretability \- Medium, 2월 21, 2026에 액세스, [https://medium.com/@saha.soumyadeep90/understanding-decision-trees-algorithms-splits-and-interpretability-2d2420cf1d39](https://medium.com/@saha.soumyadeep90/understanding-decision-trees-algorithms-splits-and-interpretability-2d2420cf1d39)
33. How Developers Use AI Agents: When They Work, When They Don't, and Why \- arXiv, 2월 21, 2026에 액세스, [https://arxiv.org/html/2506.12347v1](https://arxiv.org/html/2506.12347v1)
34. What Is Human In The Loop (HITL)? \- IBM, 2월 21, 2026에 액세스, [https://www.ibm.com/think/topics/human-in-the-loop](https://www.ibm.com/think/topics/human-in-the-loop)
35. Active Learning: Strategies, Tools, and Real-World Use Cases \- Neptune.ai, 2월 21, 2026에 액세스, [https://neptune.ai/blog/active-learning-strategies-tools-use-cases](https://neptune.ai/blog/active-learning-strategies-tools-use-cases)
36. Efficient Human-in-the-Loop Active Learning: A Novel Framework for Data Labeling in AI Systems \- arXiv, 2월 21, 2026에 액세스, [https://arxiv.org/html/2501.00277v1](https://arxiv.org/html/2501.00277v1)
37. Active Learning in Machine Learning: Guide & Strategies \[2025\] \- Encord, 2월 21, 2026에 액세스, [https://encord.com/blog/active-learning-machine-learning-guide/](https://encord.com/blog/active-learning-machine-learning-guide/)
38. Sentence-Based Active Learning Strategies for Information Extraction, 2월 21, 2026에 액세스, [https://ceur-ws.org/Vol-560/paper11.pdf](https://ceur-ws.org/Vol-560/paper11.pdf)
39. Cognitive Load Optimization: How AI is Reshaping Developer Mental Workspaces, 2월 21, 2026에 액세스, [https://fullvibes.dev/posts/cognitive-load-optimization-how-ai-is-reshaping-developer-mental-workspaces](https://fullvibes.dev/posts/cognitive-load-optimization-how-ai-is-reshaping-developer-mental-workspaces)
40. (PDF) Cognitive Load Optimization for Contact Center Agents Using Real-Time Monitoring and AI-Driven Workload Balancing \- ResearchGate, 2월 21, 2026에 액세스, [https://www.researchgate.net/publication/394490913_Cognitive_Load_Optimization_for_Contact_Center_Agents_Using_Real-Time_Monitoring_and_AI-Driven_Workload_Balancing](https://www.researchgate.net/publication/394490913_Cognitive_Load_Optimization_for_Contact_Center_Agents_Using_Real-Time_Monitoring_and_AI-Driven_Workload_Balancing)
41. Harmonizing AI Agents with Human Interaction \- Aubergine Solutions, 2월 21, 2026에 액세스, [https://www.aubergine.co/insights/harmonizing-ai-agents-with-human-interaction](https://www.aubergine.co/insights/harmonizing-ai-agents-with-human-interaction)
42. AI fatigue is real and nobody talks about it | Siddhant Khare, 2월 21, 2026에 액세스, [https://siddhantkhare.com/writing/ai-fatigue-is-real](https://siddhantkhare.com/writing/ai-fatigue-is-real)
43. What is AI Code Generation? \- AWS, 2월 21, 2026에 액세스, [https://aws.amazon.com/what-is/ai-coding/](https://aws.amazon.com/what-is/ai-coding/)
44. How to Write Better Prompts for AI Code Assistants \- Builder.io, 2월 21, 2026에 액세스, [https://www.builder.io/m/explainers/best-ai-coding-prompts](https://www.builder.io/m/explainers/best-ai-coding-prompts)
45. Context engineering with OpenAI: How enterprises make AI agents production-ready, 2월 21, 2026에 액세스, [https://fractal.ai/blog/context-engineering-openai](https://fractal.ai/blog/context-engineering-openai)
46. Design effective language understanding \- Microsoft Copilot Studio, 2월 21, 2026에 액세스, [https://learn.microsoft.com/en-us/microsoft-copilot-studio/guidance/language-understanding](https://learn.microsoft.com/en-us/microsoft-copilot-studio/guidance/language-understanding)
47. Pull Request Review Best Practices: A Comprehensive Guide \- Graph AI, 2월 21, 2026에 액세스, [https://www.graphapp.ai/blog/pull-request-review-best-practices-a-comprehensive-guide](https://www.graphapp.ai/blog/pull-request-review-best-practices-a-comprehensive-guide)
48. Intent-Driven AI Testing: Redefining End-to-End Test Automation \- Harness, 2월 21, 2026에 액세스, [https://www.harness.io/blog/intent-driven-assertions-are-redefining-tests](https://www.harness.io/blog/intent-driven-assertions-are-redefining-tests)
49. Best Practices for Claude Code, 2월 21, 2026에 액세스, [https://code.claude.com/docs/en/best-practices](https://code.claude.com/docs/en/best-practices)
50. A Taxonomy of Hierarchical Multi-Agent Systems: Design Patterns, Coordination Mechanisms, and Industrial Applications \- arXiv.org, 2월 21, 2026에 액세스, [https://arxiv.org/html/2508.12683](https://arxiv.org/html/2508.12683)
51. Architecting efficient context-aware multi-agent framework for production, 2월 21, 2026에 액세스, [https://developers.googleblog.com/architecting-efficient-context-aware-multi-agent-framework-for-production/](https://developers.googleblog.com/architecting-efficient-context-aware-multi-agent-framework-for-production/)
52. The Bumpy Road Code Smell: Measuring Code Complexity by its Shape and Distribution (Clone) \- CodeScene, 2월 21, 2026에 액세스, [https://codescene.com/blog/bumpy-road-code-complexity-in-context/](https://codescene.com/blog/bumpy-road-code-complexity-in-context/)
53. Code metrics \- Cyclomatic complexity \- Visual Studio (Windows) | Microsoft Learn, 2월 21, 2026에 액세스, [https://learn.microsoft.com/en-us/visualstudio/code-quality/code-metrics-cyclomatic-complexity?view=visualstudio](https://learn.microsoft.com/en-us/visualstudio/code-quality/code-metrics-cyclomatic-complexity?view=visualstudio)
54. Is Extract Method Refactoring that important? : r/learnprogramming \- Reddit, 2월 21, 2026에 액세스, [https://www.reddit.com/r/learnprogramming/comments/zl5zlo/is_extract_method_refactoring_that_important/](https://www.reddit.com/r/learnprogramming/comments/zl5zlo/is_extract_method_refactoring_that_important/)
55. The Effectiveness of Supervised Machine Learning Algorithms in Predicting Software Refactoring \- arXiv, 2월 21, 2026에 액세스, [https://arxiv.org/pdf/2001.03338](https://arxiv.org/pdf/2001.03338)
56. Fixing Fix Fatigue: Building Developer Trust for Secure AI Code | Snyk, 2월 21, 2026에 액세스, [https://snyk.io/blog/fixing-fix-fatigue-building-developer-trust-for-secure-ai-code/](https://snyk.io/blog/fixing-fix-fatigue-building-developer-trust-for-secure-ai-code/)
57. Active Learning Tools and Strategies — part 2 | by Farnaz Ghassemi Toudeshki | Medium, 2월 21, 2026에 액세스, [https://medium.com/@farnazgh73/active-learning-tools-and-strategies-part-2-325c2be2ca00](https://medium.com/@farnazgh73/active-learning-tools-and-strategies-part-2-325c2be2ca00)
58. How Active Learning empowers Human-in-the-loop ML \- Clearbox AI, 2월 21, 2026에 액세스, [https://www.clearbox.ai/blog/how-active-learning-empowers-humans-in-the-loop-ml](https://www.clearbox.ai/blog/how-active-learning-empowers-humans-in-the-loop-ml)
59. Small models, big results: Achieving superior intent extraction through decomposition, 2월 21, 2026에 액세스, [https://research.google/blog/small-models-big-results-achieving-superior-intent-extraction-through-decomposition/](https://research.google/blog/small-models-big-results-achieving-superior-intent-extraction-through-decomposition/)

[image1]: data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAA0AAAAUCAYAAABWMrcvAAAAgklEQVR4XmNgGAUowBWI/wNxFroEMcCaAaK5G12CGKAKxD+BeBm6BDFABIjfA/EhdAliAAcQ3wfia0DMjCaHF4gB8Qcg3oEugQ2oA/EvIF6ILoEN2DFAQrINXQIbiGQgIc5yGSCK/dAlcIEGIDZCFxw8QBqIvYnEFlA94ORiTiTWBAC9nhfSx/ZblAAAAABJRU5ErkJggg==
[image2]: data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAJgAAAAYCAYAAAAGcjT5AAADx0lEQVR4Xu2Z26sPURTHF5JySciLSyc8uHZSlAeXNymkPKDkUpI3PBApolDCg1IeXEMR6njgwV/gFi+UF9GRS5T7Pff1be99fmvWb8/Mnt+cM/Ngf+rbmVnfvfdv7T0ze/aeQxSJRCKRSCQSqZudrM+sv1Z3k3YTT6hRFvU2Je1KcXmEqGpesr5T4/fHJm1aLDzoR9LucWaxXpP57Zus3kk7Afrymxq5fmS9oWT/RnWVTiHkYrSzdpApM015ddGHTD73tWE5QNl96klw0e6Q+f13ynPUkdth1hFx/pVMHvohkKwlU2aeNpgPFNCPZ9SYydJ4yrpO2WWqZjOZfDAj+OjHuqeDFbGRNYOyH9xfOlCAtDbzQD3kpWNZ7T2kdP8yGW+VNhzzydyhVym9kQ77Ny+RqvE9PW2sMfYYswie2DrAawQsIZPjReGBCaz9KlYE3e8QBpD/Gvpikiwfr3d4U7XhwDsYYD3la2Qga709hn9JeHXj6/htcYwbbLA4rxKZly/Pc6xBKlYE3V4ou1kzVcyXnwTeDR205NXtMrGuwrFesGExB/D+hT9JeHXi1l+dZKb8uawTNlY3vVhXxPkZMnktF7GyeZatL0Fbf3TQspSMj/HVvCBTL2uTQM/FMRqS71KsIzCtAsx0RTt1NkUY8NOsU6yTrOOsY7ZOKFvI5IO29rGO2vPHslBNbKDmjRByk+NXdudY9FqkgTUq2uqvDcsDMv4X1lvWJ3sO7RHlvGBWWifOUQkX3iFfh3qA6sZ1VLKMtVKczxHHPoaxpgdqvK0Tglt/SbDdR774zYmsvUk7lXHUnAuEtnQMGm2qBeE2IcO1ISh13d36y4GGsFsEmP4k8PRCtU58HcesJsmbJdpYiwI129YJQecFRpCJ41siHty0GUODm0DnAqEtHYPaTbVchpBpAzvtLFzOLaEHwl00DOYUEV9g45NFLATskooolL5k8rmlDQFem3kzWE+A9cg1HbS48dXj3gpl2kCOuj6WLpoVZMqt1kYor9S5+7qL7x4SfOHXCdXJdjL54Mb3gdmhrny3Uvpst4ZMXm7jVIYy/fMt6PG1XtNJLf4OdjmPqHnqO0/+Brvrqesu3L8pNNhZYhsO75DyqmAomd/Gt6804O/SwRbw9T8E993KJ01aPJODrPdkFqJYKMuvyQspOTjYObiy+B/UT9Y24VcNcsCThidQDw4EDzki76rBR183VjjG2Pq4QPnrnhAKX3hmJDWPmdM3UU5ed/QFN2WH8CP/Aa3cYJFIMFgORCKRSCQSiUQikUjP8g81rjeJyPGVSwAAAABJRU5ErkJggg==
[image3]: data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADsAAAAYCAYAAABEHYUrAAAB1UlEQVR4Xu2WTSgFURiGPz+JbKQQKVs/EfZ2svCTsmCl2LAkGxbK3SrZSJGFhY2NldgryULY2pCfDSWiJITvu98MM+89Y+69M5E6T71N876nM+ebOWfOIbJYLP+RTdZHBvpL1lh1aDocsdpYBaxq1jTr3teCtIB+g4eF1Rq832CX9U7fY6r3x0nyKfWjvPhaMKWkX9ZLLmnjY/CFCzSAGjRipJWCixVOWIusWVYVZEm2WDngjZN22gu+TI958EzssU5ZRRhEJKzYHTSQMTSYOzJP1xJWBZo/IDPmgVWJQZZELtaEab1GYYn1xmrGIEPCij0kfY7M1hvWmT9OJY+0wwMMYiBB2ncX+OniFtuAgcMz3EvblL+xl0mKNqB0GCV9xiAGIbjFNmIQwDpp+2IMXB4p3ilsoof0GVMYhOAW24RBAAnS9gPgfxH3evUyQtr3MAZp4hZrWvumcc85Xjv4SWRrkTDu9TpD2m8HBhniFtuCAakvJygv+45vZIU0HAI/W5ZZrxT8Q8mUTtLxdWPALLAmPPfuiWrV41Ef64l0b711JOtWjlqBbyWEDdK/YDkGWSLbyDXrinXpXMU79zZitknHLHu7XE1niFgpYxWiabFYLBaL8gl/2Xv8hM2gbwAAAABJRU5ErkJggg==
[image4]: data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAwAAAAWCAYAAAD0OH0aAAAAjElEQVR4XmNgGD5gMxD/JxKDAYgRBuMgicEVQIEGiBBigNiADJgYIIovoImDwVYgZkQTK2CAaPBHE2cDEflogiDwngHTOSAggC4AA9jcjxMwM0AUn0GXwAXKGSAavNElcIHPDCQ4BwRIcj8o2Ehy/2wGiIYENHEUEATE3xggYf8WikH++MVAgtOGNQAAKD8p5yt7V0UAAAAASUVORK5CYII=
[image5]: data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAA0AAAAUCAYAAABWMrcvAAAAhUlEQVR4XmNgGAUgwIgugA84AvF/IG5Bl8AGYhkginPQJbCBSgaI4iB0CWxgChD/A2ILdAlsYD0Q/wBiJXQJXCCXAeIUK3QJYkAJA0RzMLoEMSCKAaI5G12CGGDHANHchi5BDFAB4p9APAddghggCMT70QVpD6SB2JtIDE8pIkBsTiTWBAAfTRgL01aGqQAAAABJRU5ErkJggg==
