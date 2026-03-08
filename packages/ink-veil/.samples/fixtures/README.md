# ink-veil Sample Fixtures

가상(fake) PII 데이터를 포함한 테스트용 픽스처 파일 모음입니다.
실제 개인정보가 아닌 테스트 전용 데이터입니다.

## 파일 목록

| 파일 | 형식 | Tier | 설명 |
|------|------|------|------|
| korean-pii.txt | TXT | 1a | 한국어 PII 전반 (이름, 전화, RRN, 이메일) |
| mixed-data.csv | CSV | 1a | 여러 컬럼에 PII가 포함된 CSV |
| config-data.json | JSON | 1b | 중첩 구조의 JSON PII |
| structured.xml | XML | 1b | 텍스트 노드에 PII가 있는 XML |
| settings.yaml | YAML | 1b | YAML 값에 PII 포함 |
| README.md | MD | 1a | 이 문서 (PII 언급 포함) |
| data.tsv | TSV | 1a | 탭 구분 PII 데이터 |

## 포함된 PII 카테고리

- **PER**: 홍길동, 김영희, 이철수, 박지수, 최민준
- **PHONE**: 010-xxxx-xxxx 형식
- **RRN**: YYMMDD-XXXXXXX 형식 (주민등록번호)
- **EMAIL**: xxx@example.com 형식
- **CARD**: 신용카드번호
- **IP**: 192.168.x.x 형식
- **BRN**: 사업자등록번호
- **PASSPORT**: 여권번호
- **DL**: 운전면허번호
- **ACCOUNT**: 계좌번호

## 주의사항

모든 데이터는 테스트 목적의 가상 데이터입니다.
실제 존재하는 인물이나 기관과 무관합니다.
