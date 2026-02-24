# **비디오 프레임 요약 CLI 시스템 블루프린트 (@lumy-pack/scene-sieve)**

본 문서는 동영상(.mp4) 및 GIF 파일에서 유의미한 핵심 프레임을 추출하고 가지치기(Pruning)하여 ![][image1]장의 이미지를 도출하는 Node.js 도구의 아키텍처 설계도입니다. npx를 통한 즉각적인 CLI 실행 환경과 node\_modules를 통한 프로그래밍 방식(Programmatic API)의 통합을 동시에 지원하며, 관심사의 분리(SoC)와 단일 책임 원칙(SRP)을 엄격히 준수합니다.

## **1\. 시스템 모듈 블루프린트 (System Blueprint)**

전체 시스템은 부수 효과(Side-Effect)를 다루는 계층과 순수 비즈니스 로직(Pure Logic)을 다루는 계층, 그리고 인터페이스 계층(CLI vs API)으로 완벽히 분리됩니다.

1. **CLI Adapter (Bin):** CLI 진입점 (bin 스크립트). 사용자 입력 파싱(commander), 터미널 UI 렌더링(cli-progress, ora), 프로세스 종료 코드(Exit Code) 관리를 전담하며, 실제 작업은 Core Orchestrator에 위임합니다.  
2. **Core Orchestrator (Facade/API):** 모듈 진입점 (main/exports). 다른 Node.js 앱에서 직접 호출할 수 있는 핵심 API입니다. ProcessContext(상태) 생성, 파이프라인 단계별 실행 제어를 담당하며, 진행 상황을 외부에 이벤트(콜백)로 방출(Emit)합니다.  
3. **Workspace Manager (I/O):** 파일 시스템 제어. 임시 격리 공간(os.tmpdir) 생성, 최종 결과물의 원자적(Atomic) 이동, 완료/실패 시 찌꺼기 영구 삭제(Cleanup).  
4. **Media Extractor (FFmpeg):** 비디오/GIF 디코딩. I-Frame 우선 추출, 고정 FPS 폴백(Fallback), 해상도 다운스케일링 적용 후 임시 공간에 프레임 이미지 저장.  
5. **Vision Analysis Engine (WASM):** 메모리 효율을 위한 Batch 처리 기반 시각 분석. sharp로 전처리(흑백, 블러) 후 opencv-js를 활용해 인접 프레임 간의 변화 점수(S) 계산.  
6. **Pruning Engine (Pure Logic):** 순수 함수형 모델. 분석된 점수 그래프를 탐욕적(Greedy)으로 병합 및 가지치기하여 최종 ![][image1]개의 프레임 ID 반환.

## **2\. 동작 라이프사이클 (Operation Lifecycle)**

1. **Init (초기화):**  
   * (CLI의 경우) 인자 파싱 후 Core API 호출.  
   * (API의 경우) 주입된 Options 객체 유효성 검사.  
   * Workspace Manager가 OS 임시 폴더에 고유 세션 ID 기반의 작업 공간 생성.  
2. **Extract (추출):**  
   * Media Extractor가 타겟 파일을 분석. I-Frame 추출 시도.  
   * (I-Frame이 없거나 너무 적은 GIF 등의 경우) \--fps 옵션에 따라 고정 프레임 추출로 전환.  
   * 추출 진행 상황(Progress)을 상태 객체를 통해 외부에 콜백으로 전달.  
3. **Analyze (분석 \- Batch Process):**  
   * Vision Analysis Engine이 프레임을 청크(예: 10장 단위)로 메모리에 로드.  
   * OpenCV를 통해 특징점(ORB/SIFT) 추출 및 매칭, 객체 이동(IoU) 기반 S-Score 계산.  
   * 계산이 완료된 프레임 이미지 버퍼는 즉시 가비지 컬렉션(GC)되도록 해제하여 메모리 폭발 방지.  
4. **Prune (가지치기):**  
   * Pruning Engine에 구축된 ScoreGraph 주입.  
   * 변화 점수(![][image2])가 가장 낮은 인접 프레임 쌍을 찾아 논리적 병합 수행 (탐욕 알고리즘).  
   * 목표 ![][image1]장에 도달할 때까지 반복 후 최종 프레임 노드 목록 반환.  
5. **Finalize (종결 \- Atomic):**  
   * Workspace Manager가 최종 선택된 ![][image1]장의 원본 프레임을 임시\_출력\_폴더로 복사.  
   * 임시\_출력\_폴더를 지정한 최종 목적지 경로로 fs.rename (원자적 교체 보장).  
   * 작업 완료 후 워크스페이스 전체 삭제. 최종 결과 객체(Result Object) 반환.

## **3\. CLI 및 API 인터페이스 설계**

### **3.1. CLI 모드 (POSIX 표준)**

**Usage:**

npx @lumy-pack/scene-sieve \<input-filepath\> \[options\]

**Options:**

* \-n, \--count \<number\>: 남길 목표 프레임 수 (기본값: 5\)  
* \-o, \--output \<path\>: 결과물 저장 디렉토리 (기본값: 원본 파일명 기반 디렉토리 생성)  
* \--fps \<number\>: I-Frame 추출 실패 시 폴백 FPS (기본값: 5\)  
* \-s, \--scale \<number\>: 비전 분석을 위한 축소 픽셀 크기 (기본값: 720\)  
* \--debug: 디버그 모드 활성화 (임시 폴더 보존 및 상세 로그)

### **3.2. Programmatic API 모드 (Node.js 모듈)**

다른 애플리케이션에서 라이브러리로 사용할 수 있는 Promise 기반 API입니다.

import { extractScenes } from '@lumy-pack/scene-sieve';

async function runSieve() {  
  const result \= await extractScenes({  
    inputPath: './assets/gameplay.mp4',  
    count: 6,  
    outputPath: './output/gameplay\_scenes',  
    onProgress: (phase, percent) \=\> {  
      console.log(\`\[${phase}\] 진행률: ${percent.toFixed(2)}%\`);  
    }  
  });

  console.log('추출 완료된 장면 파일들:', result.outputFiles);  
}

## **4\. 데이터 인터페이스 및 상태 관리 (TypeScript)**

모듈화 및 타입 안정성을 보장하기 위한 핵심 데이터 계약(Contract)입니다.

// 1\. 모듈 API 옵션 및 진행 상황 콜백  
export type ProgressPhase \= 'EXTRACTING' | 'ANALYZING' | 'PRUNING' | 'FINALIZING';

export interface SieveOptions {  
  inputPath: string;  
  count?: number;           // default: 5  
  outputPath?: string;      // default: parsed from inputPath  
  fps?: number;             // default: 5  
  scale?: number;           // default: 720  
  debug?: boolean;          // default: false  
  onProgress?: (phase: ProgressPhase, percent: number) \=\> void;  
}

// 2\. 파이프라인 최종 반환 결과  
export interface SieveResult {  
  success: boolean;  
  originalFramesCount: number;  
  prunedFramesCount: number;  
  outputFiles: string\[\];    // 최종 저장된 프레임 이미지들의 절대 경로 배열  
  executionTimeMs: number;  
}

// 3\. 단일 프레임 메타데이터  
export interface FrameNode {  
  id: number;             
  timestamp: number;      
  extractPath: string;    
}

// 4\. 인접 프레임 간의 유사도/변화량 엣지 (Edge)  
export interface ScoreEdge {  
  sourceId: number;       
  targetId: number;       
  score: number;          
}

// 5\. 전체 파이프라인 생명주기를 관통하는 내부 상태 (Context)  
export interface ProcessContext {  
  options: Required\<Omit\<SieveOptions, 'onProgress'\>\>;  
  workspacePath: string;  
  frames: FrameNode\[\];  
  graph: ScoreEdge\[\];  
  status: 'INIT' | ProgressPhase | 'SUCCESS' | 'FAILED';  
  emitProgress: (percent: number) \=\> void;  
  error?: Error;  
}

## **5\. 핵심 도구 선정 및 타당성 (Tool Selection & Justification)**

npx 기반의 무설치 실행 환경 구축이라는 제약 조건을 만족하면서 글로벌 표준을 따르기 위한 스택입니다.

| 모듈 / 목적 | 도구 (Package) | 선정 사유 (Justification) |
| :---- | :---- | :---- |
| **CLI 파싱** | commander | Node.js 생태계의 De facto standard. 옵션 파싱, 기본값 할당, Help 문서 자동 생성에 가장 안정적임. |
| **터미널 UX** | cli-progress / ora | 비전 분석 및 프레임 추출 과정이 수 분 소요될 수 있으므로, 사용자 이탈을 막기 위한 직관적인 진행 상황 피드백 필수. CLI 어댑터에만 격리하여 사용. |
| **미디어 추출** | fluent-ffmpeg \+ ffmpeg-static | **\[핵심\]** 사용자의 Mac/PC에 FFmpeg 설치 여부를 가정할 수 없음. ffmpeg-static은 OS에 맞는 바이너리를 제공하므로 npx 실행의 독립성을 완벽히 보장함. |
| **이미지 전처리** | sharp | VIPS 기반의 초고속 이미지 처리 라이브러리. OpenCV로 넘기기 전 흑백 변환, 가우시안 블러를 C++ 레벨에서 수행하여 Node.js 스레드 블로킹 최소화. |
| **비전 분석** | @techstark/opencv-js | **\[핵심\]** OpenCV의 WASM(WebAssembly) 빌드 버전. node-gyp 기반 네이티브 바인딩 없이 동작하므로 패키지 배포 안정성이 압도적으로 높으며 V8 엔진 내에서 네이티브에 준하는 속도 보장. |

[image1]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAwAAAAXCAYAAAA/ZK6/AAAAvUlEQVR4XmNgGAWDBsjIyOjKy8vPExcX5wbx1dXVeRUUFBqAeAKQy4SiWEVFhR2oeCsQRwPxfyBulpOTWwCSA9L1IDEUDUCBvVAarAFoaiNMDmQTNg2lUPoauiSQn40uBgcgCaAT2tHFgPgyshgYAJ0hAZIEOQEmBvQbH9SJCiA+kD0VrgHEQbcaWQxIVwNtV0KW/AvEX+ECDGBbC0AaFBUV9YHsS8hyIEkLY2NjVhRBBkj8AOUM0MVHASEAAOsTMHVt+yqZAAAAAElFTkSuQmCC>

[image2]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAA0AAAAYCAYAAAAh8HdUAAAA2ElEQVR4XmNgGJpASUlJTUFBYaacnJwvTExeXr4EWQ0cGBsbswIl/wHxbBUVFT5FRUU7IPs/ENcA8Wd09WAAUgA03QabOBBXoYszABUvAEmii4MASBzkCnRxmGk4NaGLgQFMExD3osvhBEDF3UgawRjo5Bno6jAAUFEeukZg0N9CV4cTAA1wgWlElwMDoEQwuhgIAMUXY9UkKyvrB3RCAbo4CAA1lGLVBBQ8C8Tr0MVBACj+F2tgwNwtKirKgya+Vh5P0nkCpJiA9AeoAe9BNCiFoKsdBQMCAJvoROf9khJcAAAAAElFTkSuQmCC>