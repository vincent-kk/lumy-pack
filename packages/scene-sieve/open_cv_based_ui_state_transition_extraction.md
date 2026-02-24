# **화면 녹화 기반 UI 상태 전이 추출 및 비전-언어 모델(VLM) 기반 QA 자동화 기술 동향 심층 분석 보고서**

## **1\. 서론: 소프트웨어 품질 보증(QA) 생태계의 패러다임 전환과 멀티모달 VLM의 한계**

현대의 소프트웨어 엔지니어링 생태계에서 애플리케이션의 복잡도가 기하급수적으로 증가함에 따라, 소프트웨어 품질 보증(QA, Quality Assurance) 및 테스트 자동화 파이프라인 역시 근본적인 패러다임 전환을 겪고 있다. 과거의 테스트 자동화는 개발자가 사전에 정의한 DOM(Document Object Model) 트리의 XPath나 CSS 선택자(Selector)에 의존하여 스크립트를 작성하는 방식(예: Selenium, Cypress, Playwright)이 주를 이루었다.1 그러나 이러한 구조적 접근 방식은 프론트엔드 프레임워크의 렌더링 방식이 변화하거나 사소한 UI 컴포넌트의 클래스명이 변경될 때마다 전체 테스트 코드가 붕괴하는 이른바 '테스트 취약성(Test Brittleness)' 문제를 고질적으로 안고 있었다.1

이러한 한계를 극복하기 위해 2024년 이후의 QA 자동화 트렌드는 코드 레벨의 검증을 넘어, 실제 사용자가 화면을 인식하는 방식과 동일하게 픽셀 기반의 시각적 요소를 직접 분석하고 상호작용하는 '비전 기반 자율 에이전트(Vision-based Autonomous Agents)'로 급격히 이동하고 있다.2 특히 GPT-4V, LLaVA, Qwen-VL과 같은 강력한 멀티모달 비전-언어 모델(VLM, Vision-Language Model)의 등장은 GUI(Graphical User Interface) 테스트의 혁신을 촉발했다.2 에이전틱 AI(Agentic AI)는 단순한 스크립트 실행기가 아니라, 인간 테스터처럼 요구사항 명세서(Jira 티켓 등)를 읽고, 애플리케이션의 화면을 캡처하여 시각적으로 분석한 뒤, 스스로 다음 동작을 계획(Planning)하고 실행(Acting)하는 자율적 추론 루프를 수행한다.4

그러나 이러한 멀티모달 VLM을 CI/CD(Continuous Integration/Continuous Deployment) 파이프라인의 실시간 동영상 분석이나 버그 재현 녹화본 분석에 직접 적용하는 데에는 치명적인 컴퓨팅 자원 병목과 알고리즘적 한계가 존재한다. 대형 비전-언어 모델은 이미지를 패치(Patch) 단위로 분할하여 수백 개의 고차원 시각 토큰(Visual Tokens)으로 변환한 뒤 어텐션(Attention) 연산을 수행한다.6 초당 30프레임(30fps)으로 녹화된 1분짜리 버그 재현 동영상을 아무런 전처리 없이 VLM에 입력할 경우, 처리해야 할 프레임 수는 1,800장에 달하며 이는 수백만 개의 토큰을 생성하게 된다. 트랜스포머(Transformer) 아키텍처의 특성상 컨텍스트 길이(Context Length)가 증가할수록 연산량과 메모리 요구량은 2차 함수(![][image1]) 형태로 폭증하므로, 막대한 클라우드 추론 비용과 지연 시간(Latency)을 초래한다.8 더불어 스크롤링 동작이나 로딩 스피너와 같이 논리적 상태 변화가 없는 시각적 노이즈(Visual Noise)가 문맥 창(Context Window)을 차지하게 되면, 모델이 중요한 버그 발생 시점을 놓치거나 환각(Hallucination)을 일으키는 등 다운스트림 작업의 정확도가 심각하게 훼손된다.10

본 보고서에서는 이러한 실무적 난제를 해결하기 위해 제안된 '화면 녹화 기반 UI 상태 전이 추출 연구 의뢰서'의 수학적 모델링과 4단계 알고리즘 파이프라인을 심층적으로 요약 및 분석한다. 또한, 해당 파이프라인을 Node.js (npx) 및 WebAssembly 환경에서 순수 연산만으로 구현하기 위한 핵심 기술인 OpenCV 기반 특징점 추출(ORB vs AKAZE), 밀도 기반 공간 군집화(DBSCAN), 시공간 IoU 추적(Spatio-Temporal Tracking) 모델을 면밀히 검토한다. 마지막으로, VLM 토큰 프루닝(Token Pruning) 기술과 2025/2026년 QA 자동화 동향을 종합하여, OpenCV 수리 연산과 VLM 추론을 결합한 하이브리드 자동화 파이프라인의 미래 발전 방향을 제시한다.

## ---

**2\. 화면 녹화 기반 UI 상태 전이 추출 파이프라인 요약 및 수학적 모델링 분석**

제공된 연구 의뢰서는 VLM에 비디오 전체를 입력하는 대신, 소프트웨어의 유의미한 논리적 '상태 전이(State Transition)'가 발생한 핵심 프레임(Keyframes)만을 선별하고, 동적인 노이즈를 텍스트 메타데이터(JSON)로 치환하여 모델의 인지 부하를 극적으로 낮추는 경량 유틸리티의 설계를 제안하고 있다.10 무거운 딥러닝 기반 세그멘테이션 모델 대신 수학적 비전 연산(OpenCV)을 채택한 이 접근법은 다음 세 가지 도메인 특화 가설을 근간으로 한다.

### **2.1. 3가지 핵심 전제 (Core Assumptions)의 이론적 근거**

**1\. UI 강체 보존의 법칙 (Rigid Body Assumption in UI)** 일반적인 자연 영상(Natural Video)과 달리, 소프트웨어 UI/UX 화면은 수학적으로 매우 엄격한 기하학적 규칙을 따른다. 웹 브라우저에서 스크롤링이 발생하거나 윈도우 창을 드래그하여 이동시킬 때, 화면 내부의 텍스트, 버튼, 이미지 등의 컴포넌트들은 자신만의 고유한 픽셀 패턴과 특징(Feature Descriptor)을 변경하지 않고 2차원 평면상에서 평행 이동(Translation)만을 수행한다.10 수학적으로 이는 어파인 변환(Affine Transformation) 행렬 중 회전, 축소/확대, 전단(Shear)이 배제된 가장 단순한 형태인 $T(x, y) \= (x \+ t\_x, y \+ t\_y)$로 정의된다. 파이프라인은 이 전제에 따라, 프레임 간 픽셀의 단순한 위치 변화는 소프트웨어의 내부 논리적 '상태 변화'가 아닌 단순한 사용자의 '뷰(View) 변경'으로 취급하여 알고리즘적으로 기각(Pruning)한다.

**2\. 정보 밀도의 비대칭성 (Information Density Asymmetry)** 버그가 발생하거나 사용자의 조작으로 시스템 상태가 전이되는 순간(예: 드롭다운 메뉴 활성화, 모달 팝업 창 등장, 폼 검증 에러 메시지 출력 등)을 관찰해 보면, 화면 전체 면적 대비 매우 좁은 국소 영역(Local Area)에서 픽셀 값의 폭발적인 변이가 일어난다.10 이러한 상태 전이는 기존 배경 픽셀 위에 새로운 레이어가 덮어씌워지면서 전에 없던 고밀도(Dense)의 신규 특징점(Keypoints)과 코너(Corners)들을 무더기로 파생시킨다. 따라서 두 프레임 사이의 단순한 MSE(Mean Squared Error) 픽셀 차이를 계산하는 것보다, 신규 특징점이 특정 공간에 얼마나 밀집하여 나타났는지를 측정하는 것이 UI 상태 변화를 감지하는 훨씬 정교하고 잡음에 강인한 척도가 된다.

**3\. 토큰 경제성과 이종 모달리티 치환 (Cross-modal Substitution for Token Economics)** UI에는 논리적인 상태 전환 없이 시각적으로만 무한히 변하는 요소들이 존재한다. 로딩 스피너(Loading Spinner), 프로그레스 바(Progress Bar), 깜빡이는 텍스트 커서 등이 대표적인 '정적 동적 영역(Stationary Dynamic Zone)'이다.10 이를 초당 수십 장의 프레임으로 VLM에 전달하는 것은 심각한 자원 낭비다. 본 연구는 이종 모달리티 치환(Cross-modal Substitution) 개념을 도입하여, 시공간 추적을 통해 이러한 반복 애니메이션 영역을 식별한 후 해당 프레임들을 삭제한다. 그 대신, 애니메이션이 발생한 화면 좌표와 지속 시간(Duration) 정보를 {"event": "loading\_spinner", "location": \[x,y,w,h\], "duration\_ms": 3000}와 같은 구조화된 텍스트 메타데이터(JSON)로 변환하여 언어 모델에 전달한다. 시각 토큰 수백 개를 단 몇 개의 텍스트 토큰으로 압축함으로써 정보의 손실 없이 정보 이득(Information Gain)을 극대화한다.10

### **2.2. 제안된 4단계 파이프라인의 알고리즘적 전개**

의뢰서에서 제안된 파이프라인은 특징점 추출, 공간 군집화, 시공간 추적, 그리고 정보 이득 기반의 최적화라는 4개의 페이즈(Phase)로 구성된다.10 이 과정은 딥러닝 추론 없이 순수 수학적 비전 알고리즘을 통해 이루어진다.

**Phase 1: 특징점 차집합 추출 (Feature Set Difference)**

연속된 두 시점 ![][image2]와 ![][image3]의 프레임에서 OpenCV의 특징점 추출기(Feature Extractor)를 사용하여 특징점의 좌표와 디스크립터 집합을 추출한다. 이를 각각 $K\_t, K\_{t+1}$이라 정의한다.

1. 브루트 포스(Brute-Force) 매처나 FLANN 기반 매처를 사용하여 두 집합의 디스크립터 간 거리를 계산하고, 임계값 이내로 매칭되는 교집합(Matching Intersection) $M\_{t,t+1}$을 식별한다.10  
2. 이 교집합 $M\_{t,t+1}$은 화면 내에서 형태를 유지한 채 위치만 이동한 '강체 이동 노이즈'를 의미하므로, 두 집합에서 이를 배제(Subtract)한다.  
3. 이를 통해 순수하게 새로 생성된 정보 집합 $S\_{new} \= K\_{t+1} \\setminus M\_{t,t+1}$와 화면에서 사라진 정보 집합 $S\_{loss} \= K\_t \\setminus M\_{t,t+1}$만을 도출해 낸다.10 스크롤링으로 인한 픽셀 변화는 이 차집합 연산을 통해 완벽히 기각된다.

**Phase 2: 밀도 기반 공간 군집화 (DBSCAN Clustering)** 차집합 연산을 통해 얻은 ![][image4] 집합 내부에는 여전히 동영상 인코딩 손실이나 미세한 렌더링 차이로 인한 산발적인 노이즈 포인트들이 존재한다. 이를 필터링하고 실제 UI 컴포넌트로 간주할 수 있는 유의미한 영역을 식별하기 위해 DBSCAN(Density-Based Spatial Clustering of Applications with Noise) 알고리즘을 적용한다.10 DBSCAN은 밀도가 높은 포인트들을 하나의 군집으로 묶고, 임계 밀도에 미치지 못하는 포인트들을 아웃라이어(Noise)로 판별하여 제거한다. K-Means와 달리 사전에 군집의 개수(K)를 지정할 필요가 없으며, 임의의 형태를 가진 UI 컴포넌트(예: 직사각형 모달, 둥근 버튼)를 정확하게 군집화할 수 있다.13 군집화된 각 영역은 바운딩 박스(Bounding Box) 형태로 반환된다.

**Phase 3: 정적 동적 영역 식별 및 점수 감쇠 (Spatio-Temporal IoU Tracking)** 연속된 프레임들의 타임라인을 따라 Phase 2에서 생성된 바운딩 박스들의 위치와 면적을 추적한다. 이를 위해 두 프레임 ![][image2]와 ![][image3] 사이의 바운딩 박스 겹침 정도를 나타내는 시공간 IoU(Intersection over Union) 공식을 사용한다.10

![][image5]  
만약 특정 바운딩 박스의 ![][image6] 값이 매우 높게(위치가 거의 변하지 않음) 유지되면서도 그 내부의 신규 특징점(![][image4])이 지속적으로 발생한다면, 이는 제자리에서 픽셀 패턴만 반복적으로 바뀌는 애니메이션 영역(![][image7])임이 수학적으로 증명된다. 이 상태가 ![][image8] 프레임 이상 지속될 경우, 해당 구역 내부에서 발생하는 변화에 대해서는 감쇠 계수(Decay Factor) ![][image9]를 적용하여 향후 프레임 변화 점수 연산에서 배제한다.10

**Phase 4: 컨텍스트 유의미성 점수 산출 및 프레임 압축 (Scoring & Pruning)** 도출된 유의미한 신규 군집의 면적과 특징점의 개수(밀도)를 가중 합산하여 두 인접 프레임 간의 정보 이득 점수(Information Gain Score, ![][image10])를 산출한다.10 전체 동영상의 프레임 시퀀스를 배열로 구성한 뒤, 정보 이득 점수 $G(t)$가 가장 낮은 인접 프레임 쌍(즉, 상태 전이가 전혀 없거나 무의미한 프레임들)을 탐색하여 하나로 병합(Merge)하거나 가지치기(Prune)하는 탐욕 알고리즘(Greedy Algorithm)을 반복 수행한다. 이 최적화 과정을 통해 사전에 설정한 목표 핵심 프레임 수(예: 10장) $N\_{target}$에 도달할 때까지 원본 동영상을 의미론적으로 압축한다.10

## ---

**3\. UI 도메인 환경에서의 최적 OpenCV 특징점 추출기(Feature Extractor) 비교 분석: ORB vs AKAZE**

연구 의뢰서의 최우선 검증 과제는 자바스크립트 및 Node.js 기반의 npx 환경이라는 엄격한 자원 제약 속에서, 콜드 스타트 지연을 최소화하면서도 얇은 경계선과 텍스트 위주의 UI 화면 특징을 가장 잘 포착할 수 있는 알고리즘을 선정하는 것이다.10 컴퓨터 비전 영역에서 스케일 불변 특징 변환인 SIFT(Scale-Invariant Feature Transform)나 SURF(Speeded-Up Robust Features)는 뛰어난 정확도를 보이지만, 부동소수점 연산량이 방대하고 과거 특허 문제 등으로 인해 브라우저 기반의 경량 환경에서는 사용이 권장되지 않는다.11 이에 따라 고속 이진 디스크립터를 사용하는 \*\*ORB(Oriented FAST and Rotated BRIEF)\*\*와 비선형 척도 공간을 활용하는 \*\*AKAZE(Accelerated KAZE)\*\*가 가장 유력한 대안으로 대두된다.18

### **3.1. ORB (Oriented FAST and Rotated BRIEF)의 메커니즘과 UI 적용 한계**

ORB는 FAST(Features from Accelerated Segment Test) 코너 검출 알고리즘과 BRIEF(Binary Robust Independent Elementary Features) 디스크립터를 결합하고 회전 불변성(Rotation Invariance)을 추가한 알고리즘이다.18

* **성능 및 장점:** ORB의 가장 큰 강점은 압도적인 연산 속도(FPS)이다. SIFT 대비 최대 두 자릿수 배율로 빠르며, 이진 스트링(Binary String) 형태의 디스크립터를 사용하여 해밍 거리(Hamming Distance) 계산만으로 매칭이 가능하므로 메모리 효율성이 극도로 높다.18 또한 어파인 변환(Affine Transformation)이 일어난 이미지나 조명, 밝기 변화 환경에서 상대적으로 견고한 성능을 발휘한다.22  
* **UI 환경에서의 치명적 단점 (한계):** 그러나 ORB는 스케일(크기) 변화에 매우 취약하며 11, 피라미드 기반의 가우시안 블러링(Gaussian Blurring)을 사용하여 이미지 패치를 처리한다. 이 가우시안 평활화 과정은 이미지의 고주파(High-frequency) 세부 정보를 뭉개버리는 특성이 있다. 따라서 소프트웨어 UI 스크린샷에서 가장 중요한 정보인 얇은 1픽셀짜리 테두리(Borders), 체크박스, 작은 폰트 텍스트 등 미세한 구조적 특징들이 노이즈와 함께 소실되는 문제가 발생한다.23 특히 배경과 텍스트가 촘촘히 겹쳐진 그리드 UI에서는 유의미한 코너를 충분히 추출하지 못하는 현상이 실험적으로 입증된 바 있다.20

### **3.2. AKAZE (Accelerated KAZE)의 메커니즘과 UI 적합성 우위**

AKAZE는 KAZE 알고리즘의 연산 속도를 비약적으로 가속화한 버전으로, 일반적인 가우시안 척도 공간(Gaussian Scale-Space) 대신 편미분 방정식(PDE)에 기반한 \*\*비선형 비등방성 확산 필터(Non-linear Anisotropic Diffusion Filter)\*\*를 활용하여 스케일 스페이스를 구축한다.19 헤시안 행렬(Hessian Matrix)의 행렬식을 통해 특징점을 검출하고, 수정된 L-DB(Local Difference Binary) 디스크립터로 특징을 기술한다.19

* **선명도의 보존:** AKAZE의 비등방성 확산 메커니즘은 동질적인 픽셀 영역 내부에서는 강한 블러링을 적용하여 노이즈를 억제하지만, 픽셀 값의 변화율(Gradient)이 급격한 경계선(Edge) 부근에서는 블러링을 차단한다.19 결과적으로 노이즈는 제거되면서도 UI 컴포넌트의 얇은 외곽선이나 폰트의 날카로운 엣지는 원형 그대로 선명하게 보존된다.  
* **불변성 및 UI 인식률:** 수백만 회의 비교 벤치마크 연구에 따르면, AKAZE는 스케일 변화, 이미지 회전, 원근 왜곡(Perspective Distortions) 및 블러링 환경에서 SIFT에 필적하거나 이를 상회하는 가장 높은 강인함(Resilience)을 보여주었다.22 복잡한 폴더 구조나 텍스트가 밀집된 UI 스크린샷 매칭 시, ORB가 검출하지 못하는 미세한 체크박스 토글 등의 상태 변화를 AKAZE는 정밀한 국소 특징점 맵핑을 통해 완벽하게 잡아낸다.20

### **3.3. 소결: UI 상태 전이 추출을 위한 알고리즘 선택**

실시간 초당 60프레임의 객체 추적이 목표라면 ORB의 속도가 유리할 수 있다. 그러나 본 파이프라인의 목적은 오프라인 혹은 백그라운드 환경에서 동영상 파일 내 '미세한 소프트웨어 상태의 변화'를 논리적으로 군집화하고 추출하는 데 있다.10 이러한 목적 함수 하에서는 연산 속도의 미세한 손실을 감수하더라도, UI 화면의 기하학적 무결성(텍스트 렌더링, 컴포넌트 외곽선)을 파괴하지 않고 스케일 및 원근 왜곡에 강인한 대응이 가능한 **AKAZE 알고리즘을 특징점 추출기로 채택하는 것이 수학적으로도, 실증적으로도 압도적인 우위를 점한다**.20

## ---

**4\. Node.js (npx) 및 CLI 환경에서의 OpenCV WebAssembly (WASM) 성능 병목 분석 및 최적화 전략**

본 연구 파이프라인은 파이썬이나 무거운 C++ 로컬 데스크톱 환경이 아닌, 범용성을 갖춘 Node.js의 npx 명령어를 통해 실행되는 경량 유틸리티로 설계되었다.10 이를 위해 OpenCV의 C++ 소스 코드를 Emscripten(LLVM 기반 컴파일러)을 통해 컴파일한 WebAssembly (WASM) 모듈인 opencv.js 생태계를 활용해야 한다.26 WASM은 자바스크립트 엔진(V8) 위에서 네이티브 C++에 근접한 수준(약 50\~80% 속도)으로 실행될 수 있는 고성능 바이너리 포맷을 제공한다.27 그러나 이를 프론트엔드 브라우저가 아닌 백엔드/CLI Node.js 환경에서 구동할 경우 심각한 최적화 난제들이 발생한다.28

### **4.1. CLI 환경의 콜드 스타트(Cold Start) 병목 현상**

서버리스 함수나 npx 일회성 실행 스크립트에서는 최초 모듈 로딩 시간인 콜드 스타트 지연이 유틸리티의 체감 성능을 좌우한다. 공식 배포되는 표준 opencv.js 및 opencv.wasm 패키지는 영상 처리, 머신러닝, 딥러닝(DNN), 얼굴 인식(Objdetect), VideoIO 등 수십 가지 모듈을 모두 포함한 '거대한 집합체(Kitchen Sink)'로 제공되며, 그 크기가 수십 메가바이트(MB)에 달한다.30 Node.js 환경에서 이 방대한 바이너리 스트링(종종 Base64로 인코딩됨)을 디코딩하고 메모리에 로드한 뒤 인스턴스화를 수행하는 데에만 수 초 이상의 초기 병목이 발생하여 파이프라인의 민첩성을 훼손한다.31

### **4.2. WASM 힙 메모리 할당의 오버헤드와 가비지 컬렉션 누수**

자바스크립트 엔진(V8)과 WebAssembly는 메모리 관리 철학이 근본적으로 다르다. 자바스크립트는 내장된 가비지 컬렉터(GC)가 사용되지 않는 객체를 자동으로 추적하고 메모리를 회수하지만, WASM은 명시적으로 선할당된 연속적인 선형 메모리 힙(Linear Memory Heap) 블록을 사용하며 수동으로 메모리를 해제해야 한다.32

1. **ALLOW\_MEMORY\_GROWTH 병목:** 대용량 프레임 행렬(cv.Mat) 연산 중에 초기 할당된 힙 메모리 용량을 초과하면, WASM은 ALLOW\_MEMORY\_GROWTH=1 플래그에 따라 새로운 더 큰 메모리 블록을 OS에 요청하고 기존 데이터를 복사하는 오버헤드를 발생시킨다. 이는 수천 ms 이상의 프레임 드롭을 유발한다.32  
2. **메모리 누수(Memory Leak):** Phase 1의 특징점 추출 루프를 돌면서 매 프레임마다 생성되는 영상 매트릭스(cv.Mat), 특징점 벡터(KeyPointVector), 디스크립터 매트릭스 인스턴스들을 코드 내에서 수동으로 delete() 호출을 통해 파괴하지 않으면, 단 몇 십 프레임 처리만으로도 Node.js 힙 아웃 오브 메모리(OOM) 에러를 발생시키며 프로세스가 강제 종료된다.32

### **4.3. 바이너리 경량화(Pruning) 및 메모리 최적화 전략**

이러한 한계를 돌파하기 위해서는 범용 OpenCV 패키지를 버리고, 철저히 커스터마이징된 최소한의 빌드를 구성해야 한다.30

* **커스텀 모듈 컴파일 (Selective Shopping):** OpenCV 소스 코드 컴파일 시 설정 파일(platforms/js/opencv\_js.config.py)을 수정하여, 파이프라인 구동에 필수적인 Core, Imgproc(색상 변환 및 필터), Features2D(AKAZE 및 매칭 연산) 모듈만을 남기고 dnn, objdetect, videoio, photo 등의 무거운 모듈을 전부 화이트리스트에서 제외하여 주석 처리한다.30 이를 통해 바이너리 크기를 극적으로(1\~2MB 수준) 감축시킬 수 있다.  
* **컴파일러 최적화 플래그 적용:** Emscripten의 컴파일 옵션 중 크기 최적화를 극대화하는 wasm-opt \-Oz 플래그를 적용하고, 불필요한 C++ 표준 입출력 라이브러리(iostream 등 포함 시 템플릿 확장으로 바이너리가 비대해짐)를 cstdio로 대체하여 함수 테이블의 크기를 최소화한다.33  
* **선할당 메모리 풀링(Memory Pooling):** 루프 내부에서 지속적인 메모리 생성과 해제를 반복하는 대신, 최대 해상도(예: 1080p, 4K)에 대응하는 크기의 cv.Mat 객체를 초기 1회만 할당한 후 데이터를 덮어쓰는 풀링 기법을 적용하면, WASM 런타임의 동적 메모리 재할당 오버헤드를 원천적으로 차단할 수 있다.

## ---

**5\. UI 해상도 독립적 공간 군집화(DBSCAN)와 시공간 추적의 수리적 최적화**

추출된 특징점들 사이에서 의미 있는 '상태 전이'를 수학적으로 증명하기 위해 의뢰서는 DBSCAN 군집화 알고리즘을 사용한다.10 데이터 사이언스와 기계학습 분야에서 DBSCAN은 노이즈 처리에 탁월하며 기하학적 형태에 구애받지 않는 강력한 군집화 도구로 평가받는다.34

### **5.1. K-Means의 한계와 DBSCAN의 타당성**

소프트웨어 UI 컴포넌트는 매우 다양한 형태와 배치를 가진다. K-Means 알고리즘은 중심점(Centroid) 기반으로 데이터를 분할하므로 원형(Spherical) 군집을 찾는 데는 유리하나, 길쭉한 프로그레스 바나 L자 형태의 메뉴와 같은 임의의 형태(Arbitrary Shape)를 군집화하는 데는 실패한다.12 또한 화면에 몇 개의 UI 변화가 생길지 사전에 알 수 없으므로, 군집의 수(K)를 미리 지정해야 하는 K-Means는 본 파이프라인에 사용할 수 없다.13 반면 DBSCAN은 밀도를 기반으로 핵심 포인트(Core Point)를 중심으로 확장해 나가며 군집 개수를 스스로 판별하고, 밀도가 낮은 포인트들은 노이즈(Outliers)로 분류하여 완벽히 무시하므로 본 연구 목적에 가장 부합한다.13

### **5.2. 해상도 독립성을 위한 하이퍼파라미터(![][image11]) 동적 스케일링**

DBSCAN의 성능은 이웃 반경 거리인 ![][image12](![][image13])와 반경 내 최소 샘플 수인 ![][image14](MinPts)라는 두 개의 하이퍼파라미터에 극도로 민감하게 반응한다.36 스크린 레코딩 환경에서는 모바일 디스플레이부터 4K 해상도 모니터까지 픽셀 단위가 천차만별이므로 고정된 픽셀 상수값을 사용할 수 없다.

* ![][image13] **(eps) 파라미터의 정규화:** 연구 의뢰서는 화면의 대각선 길이 $D\_{diag} \= \\sqrt{Width^2 \+ Height^2}$를 기준으로 반경을 정규화하는 ![][image15] 공식을 제안한다.10 이는 매우 합리적인 수리 모델로, 해상도에 종속되지 않는 스케일 불변성을 부여한다. ![][image16] 값은 일반적인 웹/앱 UI에서 버튼이나 체크박스가 차지하는 비율을 고려하여 0.01 \~ 0.03 사이로 튜닝되는 것이 적절하다.10 또한, 더 고도화된 구현을 위해서는 데이터 세트의 k-distance 그래프를 도출한 후, 곡선의 기울기가 급격히 꺾이는 최대 곡률(Maximum Curvature) 지점을 최적의 ![][image13] 값으로 실시간 산출하는 휴리스틱을 추가할 수 있다.36  
* ![][image17] **(![][image14]) 파라미터 최적화:** 일반적으로 ![][image17]는 데이터 차원(D)의 2배인 ![][image18] (2D 좌표의 경우 4)로 설정하는 것이 권장된다.37 하지만, AKAZE 알고리즘이 고해상도 환경에서 텍스트 노이즈 주변으로 수백 개의 조밀한 특징점을 폭발적으로 반환할 경우, ![][image17]가 너무 낮으면 노이즈가 단일 군집으로 오인될 위험이 있다.12 따라서 프레임 단위로 추출된 전체 신규 특징점(![][image4])의 개수 분포 밀도에 비례하여 ![][image17] 임계값을 동적으로 스케일링하는 가중치 팩터 모델 도입이 요구된다.

### **5.3. 시공간 IoU(Intersection over Union) 추적을 통한 애니메이션 필터링 수식 전개**

로딩 스피너 등의 반복 애니메이션 노이즈 영역(![][image7])을 식별하는 Phase 3의 핵심은, 프레임 단위의 바운딩 박스를 시간 축(Temporal Axis)으로 연결하는 것이다.10 객체 감지(Object Detection) 평가 지표로 널리 쓰이는 자카드 지수(Jaccard Index), 즉 IoU 공식은 다음과 같다.15

![][image5]  
시점 ![][image2]와 ![][image3]의 군집 바운딩 박스를 매칭하여 IoU 값이 0.9 이상으로 높다면 공간적으로 움직이지 않았음을 의미한다. 만약 이 상태가 설정된 임계 프레임 횟수 ![][image8] 이상 지속되는데, 해당 박스 내부의 특징점 집합 변화량(Phase 1의 차집합)이 지속적으로 양수(+)를 기록한다면 이는 위치는 고정되어 있으나 내부 픽셀 텍스처만 요동치는 전형적인 프로그레스 바나 애니메이션의 시공간적 패턴이다.16

이 영역이 동적 영역(![][image7])으로 지정된 후에는, 해당 좌표 ![][image7] 내부에 군집화되는 모든 새로운 특징점 점수 $P(t)$에 시간의 경과 ![][image19]에 따른 점수 감쇠 계수(Decay Coefficient) ![][image9] (![][image20])를 곱하여 ![][image21] 형태로 반영률을 지수적으로 소멸시킨다.10 이 수학적 감쇠 모델을 통해 의미 없는 픽셀 깜빡임으로 인해 프레임이 핵심 프레임(Keyframe)으로 잘못 선별되는 치명적인 오류를 원천 차단할 수 있다.

## ---

**6\. VLM 토큰 최적화 및 정보 이득 기반 프루닝 (Token Optimization & Economics)**

수학적 연산을 통해 동영상 프레임을 엄격히 필터링하고 군집화하는 궁극적인 이유는, 다운스트림(Downstream) 태스크를 수행할 비전-언어 모델(VLM)의 컴퓨팅 자원 병목 현상을 해소하고 컨텍스트 유지율(Context Retention Rate)을 극대화하기 위함이다.

### **6.1. 멀티모달 VLM의 시각 토큰 한계와 컨텍스트 부패(Context Rot)**

Llava, Qwen2.5-VL 모델을 필두로 한 최신 VLM 구조는 ViT(Vision Transformer) 인코더를 사용하여 입력 이미지를 다수의 시각 패치 토큰(Visual Patch Tokens)으로 나눈 뒤 LLM의 언어 토큰 흐름에 이어 붙인다.6 단 한 장의 고해상도 이미지가 수백 개에서 많게는 수천 개의 토큰을 소비한다.6 이를 긴 동영상(Long-form Video) 시나리오에 적용할 경우 토큰 수가 허용 문맥 창(Context Window)을 순식간에 초과하게 된다. 또한 입력 시퀀스가 극단적으로 길어질 경우, 모델이 프롬프트 중간에 위치한 중요한 단서(예: 찰나의 순간에 지나가는 에러 메시지 팝업)를 망각하거나 집중력을 상실하는 '니들 인 어 헤이스택(Needle-in-a-Haystack)' 현상과 컨텍스트 부패(Context Rot) 문제가 심화된다.40

### **6.2. 탐욕 알고리즘을 활용한 정보 이득 최적화 (Greedy Pruning)**

최근 연구계에서는 VLM 추론을 가속화하기 위해, 모델 내부의 어텐션 점수를 기반으로 덜 중요한 토큰을 잘라내는 KVTP(Keyframe-oriented Vision Token Pruning)나 InfoPrune 기법 등 다양한 동적 토큰 압축 연구가 활발히 진행되고 있다.41 그러나 본 파이프라인(Phase 4)은 AI 모델을 직접 통과시키기 이전에, OpenCV의 가벼운 수학적 사전 연산을 통해 영상 차원 자체에서 프레임 구조를 선제적으로 프루닝(Pruning)한다는 점에서 연산 효율성의 결이 다르다.10

* **프레임 단위 정보 이득 점수 (![][image10]):** 인접 프레임 간의 DBSCAN 신규 군집 면적과 밀도 값을 바탕으로 각 시점별로 논리적 상태 전이 확률을 수치화한 $G(t)$를 계산한다.  
* **탐욕 알고리즘(Greedy Pruning)의 적용:** 전체 시퀀스에서 $G(t)$가 가장 낮은 인접 프레임 쌍을 반복적으로 찾아 병합(Merge)하거나 제거하여 궁극적으로 설정한 타겟 프레임 수 $N\_{target}$에 도달한다.

이 탐욕적 압축 방식은 고정된 주기(예: 1초에 1장)로 비디오를 샘플링하는 전통적 방식이 가진 맹점(중요한 찰나의 전이를 누락할 위험)을 완벽히 보완한다.45 이를 통해 영상 데이터의 프레임 수를 원본 대비 90% 이상 획기적으로 감축하더라도(극단적인 토큰 압축률 달성), 버그 발생 순간이나 UI 화면이 전환되는 맥락적 연속성(Spatio-temporal Continuity)은 고스란히 유지된다.45

### **6.3. JSON 텍스트 메타데이터 치환을 통한 크로스 모달 치환 효율성**

파이프라인의 시공간 추적으로 포착된 애니메이션 노이즈(![][image7]) 처리 방식은 토큰 경제학의 정수이다.10 VLM이 "화면에 로딩 바가 3초간 표시된 후 사라졌다"는 맥락을 시각 토큰만으로 인지하려면 최소 수십 장의 연속된 프레임을 어텐션 메커니즘으로 교차 검증해야 하며, 이는 막대한 연산을 요구한다. 그러나 본 유틸리티는 해당 영상 구간을 시각 데이터에서 모두 삭제하는 대신, **{"event": "loading\_spinner", "location": \[x1, y1, x2, y2\], "duration\_ms": 3000}** 라는 JSON 형태의 구조화된 메타 텍스트를 생성하여 VLM의 프롬프트 컨텍스트로 전달한다.10 언어 모델의 텍스트 토큰 처리 비용은 시각 토큰 대비 극히 저렴하므로, 픽셀의 시각적 변화(이종 모달리티)를 텍스트 메타데이터로 영리하게 치환(Substitution)하여 전달하는 이 기법은 모델의 추론 정확도를 저하시키지 않으면서 VLM 호출 비용을 획기적으로 절감하고 응답 속도를 극대화하는 결과를 가져온다.46

## ---

**7\. 최신 소프트웨어 QA 자동화 기술 동향(2025-2026) 및 본 연구의 시사점**

본 연구 의뢰서가 제안하는 '화면 녹화 기반 압축 및 메타데이터 변환 파이프라인'은 2025년 이후의 소프트웨어 테스트 및 QA 엔지니어링 생태계가 마주한 거대한 트렌드 변화와 완벽하게 궤를 같이하고 있다. 최근의 주요 동향은 구조적 스크립트 기반 테스트에서 자율형 비전 기반 테스트로의 진화로 요약된다.

### **7.1. 스크립트 기반 테스트의 몰락과 에이전틱 AI(Agentic AI)의 부상**

과거의 테스트 트렌드가 단순히 AI 코딩 어시스턴트를 활용해 Selenium 등 테스트 코드를 빠르게 생성(Generative AI)하는 것이었다면, 현재는 **에이전틱 AI(Agentic AI)** 기술로의 패러다임 시프트가 일어나고 있다.4 최신 VLM 기반의 QA 에이전트는 Jira와 같은 티켓 발행 시스템에서 사용자 요구사항을 텍스트로 읽고, 인간과 동일하게 시스템 UI를 시각적으로 직접 확인하며 무엇을 테스트할지 스스로 결정하고 행동(마우스 클릭, 키보드 입력)한다.4 기존의 DOM 레벨 자동화는 비동기 API 통신이나 동적 렌더링 프레임워크 환경에서 극심한 플레이키니스(Flakiness, 일관성 없는 간헐적 실패)를 겪어 유지보수에 막대한 시간과 비용을 소모하게 했다.1 그러나 VLM은 코드 레벨의 구현 구조(Implementation)가 아닌 픽셀 렌더링을 통한 사용자 경험(User Intent)을 직접 인지하므로('셀프 힐링(Self-Healing)' 기능), 프론트엔드 변경에 대한 내구성이 매우 뛰어나다.1

### **7.2. 결과론적 평가(Outcome-based Evaluation)와 구조화된 데이터의 가치**

에이전틱 AI가 복잡한 다단계 작업을 완료했는지 평가하기 위해서는 다양한 중간 상태(Intermediate States)와 최종 상태(Final State)를 신뢰성 있게 검증해야 한다.47 애플리케이션의 폼 제출이나 에러 팝업 발생과 같은 중요한 액션은 시스템 데이터베이스나 로그에 기록되지 않고 순수하게 프론트엔드 GUI에서만 나타나는 경우가 빈번하다.47 본 파이프라인이 생성하는 **압축된 상태 전이 핵심 프레임과 구조화된 JSON 메타데이터의 조합**은 VLM이 에이전트의 수행 결과를 정확하게 사후 평가하고 버그의 발생 원인을 분석하기 위한 완벽한 지표(Indicators) 역할을 수행한다. VLM은 JSON 데이터를 통해 버그 발생 직전의 UI 컴포넌트 위치와 애니메이션 지연 시간 등을 명확히 파악할 수 있어 원인 분석(Root Cause Analysis)의 신뢰도를 높인다.49

### **7.3. 엣지 컴퓨팅을 활용한 전처리 아키텍처의 당위성**

수십만 줄의 코드가 수시로 배포되는 CI/CD 환경에서 모든 UI 변동 상황이나 수천 건의 버그 리포트 동영상을 클라우드 기반의 대형 VLM으로 직접 전송하여 분석하는 것은 대역폭(Bandwidth) 문제와 엄청난 API 사용 비용(Token Cost)을 발생시킨다.50 따라서 무거운 딥러닝 아키텍처를 도입하기 전, 본 파이프라인과 같이 WASM(WebAssembly)으로 컴파일된 OpenCV 수리 연산 모듈을 통해 브라우저나 클라이언트의 Node.js 엣지(Edge) 단에서 1차적으로 비디오의 시맨틱(Semantic)을 90% 이상 구조적으로 압축(Semantic Compression)한 후 결과물만을 중앙 LLM 서버로 전송하는 분산 아키텍처는 필수적이다. 이는 엔터프라이즈 환경에서 지연 속도를 획기적으로 줄이고 품질 관리를 스케일업(Scale-up)하기 위한 가장 현실적이고 비용 효율적인 아키텍처라 평가할 수 있다.

## ---

**8\. 결론**

본 보고서에서 심층적으로 분석한 '화면 녹화 기반 UI 상태 전이 추출 및 멀티모달 컨텍스트 최적화 모델링' 연구 의뢰서는, 현대 소프트웨어 QA 자동화가 직면한 대형 비전-언어 모델(VLM)의 컴퓨팅 연산 폭증과 시각 노이즈로 인한 할루시네이션(Hallucination) 한계를 극복하기 위한 수리적이고 알고리즘적인 돌파구를 명확히 제시하고 있다.

본 연구의 가장 큰 의의는 비디오 전체를 맹목적으로 VLM에 주입하는 대신, 인간이 소프트웨어의 상태 변화를 인지하는 방식을 수학적으로 모델링하여 데이터 전처리에 적용했다는 점이다. 분석을 통해 다음과 같은 핵심 결론을 도출할 수 있다.

1. **알고리즘적 적합성과 강인성:** UI 도메인의 기하학적 특성(평행 이동의 강체 보존, 상태 전이 시 정보 밀도의 폭발)을 전제로 한 파이프라인 설계는 수학적으로 완벽히 타당하다. 특히, 얇은 텍스트와 작은 체크박스 등 정밀한 선형 요소가 많은 UI 화면의 특징점을 보존하기 위해 가우시안 블러가 아닌 비선형 비등방성 확산 필터 기반의 **AKAZE 알고리즘**을 도입하는 것이 정확도 측면에서 결정적인 역할을 수행한다.  
2. **Node.js (WASM) 환경의 엔지니어링 한계 극복:** 백엔드 및 CLI 유틸리티 환경의 콜드 스타트 지연과 메모리 병목 한계를 넘어서기 위해서는 OpenCV의 선별적 모듈 컴파일링(Custom WASM Build)과 V8 엔진의 힙 메모리를 고려한 명시적 객체 해제 풀링(Memory Pooling) 기법의 병행이 필수적인 엔지니어링 선결 과제이다.  
3. **토큰 경제학의 정점 (Token Economics):** DBSCAN의 밀도 기반 공간 군집화와 바운딩 박스의 시공간(Spatio-Temporal) IoU 추적을 결합하여 동적 애니메이션 노이즈를 필터링하는 방식은 고도로 지능적이다. 특히 의미 없는 픽셀의 변화를 폐기하고 이를 텍스트 형태의 구조화된 메타데이터(JSON)로 치환(Cross-modal Substitution)하여 모델에 제공하는 방식은, VLM의 연산량(토큰 소비)을 극단적으로 줄이면서도 정보의 보존율과 추론 정확도를 극대화할 수 있는 강력한 토큰 경제성(Token Economics) 모델이다.

결론적으로, OpenCV의 수학적 비전 처리와 VLM의 추론 능력을 결합한 이러한 하이브리드 파이프라인 아키텍처는, 단순히 비디오 데이터를 텍스트로 요약하는 도구를 넘어서, 인공지능 에이전트가 코드 구현 방식에 얽매이지 않고 실제 사용자의 관점에서 시스템의 논리적 전환과 흐름을 완벽히 이해하고 능동적으로 테스트를 수행할 수 있게 하는 '에이전틱 자율 QA(Agentic Autonomous QA)' 시스템의 핵심 코어 기술로 확고히 자리 잡을 것이다. 향후 연구로는 4K 이상의 초고해상도 다중 디스플레이 환경에서 특징점이 수십만 개로 폭증할 때 DBSCAN 군집화 처리 속도를 보장하기 위해 WebAssembly 내부의 SIMD(Single Instruction, Multiple Data) 연산 적용 및 멀티스레딩 최적화 병렬화 연구가 수반되어야 할 것이다.

#### **참고 자료**

1. Breaking the Brittleness: How LLMs and VLMs Are Transforming UI Test Automation, 2월 24, 2026에 액세스, [https://blog.zysec.ai/breaking-the-brittleness-how-llms-and-vlms-are-transforming-ui-test-automation](https://blog.zysec.ai/breaking-the-brittleness-how-llms-and-vlms-are-transforming-ui-test-automation)  
2. ScreenAgent: A Vision Language Model-driven Computer Control Agent \- IJCAI, 2월 24, 2026에 액세스, [https://www.ijcai.org/proceedings/2024/0711.pdf](https://www.ijcai.org/proceedings/2024/0711.pdf)  
3. a systematic review of computer vision advances in software quality assurance, 2월 24, 2026에 액세스, [https://aait.od.ua/index.php/journal/article/download/222/191/957](https://aait.od.ua/index.php/journal/article/download/222/191/957)  
4. Latest Trends in Test Automation: What's New in 2026? | White Test Lab, 2월 24, 2026에 액세스, [https://white-test.com/for-qa/useful-articles-for-qa/latest-trends-in-test-automation/](https://white-test.com/for-qa/useful-articles-for-qa/latest-trends-in-test-automation/)  
5. QA Automation Trends in 2025: Everything You Need to Know, 2월 24, 2026에 액세스, [https://qa.tech/blog/qa-automation-trends-in-2025](https://qa.tech/blog/qa-automation-trends-in-2025)  
6. Training-Free Token Pruning via Zeroth-Order Gradient Estimation in Vision-Language Models \- arXiv, 2월 24, 2026에 액세스, [https://arxiv.org/html/2509.24837v1](https://arxiv.org/html/2509.24837v1)  
7. \[2512.08240\] HybridToken-VLM: Hybrid Token Compression for Vision-Language Models, 2월 24, 2026에 액세스, [https://arxiv.org/abs/2512.08240](https://arxiv.org/abs/2512.08240)  
8. CVPR Poster TopV: Compatible Token Pruning with Inference Time Optimization for Fast and Low-Memory Multimodal Vision Language Model, 2월 24, 2026에 액세스, [https://cvpr.thecvf.com/virtual/2025/poster/33168](https://cvpr.thecvf.com/virtual/2025/poster/33168)  
9. Less Is More, but Where? Dynamic Token Compression via LLM-Guided Keyframe Prior, 2월 24, 2026에 액세스, [https://arxiv.org/html/2512.06866v1](https://arxiv.org/html/2512.06866v1)  
10. 화면 녹화 기반 UI 상태 전이 추출 연구 의뢰서  
11. (PDF) A comparative analysis of SIFT, SURF, KAZE, AKAZE, ORB, and BRISK, 2월 24, 2026에 액세스, [https://www.researchgate.net/publication/323561586\_A\_comparative\_analysis\_of\_SIFT\_SURF\_KAZE\_AKAZE\_ORB\_and\_BRISK](https://www.researchgate.net/publication/323561586_A_comparative_analysis_of_SIFT_SURF_KAZE_AKAZE_ORB_and_BRISK)  
12. Exploring and Implementing Density-Based Spatial Clustering of Applications with Noise (DBSCAN) Algorithm | CodeSignal Learn, 2월 24, 2026에 액세스, [https://codesignal.com/learn/courses/intro-to-unsupervised-machine-learning/lessons/exploring-and-implementing-density-based-spatial-clustering-of-applications-with-noise-dbscan-algorithm](https://codesignal.com/learn/courses/intro-to-unsupervised-machine-learning/lessons/exploring-and-implementing-density-based-spatial-clustering-of-applications-with-noise-dbscan-algorithm)  
13. DBSCAN — scikit-learn 1.8.0 documentation, 2월 24, 2026에 액세스, [https://scikit-learn.org/stable/modules/generated/sklearn.cluster.DBSCAN.html](https://scikit-learn.org/stable/modules/generated/sklearn.cluster.DBSCAN.html)  
14. SpOT: Spatiotemporal Modeling for 3D Object Tracking \- Stanford University, 2월 24, 2026에 액세스, [https://geometry.stanford.edu/projects/spot/docs/spot.pdf](https://geometry.stanford.edu/projects/spot/docs/spot.pdf)  
15. What is Intersection over Union (IoU)? \- Ultralytics, 2월 24, 2026에 액세스, [https://www.ultralytics.com/glossary/intersection-over-union-iou](https://www.ultralytics.com/glossary/intersection-over-union-iou)  
16. \[2209.02250\] Spatio-Temporal Action Detection Under Large Motion \- arXiv, 2월 24, 2026에 액세스, [https://arxiv.org/abs/2209.02250](https://arxiv.org/abs/2209.02250)  
17. A comparison of object detection algorithms using unmanipulated testing images \- Diva-Portal.org, 2월 24, 2026에 액세스, [https://www.diva-portal.org/smash/get/diva2:927480/FULLTEXT01.pdf](https://www.diva-portal.org/smash/get/diva2:927480/FULLTEXT01.pdf)  
18. Detecting and Tracking Objects with ORB Algorithm using OpenCV | by siromer \- Medium, 2월 24, 2026에 액세스, [https://medium.com/thedeephub/detecting-and-tracking-objects-with-orb-using-opencv-d228f4c9054e](https://medium.com/thedeephub/detecting-and-tracking-objects-with-orb-using-opencv-d228f4c9054e)  
19. Comparative Analysis of Detectors and Feature Descriptors for Multispectral Image Matching in Rice Crops \- PMC, 2월 24, 2026에 액세스, [https://pmc.ncbi.nlm.nih.gov/articles/PMC8465351/](https://pmc.ncbi.nlm.nih.gov/articles/PMC8465351/)  
20. A comparison of feature extraction methods in image stitching \- Advances in Engineering Innovation, 2월 24, 2026에 액세스, [https://www.ewadirect.com/proceedings/ace/article/view/4570/pdf](https://www.ewadirect.com/proceedings/ace/article/view/4570/pdf)  
21. SIFT vs ORB vs FAST / Performance Comparison of Feature Extraction Algorithms \- Medium, 2월 24, 2026에 액세스, [https://medium.com/@siromermer/sift-vs-orb-vs-fast-performance-comparison-of-feature-extraction-algorithms-d8993c977677](https://medium.com/@siromermer/sift-vs-orb-vs-fast-performance-comparison-of-feature-extraction-algorithms-d8993c977677)  
22. Comprehensive empirical evaluation of feature extractors in computer vision \- PMC \- NIH, 2월 24, 2026에 액세스, [https://pmc.ncbi.nlm.nih.gov/articles/PMC11623105/](https://pmc.ncbi.nlm.nih.gov/articles/PMC11623105/)  
23. Poor feature detection performance with ORB and Akaze compared to sift \- OpenCV, 2월 24, 2026에 액세스, [https://forum.opencv.org/t/poor-feature-detection-performance-with-orb-and-akaze-compared-to-sift/12616](https://forum.opencv.org/t/poor-feature-detection-performance-with-orb-and-akaze-compared-to-sift/12616)  
24. View of Feature Extraction Based on ORB- AKAZE for Echocardiogram View Classification, 2월 24, 2026에 액세스, [https://ijeces.ferit.hr/index.php/ijeces/article/view/1977/288](https://ijeces.ferit.hr/index.php/ijeces/article/view/1977/288)  
25. AKAZE and ORB Planar Tracking Comparisson | PPTX \- Slideshare, 2월 24, 2026에 액세스, [https://www.slideshare.net/slideshow/akaze-and-orb-planar-tracking-comparisson/81007990](https://www.slideshare.net/slideshow/akaze-and-orb-planar-tracking-comparisson/81007990)  
26. Measuring Opencv.js performance with Wasm execution engine in desktop, embedded and mobile browsers \- SEDICI, 2월 24, 2026에 액세스, [https://sedici.unlp.edu.ar/bitstream/handle/10915/89186/Documento\_completo.pdf-PDFA.pdf?sequence=1](https://sedici.unlp.edu.ar/bitstream/handle/10915/89186/Documento_completo.pdf-PDFA.pdf?sequence=1)  
27. Performance Evaluation of Digital Image Processing on the Web using WebAssembly \- Diva-portal.org, 2월 24, 2026에 액세스, [https://www.diva-portal.org/smash/get/diva2:1764648/FULLTEXT02.pdf](https://www.diva-portal.org/smash/get/diva2:1764648/FULLTEXT02.pdf)  
28. Karpovich V.D., Gosudarev I.B. WebAssembly performance in the Node.js environment, 2월 24, 2026에 액세스, [http://aurora-journals.com/library\_read\_article.php?id=74049](http://aurora-journals.com/library_read_article.php?id=74049)  
29. WebAssembly performance in the Node.js environment \- ResearchGate, 2월 24, 2026에 액세스, [https://www.researchgate.net/publication/390931502\_WebAssembly\_performance\_in\_the\_Nodejs\_environment](https://www.researchgate.net/publication/390931502_WebAssembly_performance_in_the_Nodejs_environment)  
30. How to Custom Build OpenCV for JavaScript (and Slim It Down) | by Win Jinkawin \- Medium, 2월 24, 2026에 액세스, [https://medium.com/@jinkawin.p/how-to-custom-build-opencv-for-javascript-and-slim-it-down-c9f832c1dcd5](https://medium.com/@jinkawin.p/how-to-custom-build-opencv-for-javascript-and-slim-it-down-c9f832c1dcd5)  
31. JS: npm package · Issue \#15315 \- GitHub, 2월 24, 2026에 액세스, [https://github.com/opencv/opencv/issues/15315](https://github.com/opencv/opencv/issues/15315)  
32. OpenCV in the Browser? Lets give it a try \- Software \- Kinograph Forums, 2월 24, 2026에 액세스, [https://forums.kinograph.cc/t/opencv-in-the-browser-lets-give-it-a-try/2649](https://forums.kinograph.cc/t/opencv-in-the-browser-lets-give-it-a-try/2649)  
33. How to reduce size of WASM binary? \- c++ \- Stack Overflow, 2월 24, 2026에 액세스, [https://stackoverflow.com/questions/74720960/how-to-reduce-size-of-wasm-binary](https://stackoverflow.com/questions/74720960/how-to-reduce-size-of-wasm-binary)  
34. A Guide to the DBSCAN Clustering Algorithm \- DataCamp, 2월 24, 2026에 액세스, [https://www.datacamp.com/tutorial/dbscan-clustering-algorithm](https://www.datacamp.com/tutorial/dbscan-clustering-algorithm)  
35. DBSCAN Clustering Algorithm \- How to Build Powerful Density-Based Models, 2월 24, 2026에 액세스, [https://towardsdatascience.com/dbscan-clustering-algorithm-how-to-build-powerful-density-based-models-21d9961c4cec/](https://towardsdatascience.com/dbscan-clustering-algorithm-how-to-build-powerful-density-based-models-21d9961c4cec/)  
36. DBSCAN Parameter Estimation Using Python | by Tara Mullin \- Medium, 2월 24, 2026에 액세스, [https://medium.com/@tarammullin/dbscan-parameter-estimation-ff8330e3a3bd](https://medium.com/@tarammullin/dbscan-parameter-estimation-ff8330e3a3bd)  
37. Estimating/Choosing optimal Hyperparameters for DBSCAN \- Stack Overflow, 2월 24, 2026에 액세스, [https://stackoverflow.com/questions/15050389/estimating-choosing-optimal-hyperparameters-for-dbscan](https://stackoverflow.com/questions/15050389/estimating-choosing-optimal-hyperparameters-for-dbscan)  
38. Intersection over Union (IoU) for object detection \- PyImageSearch, 2월 24, 2026에 액세스, [https://pyimagesearch.com/2016/11/07/intersection-over-union-iou-for-object-detection/](https://pyimagesearch.com/2016/11/07/intersection-over-union-iou-for-object-detection/)  
39. Intersection over Union (IoU): Definition, Calculation, Code \- V7 Go, 2월 24, 2026에 액세스, [https://www.v7labs.com/blog/intersection-over-union-guide](https://www.v7labs.com/blog/intersection-over-union-guide)  
40. Context Rot: How Increasing Input Tokens Impacts LLM Performance | Chroma Research, 2월 24, 2026에 액세스, [https://research.trychroma.com/context-rot](https://research.trychroma.com/context-rot)  
41. Keyframe-oriented Vision Token Pruning: Enhancing Efficiency of Large Vision Language Models on Long-Form Video Processing, 2월 24, 2026에 액세스, [https://openaccess.thecvf.com/content/ICCV2025/papers/Liu\_Keyframe-oriented\_Vision\_Token\_Pruning\_Enhancing\_Efficiency\_of\_Large\_Vision\_Language\_ICCV\_2025\_paper.pdf](https://openaccess.thecvf.com/content/ICCV2025/papers/Liu_Keyframe-oriented_Vision_Token_Pruning_Enhancing_Efficiency_of_Large_Vision_Language_ICCV_2025_paper.pdf)  
42. INFOPRUNE: REVISITING VISUAL TOKEN PRUNING FROM AN INFORMATION-THEORETIC PERSPECTIVE \- OpenReview, 2월 24, 2026에 액세스, [https://openreview.net/pdf?id=JmdvXuMELg](https://openreview.net/pdf?id=JmdvXuMELg)  
43. Keyframe-oriented Vision Token Pruning (KVTP) \- Emergent Mind, 2월 24, 2026에 액세스, [https://www.emergentmind.com/topics/keyframe-oriented-vision-token-pruning-kvtp](https://www.emergentmind.com/topics/keyframe-oriented-vision-token-pruning-kvtp)  
44. Towards Adaptive Visual Token Pruning for Large Multimodal Models \- arXiv, 2월 24, 2026에 액세스, [https://arxiv.org/html/2509.00320v1](https://arxiv.org/html/2509.00320v1)  
45. Keyframe-oriented Vision Token Pruning: Enhancing Efficiency of Large Vision Language Models on Long-Form Video Processing \- arXiv, 2월 24, 2026에 액세스, [https://arxiv.org/html/2503.10742v1](https://arxiv.org/html/2503.10742v1)  
46. Building a Simple VLM-Based Multimodal Information Retrieval System with NVIDIA NIM, 2월 24, 2026에 액세스, [https://developer.nvidia.com/blog/building-a-simple-vlm-based-multimodal-information-retrieval-system-with-nvidia-nim/](https://developer.nvidia.com/blog/building-a-simple-vlm-based-multimodal-information-retrieval-system-with-nvidia-nim/)  
47. Foundations and Recent Trends in Multimodal Mobile Agents: A Survey \- arXiv, 2월 24, 2026에 액세스, [https://arxiv.org/html/2411.02006v3](https://arxiv.org/html/2411.02006v3)  
48. 5 AI trends shaping software testing in 2025 \- Tricentis, 2월 24, 2026에 액세스, [https://www.tricentis.com/blog/5-ai-trends-shaping-software-testing-in-2025](https://www.tricentis.com/blog/5-ai-trends-shaping-software-testing-in-2025)  
49. How multimodal AI is changing software testing \- Tricentis, 2월 24, 2026에 액세스, [https://www.tricentis.com/blog/multimodal-ai-software-testing](https://www.tricentis.com/blog/multimodal-ai-software-testing)  
50. Future of VQA: How Multimodal AI Is Transforming Video Analysis \- SoftServe, 2월 24, 2026에 액세스, [https://www.softserveinc.com/en-us/blog/multimodal-ai-for-video-analysis](https://www.softserveinc.com/en-us/blog/multimodal-ai-for-video-analysis)  
51. QA Trends 2025: The Future of Software Testing \- OrangeLoops, 2월 24, 2026에 액세스, [https://orangeloops.com/2025/04/qa-trends-2025-the-future-of-software-testing/](https://orangeloops.com/2025/04/qa-trends-2025-the-future-of-software-testing/)

[image1]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADgAAAAYCAYAAACvKj4oAAACi0lEQVR4Xu2Xz4tOYRTHj5+R0GxYoZTtZDHCWAiFsrWQZGaUshkbERZ2SlaUBQsLLEXKP4ASJYUUM1OzmCTMEPltpuF85zmP93m/97z3zrzXfUnzqW/3Pt9zzvPeeX7dOyLT/BM8UP1U3eXA32ArGyUZSe4vq0aTNthF7SmxQnVedU61iGIeB1RH2SwJZu6U3c+wdspK1WPyCjkjoaO91l6ueqP69jsjyzLVSzYTMBPoM4oZlPp4X314gjXi155VXWDTY6aEDm5zwBhTjbNpoG4em8QN1UMJuespBmarnrGZgOW5m03D+8MzIAkj2YjNEnK2kN+p+k6eB2rn2vUHxUCvagebxkXJ329XpGCpvpDiUYgzfJV8jOxk9t4HuyIf/WDGUl5RO7JPtc7uN6SBhMWS8/wbJQRvkc+0Sch7Tz68+eQx7apDdo+HRM2dWngC7wE7JBwy3ar94u/NCOrdwzCOaNEe2iMh71HiLTSviOuqWUkbNVx3j9og5qVqBGLH2ARFhZF+CXl4HUQ2mVcE52BW4MVZRZ9l36Ho7xKbSyzAD+Dh5fU4nkfcfylpf6/TQJN8Vd1nE8sGP4JgHjsl5PErpMv8PFarDrOpPJVQu8quZfks4TWUwZsZplEOTjfPT7kp2RMTLJBQi9nlA6cZ0Bf2egb8QN5DDkmIz+GA1E7WPPLi+HBAHHu5LOjnOJsRBJ+wqQxL9gOXQS1e4B4HJcTxHemxXfIHYCqgHwx4Q+L3IjYq9iTu19Zl+CAvnoYRLMmPqnemL6ptdRk13rLRBHG5V8IR1Sc2Wwz+67nG5p8Eo+cdJK2istmLYC8NsNkiTqhOslkFpyV8L7aSparnbFZJFxsVg1N6mv+WX033qXo08PhCAAAAAElFTkSuQmCC>

[image2]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAcAAAAYCAYAAAA20uedAAAAcklEQVR4XmNgGOTgGxCfQheEgf9AXIAuCAL6DBBJJmRBGyD2AuLdUElfKB8MioC4BCrxFsoHYRQAksxFFwQBXQaIJCO6BAisYYBIYgUgiXfogjAAkgQ5CgaOILHBkipQ9k9kCRDoYYAo+AHELGhywwEAAMS4F/hUVNxNAAAAAElFTkSuQmCC>

[image3]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACgAAAAYCAYAAACIhL/AAAAA5klEQVR4Xu2TPQoCMRBGRxG8iK3YWHoCQS9hLYh4DI9iJVjZaiMW3kEFBbX0p9IZkoUwZLOZ1WkkDx4k82XhYzcLkEgkXM58wLmjGz5UZoe+HYPQgREfRrLgAyFzKCjYAnOgyoNI1Ap20C66BHOgZ/dS1AqO0QmY8Gr3pBS1ghkUDvlQgGrBJpiwwgMP7RzXnhkZe6eDBWcQCBn9HLeeGVk3jxUSLEjBjQ+FqH5iCuhHyVg561jUCzbs+uUGAr4tSC+FenivxBRM+ERrLIulbMEHekIP6B49ohd04B76BWULJhKJv+YDpPxBzc42UAMAAAAASUVORK5CYII=>

[image4]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACUAAAAYCAYAAAB9ejRwAAABeElEQVR4Xu2VPSwEURDHBydRCMn1OpEoTyEKUakuaBRUKoXqoqAgotSIRkWO5BI1hUiQKOkoTkGCqBQ+Q2gUvv6TN495z+1FxO1LZH/JLzdv3tzu7O5slijhn9ICF2Gvyo2pOFZq4RvMwwbYBd/hFHxSdbHCDXT6STL5ST8ZBwUyJy8F5/kuxg6fuFxTQbBNzfkbIZmlr8asC05FIHL0vbETpyIw3VR+zipOv58QVihQU31w1E8K4xSoqQO45ieFV3KHfQe+wGp4BYtwQu0z0/AM7sNGyR3Bx88K81I1wTRFXLSdm3ovv0rup6UKtsJLuKHy+qCHcFit+fM0IDFfYJ3E+j8lm7ogc+UPZAru5begajT6IFl4LHGN7G3Bazhji4SoRp5V/Gv0Ae9gm8Tt3p5mCO5J3EPmsVui5vnH8KPZVmvbxKa3ZlJwWWKeuyWJ5+G6xH/ykd+FzWp9Cs/VegTekBmBQZVnbsncrQ4yo8IvQsapSEioAB+bdF2vhtUY9AAAAABJRU5ErkJggg==>

[image5]: <data:image/png;base64,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>

[image6]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACMAAAAYCAYAAABwZEQ3AAABaUlEQVR4Xu2Uuy8GQRTFj0ciRCh0WrVapZGoaCUiERKVRC0kCpGI1h/gL1CpREmiU3gUQoGoSMQjGs+Eubmzu7Nn7+76KM0vufnmnjN7Mt/szAKRyN84dvXi6iuox9yMem6Qf/7D1UXgL5L/GngmycTf0g19fp+NgB/lt0InHrLRAGvQjEE2Au5ZsJiHBo2w0QDvqP7nM67mWLR4RnVQwrirTVdjbKD+NV+7amLRoi5oEur3+X7d1WdmowPq7wQaU5WfkpyXAzY8sr1WkGjTfrzi+4HULXLLgsUCNGiUDY942yxC9S0/fvN9GVOuZlm0qDovy1Cvk/Qur8sNEmRcliFcsVBGVdAdbG8Dqjf7XsZnmV1Adq6WFmjQERueXdiLEW2P+sugD5FF9rJoIbdCgibY8PRA/bZAO0dx21dhL/rE1TCLzCn0rDxAv4pPyF/VkH5kr1JqKG+nLEF9yZFf+Qi252ZEIpH/wje9Emfq1plydQAAAABJRU5ErkJggg==>

[image7]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACQAAAAYCAYAAACSuF9OAAABqElEQVR4Xu2WTStFURSGF1FGCFMMUAYmJhI/wJCJGJkY+AfExEAZKAMfMTERfoEyUAoDiZRkZCApyeeAfAvvumtve92lDE733EPdp97uXu86zl577b2vS5QjR+Y5hz6V7qBr6Ep5Fd9PZwGecNmaYIsk124TcVINHVsTzJAUM2oTcbMCFRmvh6SYVeNnhRoTN5IUc2L8RCgjKebJJpIgn8KN+hP4YvKM32FizzTJ8wU2kQleSV5eYvw+qMV4mli6eUby4gaboN8nrKcYztoGyaTdNgHGoHvjlUKX0D60Bg07fwhap7Ao3vYbN96DPqBi6Ijkv0Kby6UxTlLMpPGbKXStS/k8ie4Yj/33Vys0BU24eBBagCopXJZ+l6uinwtNwe1+J6neH2gWx+w/hkdTnEJzKrbbybG/EPy3vKU65+HOz6o4MvxSXjFTCz2rHGO756mj9MVxrlDFkXlQ4x1ohMJKy0luqh/rghZJttDjcwPKiwT//HiBLkgmvYV6VX4X2oYOoCXl8/bzOfLwYT9UcSzMqzF3QBeQCG/ucxPq1Imk4NvVZM1/yxcC6md5aVKv/gAAAABJRU5ErkJggg==>

[image8]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAB8AAAAYCAYAAAACqyaBAAABI0lEQVR4XmNgGAWjYBSMJMAJxM5A7AHEXlAMYrsgK6IF2A3E//FgV4RS6oJcIF6MxN8IxBJIfJoCazQ+yKf4AEj9EyDegS5BKWBhIGw5CDwHYht0QUpBPxB/QBfEAohxIMkAZCjIAdjANiBeAMQrGRCWMwHxWSC+DeWDwAsk9jkg/gTEeQwQvTFIchgAZKgOuiADxAAjKLsNiA9A2begNHJIwNipSHweIL7BgNtjDPIM2INTjQFVHJTYHJD4TUC8BMq2BeL7SHIggM1MosEEIL6LxEc3DMQHFVAgACovUpDk0hgg0UU2AGWteVC2BgPCckMojS3IL0Dpp0BsDmWTDR4yQBIWKHt9ZEAYDgKeQPweiC8BcRkQnwFiDqgceiiNghEOAIbEQTjU+SD6AAAAAElFTkSuQmCC>

[image9]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAsAAAAYCAYAAAAs7gcTAAAAf0lEQVR4XmNgGAX0BtJAvAyIc9ElgMAWmXMMiP8j4TfIkkBwA8bIA+K3QMwK5UsyQDTIQvkLgZgNygZLoAMHID4AZYMMIghAhmQBsQi6BDYAcz9R4D0Q16AL4gJP0AXwAaKdwATEr9AFcYE6IO5GF8QF3gExH7ogLvAbXWAQAQAYqBfQoq3vPwAAAABJRU5ErkJggg==>

[image10]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACUAAAAYCAYAAAB9ejRwAAAB10lEQVR4Xu2WvSuGURjGb19RsitlUMqAksFnUWQgCQOrTYnE4GOR8hcYlEmipGQ0KJOvxSCDgQwmA4nB4iPuy3lejst9Hs/wyuJXV973d537cXqf83qI/PN39LIIUMYiKUWaUc2ipsTz9d5rnzVNI8sAR5oKlnGsaF4155oOTalmQXOlqYs6pl2zzfIHcJ18lhZY+CT24ilx/QkXYm80xbzYfZvmgSXzLPawD/oectOaY3I+mLllGYEOx8TkTtyCLC4Ia9NwtSw90ONsWuBs7bEEOHAYvOTCILQpplDcORsQ13dH75l+seflRVxRwEUC8Iusi3ZqxjUX4vqxKBbW/Ls0iwTMSvwsuhuWhDkft6kuTYumSdOsaZWv525ZwrMA3QhLAmvyLHnNMmJIMyOfG5/QZHr9UuQtysV1GVwQWPPt6MR9UinQn7FUJiU8uyHhzsdccyquyOUiYlhc38eFuG+VeVFx/p7eW4T8x6fl3xpQ7HUhQh38avR6U+yHMB7gofl3duRzA/gLjJ/4dgHcihBYV81S3CZS16uhLsWB5pBlOtjS7LNMCDacwzJdxN6CAA2aR5bpZE6zzvIH8CTJZpludjWVLAPg/Fax/C0GWQQI/ff6T2LeAFoVdveZAKD8AAAAAElFTkSuQmCC>

[image11]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAJgAAAAYCAYAAAAGcjT5AAAFhElEQVR4Xu2ZV4hsRRCGy4RZMSKmxasPZowIpnvNOSuK8ZojCiqKGXPA7MUsXhMIKmJAFBRzQhTBrOgaHlREfTBn65uu2qmpOTt3dneUfegPij31V58+Z/p0qO4VqVQqlUqlUqk0sLDaulms9M/bagtmsSLLqH2v9o/arylW6ZPjpTTgYjlQGYH2uSCLlcogWEFKB5s/ByqVQXCHlA72v7KD2oNqU5O+jdrFanOZv6OUcsuPlOhkA7Wb1Y7IgT44Ue3s4K+qdqParkFbRO1ytavUZgu6s6/aZVlUjlE7L/jUfavamUGbCHup3au2fQ4Yc6idpnZCDhhrqd0k7VmF/PEsKW0Sf+cpajOl5FKZ86Wz3WnLu6Q8O0Ln+j1pkY3UHlDbJQcCx6ndprZmDmRoYB64mfmXqF1j18tJ+cB8GMr8rLa+lM6GP93KOe+qXW/X86j9GWKzgobZSu0NtZ/U3lM72GJfm3+llB8FF0n3KPxSbQG1v9SeDfrRahuqfSjNdf9i1+Plb7VN7Hqa2hPtUAsGqH9QOhDX8d1pz+fVdjadjjLTYueYxoD4QEpnWdq0Za0MXKc2RUrdL0v5TTxrJSll524XbfkXBt/ZTUpsD/OZdF5rh1vMJ6WMb6AeUtu0He7EO9fsQSMxfsmuv7K/V0gpN6/58Ippjnc658Xkzwov+6ld04iOP//0oC1hmsNgONyu0Xm+4+U+suumuscLswQdzKGuV4O/n2kMOOd10xwfDNNNP7cdan1ItM+DBmgnJx94l/x78PleMGQ+HSWyuem0Y4RJJcLOk0nI4Z7tgt8BwXfsmg7CLBJfzpePP5IO3yRtPfM/kbKMjpWD7C91vBADUho3P5+lI2rT7O/iptMBHWYGaKqbGSzXPRYelXL/w2prpBgQY2bN2o/BZykEZqj8Loc0aMxiaKsFzT8yOqtOBI1vCLebn0Fj5geW5D1Nm3OkRAENYzXhLG1UmP4oyFrLcnOUjL6tp9wNDVp+UR89bnnt7wfu27pBezppLHX5+cAS26TDaHXfl7SxwDIUf7N/JPCPdGTQAI18LIPuq4fTNLiY4bIG/i5LJR3t7nD9W4gBaQU6sxz5K8c8Qx0l2uwjnb83L6EjMLU3vWSm10vTOR1PROnxnrPd3w73hb98Bs1zxKidlDRAvzaLyt7SXffqpsXla7wsKWVppD7qhcfNj7A5QvNNUwR92wYt5pOufZs0aMpLDzPNk3Gu8/kXORQ6q1C/rCPduWQHG8vowf3DddNL35K0N5MP+LsnjR1QnnIj70t3PYc2aAcEjVmXPArY9bhOjhE7Gol9rof0wDXyipib9QP35jqjPyP5wEzi2j1B7zW4pjZoW9p13KA0pTLMqD5jkV8RZ9JYWdozqy+5pBeZA8M1ZR4L/pBpo0KQNT5Co3M04fhL+7aYkYrPCzr47JScVUyL+On6D0mPEH8uaU1LxJNBiyM5fryPgw5NdaP5ji8m6v3C/RwvOJeqDQffZ3+H5RnftRh7K/nQlH/FieEMKbtEJ9YNxKO/dvDZUUfoiHcm7RFpb6z47nTmuCH8TO3Y4HdBYXYF/mJPdYZboHOu5f+/+kKalxRPlrFnOkMjDEvvowvunZI0kmHOvSJsuf1Z8f+NPhKxvBtqqpuBhJ5zkn7hGb5MYFd3hltsIe24fwzPVRf1QlLahaOGCOd03yUNGFTcz7GC43nUivYXiymMw/cjxtKZYTPi95LL5nPGUy2G8Rt6nZP1xUJSKovnLROF+iYz3oC9bJDtMShIzid723bBVnSQL83MQ/5WGTwscYP8Vv85TOc+YjnCyNPleIhb+Mrg8KVrWLqPRCYtO0nJH8hT4lo/EcgTKoOFVYGjDU7i+T/ooL5VpVKpVCqVwfMvxkCde8+IHccAAAAASUVORK5CYII=>

[image12]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABwAAAAYCAYAAADpnJ2CAAABWklEQVR4Xu2TvytHYRTGj19FyqKk/JjZyaIkgwEDs0EGKf+CDAYslAXxL5C/QFnIaGG0WMhgkyKc577P+b7vPd8rlhvD/dTTPec55773ve8PkYqKiv/IlOpUNeb8SdWmqoX5tIS+/lpHnhHVoWrJF4xV1adqnPmWapdxn+pAtc6eF9WwhI8jX2CfcavaY9yqek9qGfaxxsTrVF0yfuBzW0JfG3NwRc+wSRgXLs+AccMYL2AZ0iZMCLw5Hzw5b4j5nYRlrwN7hoYT1YZqWcLfFYG+/QLPT+Ij8aGmtLhG8yfaJfR1O98mazTw2Sxxz49jWWSUZhHzSYy/931Hzrt2OUA+57zMXHQe9hRXwbD962HexXyg1hFyXB1jkF4dOJ2vEtf8LF/OgI979cz4XsKR9zxKHOc8X/o9HRIG6PWFstiRb5amDFYkLhGujJ3C0phRTUg4QLOuVvH3fAFLIVWcYxPk2QAAAABJRU5ErkJggg==>

[image13]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAgAAAAYCAYAAADH2bwQAAAAZklEQVR4XmNgGAW4ABsQewCxO7qEKhD/B+LjQFwCxLHIkhFQSXFkQWQAkrwJxCxIGA5MoQpARu9AwnBQDFXAhCyIDAwYIArY0SWQwR8gPorEB5kmg8QHA5C9IJNA+CAQM6JKD2sAAPoREsiqMI75AAAAAElFTkSuQmCC>

[image14]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAHQAAAAYCAYAAAArrNkGAAAEQElEQVR4Xu2YWaiVVRTHl2mZlSU00GwTERXSS6hoZRQkUZJJJRJkAxQpPlQUmiHNQTRQ0GTEbRQfpLegh8ABoqdGLIVULCOxEaKiiVq/9lrnrLvO5nK9+nDPZf/gz9nrv/c37W8P6zsijUaj0WiMWQ5SnZvN0cxDqqey2fifb1X/mvoGbvaDbDY60D9/ZrPRv/BCH8lmoz85VcoLPTRX7G/OU70o3QtNVt2nukM1zhspd6sGVCcEzzlW9Zbq8OQfo1qjOsXiCVLO+4Lsnwc7XfWk6i7VxFTnXKt6Scpz1XhDdVWIr5HynCcHj/q1qtuD51ymelR1oMVXqN6WwcfDgAy9fx6helx1v5TkqcblUu53Ya5wuIlNqnlSLvaglAvDKvPOVm1VjVcdb96J1gY4lpu41Ooiu6QMAPyrVevNv9i8fWFAtTHE+XwMGDyuBT9azABz/rJf/AWqn1VTVJPMO1PKnndBaPeJleEkKYPzAav7TXW+lH4lXtxpWeLa/nmAlOPekfIi6ef8LPCL6hYr06ffhLoOG+x3sZST8GIcRjTeV8EDPGZEjOHZUAZm+dHSfaHvhTrAm528vSFe6+EUA/GbIWb1wJtuMS/8eSvj/21lBw/R4c5m85zd9vuE+QwEh+QwtqXMV0AGPw4S9yIXJu8f1R8h7kCnAzMwn+Smiuej55zgzbFf/I+Cv9R+n7O6CMfjcb6RQCdz/E+q61MdfCi917w5edOkbAHHmX9IqAM875/o7QnxSvtlpufrfRe8qVbO13jdfIcVYZv0Jk5MINoxSHy1GBIav588Zma+SWZw9uAoKT4zMoPvS5vzrvn7gi+hLjrNcS+yo+IBS2b2TzMv78t4NyYP8H22R8/P+0ooR7zNM6rl0p0cNbxt7dl6oMHciudLcvR+SB7UZoSD/1jF46WOlJis3SrlfN8Hjzjule7VromfB9yr5kfurHjgezWJYQRvXSjXlkh89sbhwrVIPjnOV8AeyJhqN4p3UcUj+YHfk88e6mWHhyQ+LHhkvniedX4W6obD01KOjy91h5RR7lA/K8S+RM+RchwvzMEnS43gxefLXvzzhOUx99/q5FH2ZZR/jKJfe/74BVBbzomPTF4HTpgPqO2fJDDu3as6I9Th02kzVDODnxMl8P0AyOw83R8un0v5LHA82YkQv5xib8MnjF/Tt4qYzADeiornyeD24HuH++ecD9izOi1KTN/cIIP7Z5nVRehncgOH+kUh5muhli13ILvz2eXQGexRGZZbLjA/+XQy/mvJ/0L1cfKAG6L9SP+oJnHwl7RF6snVr1LqP7V4vcUDFsN15mXw4goAq8zfmXw8BgkvgfLXqoMHtSj9SR2fiJl7pPssnCNn/uzjLMvehu/hUY/f7FD6stN69OCrQ/wub/Qx/EvFC22MAZZId/W4TXqX6EafcaXqEin/5eacotFoNBpjm/8AE0I/hs0iUrsAAAAASUVORK5CYII=>

[image15]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAIwAAAAYCAYAAAAoNxVrAAAENklEQVR4Xu2aaahNURTHl4yFjAmhh4RQMhYfPHOSjIUoheQL8kmGeBRJ8knmmZKMIZkyJGPIEDJkzJBZ5tn6W3u7+657zh3c++59j/2rf/Zea9939j57WnsfRB6Px+PxeDzFn/msN6yfRh9ZL1hfHVueLewpFAawXlHkfX8x+desb8b2jFXK/qAoYCurOUhib6gdnowT1gfgIYX7cgIqc1wbmS4kviva4ck4eM+ftdEB/iPamAuGkFSmm3Ywy0h8a5T9f2acNijaaEMS1CR5zzO1wyHeCpRVrlJ4RYpMJTNMd9YO1njtSIKJrI3aaOjPOqyNSbCI5D2X0w6HItMXQRVpSRJw3VX24g5mP9qab/JTTN6CjkuGyaztyobg9ZiyJUtQH2iSKZMVUAmcjM6wLpDso7CVdQtlmeWs9SFaS7JFrmKtNGV7//5VfFqQtKuqssO22aS/u44EYLBhlQIYLEExYLKgDp+00aECSZlU6lco2PgFwa3LNWP/l0B7Hmsj84PE1541TPkSgUFzgnVKO1LAxi8Fyu6CSYEyfbXDsJRi+wvH8oxznWIfBOaS2GtoRzEln6Q9PZUd3CfxBb2HRIwieYd7tCMFbGenG7+4/hKsgU4+Y4RV5B2JHQ/OBbNY81JQH/lZKNhygtoJbNBfSzsSgMFiY5axrJ2OLxXC+sCymhJPXjz/kDYWBqgIllRNvEZMZ91inWVVMrbLJLfE6Lg1FLtEP2GtI4mRckEBhbfnIoX7whhJsQEuOs3GNKmAZ4fdvyA2gn+QdjDNSA4lj0jebydjx2qHmNS9Ga5CcnuMQdWP1cTxAYQgK1gzSFa8QKaSVCZoduoBY9OXWKMd+zTWYJNGGVQM7KLIfcQmVgOTTrVjMgme3UjZbrO2Gh9Y4PjCQJxzQBsNY1hbtDEOHUmePTvAfs/4yisfqE3RAbCtP1Yh3Mqfo0i8g11C92VpJ4/TcBmTRt0RjkSxkPWWZMRhJCI40tF3c5I/jNGLlaMiq6Sx7WU9Zc35U1pwK/WcInccG4wP30NyCU5HaKedDEsc3x1jG+HYwtDt1vTShgAw6Ox3Iivk8R0J73s/RSZfEGjHcCfvvnudx+cdrB4W19dB5ZGu7OTToh3FVswylHXSyaMcjoIAI7wx6zzlftD8K7j9gBX/qJPHgEUgbkHZuiadx/oQcdFuip44Yf3717h/EHsk7kHADYqsKD1Y+0wa8dE2k65PEsx60sftB+wUXUniEID7HAwQGwS/N/8CTFqskItNHp8i7BY0iWJ3mrRBYIdVApXEHY4FDUCwdJqiRyyCYpy4sKe6y6InPVqRbPuYqG1ZN1mtjQ+fLnAJW8fkq5ME1ShfjfWS5IRnQZCMeAkXofjvLlkh40uZJyu4t95uGFFoID7ByvKAVU/5PEWbphSZ6BNIrkk8nrggZOhM0cdsj+fv+QW8MSWjAFiyCgAAAABJRU5ErkJggg==>

[image16]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAwAAAAZCAYAAAAFbs/PAAAAiklEQVR4XmNgGAXDAswG4v9AfABK16HIooFfQHwBTQykyRHK/o0scYMBIokOQGIgg0BgN7rEc2QBKPjHAJEzB+JomKADVNAdJoAEHjFA5FBsX40ugASuMUDkJJEFG6CC2MBFBhxyIEFVNLF7QLwWKgcCfUhyDEJA/JcB4d4ZSHL3oWLxSGKjgLoAACgOJkiAxK1GAAAAAElFTkSuQmCC>

[image17]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEQAAAAYCAYAAABDX1s+AAAC00lEQVR4Xu2WSchIURTHD5JkSCwUwsLKtFF2bI1ZkIhYycaYYWGhzxdlSFEkC5kSGVcsbSykZKVsZGEMmecxzv8753jnnffu+/T1WN1f/Xv3nv9597533x0eUSaTybRHB+sD65fqVtmucJ+KXNy3sWx3cYy1LAZ7wHMq+oLesl6xvmn9C6v/n+yW8R2nmMzaSpIzJXhGLxJ/VzR6yCmS9gZGg8rPO9KVW+ERFTMlxUPWdWrOaZumj/SaxBvNuqjlVpjNWsG6TOlGL+m16QH/Bejrewwq9ix99Yrl1Ao39Ir9oO5lMV3XaBn+eed5JpLsH71DfBLrKGuA1gextrH2UzXXM5ykv53RoGIQMKvxQVE+qWXcF0Ecy29xNOqwQcC+gPIo5wFsXmAGiT/eecZu1izWDioPaj/WFdZSjW9nHVevQ2MpDpH4NpAebKwfWRtYh0nyUIZi/nuSFQCw1zx2Xi0+AQ0vd/V1VHSAmZR6gQd6vU3lnKt6tQHpdB5mSqo9AA/CC2E52B73g7XK5TXtH9Op7P1kfXX1CvjqK10dN59wdb887AEjOFnGahn+vsKizXq9o54HLxVjnlR/EeS8iEFlE4mPjzkteLXY/mHgZpwm4Ik3SLxzIeaZR+kXQBwnlAf/Fan8EVT9OCmQh5mcwgb2rwY4JthNGE1sksYcjU9wsQjWddOJMLMmtiXEjCMk/phoBPCMyGvanAGW/WmS3NXBK/Es1DH1cNPdEMcfbBy8CPwFWv7k4ovU8yx0saGsg84D9mG64wKV8665Mj5ObAP1YSHWBdb9PZJfcc8ZqjYCunvAcVT4OL4HOy9utMD/8zz1BtOHuu/PuElF3lSSE8dAfImrzyeZxRX2st6wXpLs4Ni1jbkkX8/A0Wa570hGPTXNcRLgIdaGONo/EGL2HwENcXGcJLG/9c6v4zNJO3tCHEc+3s/6OVu2M5lMJpPJ/Gd+A4+23tJGA79NAAAAAElFTkSuQmCC>

[image18]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADIAAAAYCAYAAAC4CK7hAAABjklEQVR4Xu2WS0oDQRCGC0UUg6KiBnxsXHkCBXXtITyFB8hGPILgQtzpEcQziBvBreABRATBF77rp9Kh/Wf6kQjJpj8oyPx/Md3VUzUTkUKhkMuWxr3Gj8aFxtBfu6/cie3DxaPGg8arp611sj0ONA696xex5BVP6zenYntosKEciXkbbEBcr9EQgyK1fsVHxRUxoNWxwwIxojHBYgZY+41Fj0up2d++xiZpuYU0xXq4DhzSO4sZ4J5Ye48ND8wxcqbYYJD0zWKAJY0n0lDEB2m5YF6x/hgbHlkHfS2WNM5GhGWN5/ZvFPHped2Ss8lkDoYeCXNsZOCK+U8RIDUf6ADkXLHhmBZLGGUjkxmxdsL7vlcWJD0fN2I5k2wAfAD5UZ3QdQxXBJgV+xb1wrHE52NVzG+x4agb7C8WAuBJ8mCjGDcz3RDrfRwWvHM2HHhFuhtwpMDjDfUziuG3WYxhsTX5UOY1ztreNnkdFqW6eRc5vb7LAoGPIQpKgcPw10Y34ICh30rgv1WhUCgUBsovvwVzLGuUfLMAAAAASUVORK5CYII=>

[image19]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABcAAAAYCAYAAAARfGZ1AAABB0lEQVR4XmNgGAVkgJ9AzIkuSA1QBcT/gfgpugQ1AMhgGGZDk8MFQGq90AXRQQEQNwNxLQNEwz1UaaxAlwGilgldAh2AFCGzQZgZSQwbWM+Aqg8rSAbibiR+BwNE01UkMWTgwQAJCpCaH0DsDcS2KCqQADbbYa7HBoqAuIwBIr8MyndBUQEFYUA8FV0QCCYzQDSfRJeAAlh4M6JLIANcrgMBfK5fy4BbDgxAYbcQXRAJzGeAGLAHXYIBIv4WXRAZ4LUZCnC5HiQGSr5YgRUDxGuEwDoGiEHIanWgYrD07cSAFqEwF5GCYQCU9JD575HYDHIMmBqJwf0gzVBwGyp2AUlsFIyCwQIAi2FUkrVgN3IAAAAASUVORK5CYII=>

[image20]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAFIAAAAYCAYAAABp76qRAAACKklEQVR4Xu2Xu0tcQRTGT5QoQSNqSOMrpLAKimghYggmgtgaNIXxQRpFsEghFpYWdiIY/wUNgZBSJAQsFCwUK0FJYaFiExEbHyFocg5nrly/7Ny9Lx/g/OBj73zf3d3hzN0zs0QOh8PhCEMB6zvrL2uV9eBq7DAUk9YoI+Wk4SMzfmLGOZd33G+esnZIa+IpI8esL+Ctsc7AS0oLGneAF2hkIbCQErwDb8z4abDAOiR90u8CD1kbrJ/mOgrWQr4iDV6C32/8UvDDIhPcYm2z8iELwxBrlvUYA6YSjZDIQh6wljCIgLWQH0mDevC7jN8IfjZKSCe7QvE2LNn0/L1IVObLf1D03l3N+k3/t684WAs5ThrUgt9h/Pfg23hO2lO/YRAR+c4PvvFX1h/feM93nY1m0s+bwiAB1kIOkAZ14HcavxV8pIF1wZrBIAZ9pAuIeBOfYBX6AwtvSd8zikEKWAvp9cgm8HuNL0ejINpI75PN6boYZr1mnWJgYZB0Tj0YpIC1kLIRSJB01/aezE8YpEANa5P1BoMseO1pBIMEWAspSDAN3rzxo1JFei6V3pYmcebiIRumLPIkBjEILGSmp0/G0mviIseWfdYyBjGR3Topz1gnrDkMIhBYSOEz69y8yo1yLEqDXNY66eE3D7KwdLPa0UxAEekiL2IQwBHpe3aN5Fq8WwH7cFh+oZEScs6VI9K9IfCn5AiHPDXyr8SRkArSs67D4XDcNP8AITV+QMEbbQ8AAAAASUVORK5CYII=>

[image21]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAJ0AAAAYCAYAAADgW/+9AAAESUlEQVR4Xu2aW6hUVRjHvzIsMRFRSSXzgNqbYJDYS0IiFpGkgnhB4uSLBJkVJF7oQUxDRbOCCNI8eHsQRUGf1CeRghIVBDUQfFDES9k9u6l9f769zlnzZ+1rM3tmz5kf/JnZ/2/NnvWtWXuvyx6RDh3+H2+w0aFDI5mgeqB6igON5hHVM2wST7MRYLTqYTbbgHbO/R/VVdWfHPBAp6w7pyX5xEkxJk/ZKpAnnzxlW4EnVc+rHhOr+xO14V5S89qm+lmsIHRXdYe8/b2lDXgHyXPcVI1kM4GBqvtsNpHrqr+lL/dfVT+o/vC853pL11L13NNA33DcEmsbH9c+TqnEFRwn5h/zPByHhobXxCoTBz63iU3lK9UWNpuIm7d8yAHlW7HY4+S3S+5xjFDN9I6RP3Ia6nngjOpV8mLBCb5mM8LvkLPExvUQKDOKzYiHxOKTOaAMkHCHbxZfSLhjgbfFYl+S3y65x4GRj/lJ9T15mXNZIFb4RQ4og6S20+FKf6kv3MsYSf7C5ZIcR2wGm03Cz5c5JRZD53OUmfscNoh5bNSBIaq5bCrDxeqOPuJIyrOGCxJf+JBYbHZ0HFdul9hciMEt+WWx+Q4++0p0zFxSfcNmk0A9k+7m3AZl5o659JtsRmxWbWQzBey57RXrWMzY6BX1x/RhsWqRaqEn5HUtKjdddTF6fyV6jSXUkOAFMf9jDgS4J1Z55l3Ve2LnQcPi+PWaEsZqCdehbLAiQz3Wc0Bs+oEYLxbKzv2I2Hl9MC/cSl4Sg6Xvd3fCHdtxQmze7qYGaXLg4jvrHcfiPogx+kexPRgcnxe7hWYB5dexGeEqPokDHm6IT2O+aneMcMfpUe1U7VBtl2wXjM9nYvX4S2wV/4vYChPe5145n7Jy9zmqWhG9R4fLmye+z78ADkjt3d3dvRqCS3gJB3LCSfgsk/RGnSrpZcoAdchbj2bljo53UuxCyQOGytDc0NVhg4QXUXXjOymWMINzdLMZcVvSv2OKpJcpg6KdrpvNiEbmvlNsPvg+BwqCuSKmVP5+XEMo0sghcI61bEYgdphNAsNmlnpglYf9rqz6wD6WCey4ow74MfNQVu4+qONH0fs9qlVerCiYAmAhgAVBQ0Gyl9ksAM6DeRXj5jTPRsfDJNwRVkr+hq83PWJ1cKu2rJSdO/YIXYdzoOPx4qIIeepRiDViX7KUAwXYJ+GHwG6V5Ih77INFyzk2Swb1LNLoZeaOxUxoZQ2wkHqHzZxg1doQPhV7boaVKlZov0t8g2SlS+J/MCSC2A0OeCAe2pwug9/EdtzxjBWv6EBJdWW6pLzc0/7L9hYbOcAeXGjjv6VB42EIyYsbhqpMO+SORU/lwOMe/NcqL8dVn7BZMdoh91bp/Ln5V8KPVOLArjd29NuBKueOOy42xCtLniumVRq9XlQ1d2wXTWOzSuCqmchmgPGqR9msOP059w4dOnTox/wHvQ5V7KeAx40AAAAASUVORK5CYII=>