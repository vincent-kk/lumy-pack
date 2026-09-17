설계 배경 문서이며 현재 구현은 `src/DETAIL.md`를 따릅니다.
# 메타데이터 v2: 변화 신호와 컨택트 시트

## 배경

영상·GIF에서 만든 키프레임 번들을 읽어 LLM용 README를 생성하는 소비자는 언제, 얼마나, 어디가 바뀌었는지를 알아야 합니다. v2는 분석기가 이미 계산한 클러스터와 G(t)를 간선에 보존하고, 선택 프레임 사이의 후보 간선을 집계합니다. 프레임 선택 알고리즘과 worker 메시지 계약은 유지합니다.

## 변화 면적과 점수

원시 G(t)는 특징점 밀도와 애니메이션 감쇠를 반영하고, 가지치기 점수는 영상 내 분포에 따라 정규화됩니다. 둘 다 화면 변화의 절대 면적 비율을 대신하지 못합니다. 따라서 비애니메이션 bbox의 실제 합집합 면적을 별도 areaRatio로 기록합니다. 전체 상자는 면적 계산에 참여하고, 표시용 regions만 중복 제거·정렬 후 상위 5개로 제한합니다.

면적 계산은 분석 좌표에서 수행해 출력 좌표 반올림이 비율에 영향을 주지 않게 합니다. 출력 상자는 애니메이션 bbox와 같은 축별 환산·반올림·경계 제한을 사용합니다. 비율은 소수 4자리, 원시 점수는 6자리로 반올림합니다.

## 애니메이션 제외

쌍별 tracker의 animationIndices를 기준으로 클러스터를 분리합니다. 이 집합은 G(t) 감쇠 대상과 같으며 별도 가중치 임계값을 도입하지 않습니다. 추적기가 반복을 인식하기 전 간선의 영역은 소급 제거하지 않습니다. 따라서 최종 animations의 bbox와 과거 change.regions가 공간적으로 겹칠 수 있습니다. 세그먼트에서는 tracker가 구간마다 새로 시작하는 기존 계약을 유지합니다.

## 출처와 캐시

tool.params는 fps, count, threshold, scale, quality, maxFrames, iouThreshold, animationThreshold, maxSegmentDuration 아홉 값으로 고정합니다. fps는 요청값이고 video.fps는 후보 예산을 반영한 유효값입니다. 입력 식별값과 도구 버전을 함께 사용해야 선택 결과 캐시가 성립합니다.

concurrency, outputPath, debug는 실행 설정이므로 제외합니다. sheet와 includeEdges는 출력 옵션이므로 전체 번들 캐시에서는 별도 키에 포함해야 합니다. source.fileName은 file 입력의 basename만 담고 buffer/frames 입력은 null입니다. 메타데이터 바이트 비교에는 basename과 출력 옵션도 같다는 전제가 필요합니다.

## 한 문서와 모드별 출력

순수 빌더가 키 순서를 고정한 문서를 만들고 finalizeSelection이 출력 크기 읽기·시트 렌더·파일/버퍼 출력을 연결합니다. workspace는 전달받은 문서와 시트를 저장하며 기존 삭제-후-rename 교체 절차를 유지합니다. 활성화하지 않은 sheet·edges·sheetBuffer는 키 자체를 만들지 않습니다.

API frames는 문서와 같은 1-based ID를 사용하고 outputBuffers와 순서대로 대응합니다. 기존 API animations의 0-based ID는 유지합니다. 문서 animations만 1-based ID와 정수 durationMs를 사용합니다. holdsMs는 다음 선택 또는 원본 끝까지의 시간이며 음수는 0입니다.

## 컨택트 시트 결정성

선택 프레임을 행 우선으로 배치하고 초과 타일은 첫·끝을 포함해 균등 샘플링합니다. 라벨은 sans-serif SVG를 sharp로 합성합니다. 같은 기계·sharp 버전·폰트 환경에서는 같은 바이트를 요구하지만 플랫폼 간 폰트 렌더링 차이는 허용합니다. 문서에는 실제 타일 ID와 sampled를 남깁니다.

## 소비자 책임과 v1 폴백

README 템플릿 생성과 full ≥ 60%, major ≥ 20%, partial ≥ 2%, minor 등급 정책은 integrations 소비자가 담당합니다. scene-sieve는 면적·위치·시간·원시 점수를 제공합니다. metadataVersion이 없는 v1 문서는 변화 열을 비우고 시간축만 사용하며 픽셀 차분 폴백은 두지 않습니다.
