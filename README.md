# 자격캘린더 (Cert Calendar) — v1.0

국가기술자격 준비자를 위한 **개인 자격증·학습 계획 관리 PWA**입니다. 지도는 사용하지 않습니다.

## 현재 구현된 기능
- 관심 자격증 추가/수정/삭제, 등급별 검색 예시 및 사용자 정의 이름 등록
- 필기 접수·시험, 실기 접수·시험, 합격 발표일 **직접 등록**, 정확한 로컬 D-day 계산
- 월간 달력에 시험일·접수일·공부 할 일 표시
- 날짜별 공부 체크리스트 추가/완료/삭제
- 공부 타이머 (시작·일시정지·완료 기록), 이번 주 목표 대비 학습량
- 브라우저 localStorage 자동 저장, JSON 백업/복원, 전체 초기화
- 모바일 반응형 UI, PWA 설치 지원, 키보드 접근성
- Cloudflare Pages Functions(`/api/status`, `/api/schedules`) 기반 향후 API 연동 준비

## 한계 / 데이터 신뢰성
**이 버전은 개인 일정 관리 MVP이며 공식 시험일정을 자동 조회하지 않습니다.** 자격증 검색에 표시되는 이름들은 빠른 등록용 예시일 뿐, 공공데이터 API에서 읽어 온 최신 전체 종목이 아닙니다. 입력한 시험일과 접수일은 개인 메모로 처리하며 공식 일정으로 표시하지 않습니다. 공식 데이터 연결 시 종목코드/일정 기간/인증키/오류 응답을 먼저 검증해야 합니다. 공식 시험 정보는 https://www.q-net.or.kr 에서 확인하세요.

공공데이터 출처(연동 계획):
- 국가자격 시험일정 조회 API https://www.data.go.kr/data/15074408/openapi.do
- 국가자격 종목 목록 정보 https://www.data.go.kr/data/15003024/openapi.do
- 국가기술자격 종목별 시험정보 https://www.data.go.kr/data/15003029/openapi.do

## 실행
`index.html`을 브라우저로 열면 주요 기능을 시험할 수 있습니다. PWA/Functions 검증은 HTTPS Cloudflare Pages 또는 로컬 HTTP 서버에서 진행하세요.

```bash
python -m http.server 8000
```

브라우저에서 http://localhost:8000 접속.

## GitHub 및 Cloudflare Pages
1. `cert-calendar` 리포지토리 생성 후 이 폴더의 **내용**을 최상위에 커밋 (`index.html`이 루트여야 함).
2. Cloudflare > Workers & Pages > Create > Pages > Connect to Git.
3. 저장소 선택, `main` 브랜치, Framework `None`, Build command **빈 칸**, Output directory `.`.
4. 첫 버전은 API 키 없이 개인 기록·일정 관리가 가능합니다.
5. 공식 API 활용 신청 후 Cloudflare Pages 설정의 Secret `DATA_GO_KR_API_KEY`에 키를 저장할 수 있지만, 현재 `/api/schedules`는 연결 보류 상태(503)입니다. **인증키를 넣는 것만으로 자동 조회가 활성화되지는 않습니다.**
6. 권한 검증과 실제 응답 명세 확인 이후 Functions에서 공식 API 연동 및 캐시 정책을 추가합니다. 키를 JS/HTML/GitHub에 올리지 마세요.

## 개인 데이터
모든 학습 기록은 사용하는 브라우저의 localStorage에 저장됩니다. 브라우저 데이터 삭제, 기기 변경, 앱 삭제 시 기록이 사라질 수 있어 '내 데이터 관리 → 데이터 백업'을 활용하세요. 서버 계정, 여러 기기 동기화, 알림/푸시, 실제 시험일정 자동 동기화는 미구현입니다.

## 개발 확인 목록
- 모바일 360/390/430px와 150% 텍스트 크기
- 자격증 추가·수정·삭제, 같은 이름 여러 종목 구분
- 한국 시간/자정 D-day 및 달력 월 경계
- 체크리스트·타이머·주간 목표
- JSON 백업/복원과 XSS/잘못된 JSON 입력
- Pages 배포 후 PWA 캐시와 Function 503 동작