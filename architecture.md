# 아키텍처

## 데이터 흐름

**클라이언트에서 파싱 → 서버에서 Claude 호출** 두 단계로 나뉜다.

1. `src/app/page.tsx`(`"use client"`)가 파일을 받아 `src/lib/chat.ts`로 브라우저에서 직접 파싱하고 통계를 계산한다. 원본 파일은 서버로 가지 않는다.
2. "AI 분석" 시 `toPromptLog()`로 만든 압축 로그(`[YYYY-MM-DD HH:mm] 닉네임: 메시지`, 시스템 알림은 `(알림)` 접두어)만 `POST /api/analyze`에 `{ log }`로 보낸다.
3. `src/app/api/analyze/route.ts`가 Claude 구조화 출력으로 분석해 JSON으로 응답하고, 실패하면 `{ error }`를 돌려준다. 클라이언트는 `data.error`를 그대로 표시한다.

API 라우트의 요청/응답 계약, 에러 status, Claude 호출 설정, `SYSTEM_PROMPT` 관리는 [`src/app/api/CLAUDE.md`](src/app/api/CLAUDE.md)에 따로 정리되어 있다.

## `src/lib/schema.ts` — 분석 결과의 단일 소스

`AnalysisSchema`(zod)는 Claude 구조화 출력 포맷이자 UI의 `Analysis` 타입이다. 필드나 enum을 바꾸면 함께 고쳐야 할 곳:
- `route.ts`의 `SYSTEM_PROMPT` (자세한 내용은 `src/app/api/CLAUDE.md`)
- `page.tsx`의 `PRIORITY`, `ISSUE_TYPE` 매핑 (`Record<enum, …>`라서 enum 변경 시 타입 에러로 드러남)

## `src/lib/chat.ts` — 파서

- `decodeFile`: UTF-8(fatal)로 읽고 실패하면 EUC-KR로 재시도 (윈도우 카카오톡 내보내기 대응).
- 확장자로 분기: `.csv` → `parseCsv`, 그 외 → `parseTxt`.
- CSV: 헤더 키워드(한/영)로 날짜·사용자·메시지 열을 찾고 못 찾으면 0/1/2번째 열로 대체. 사용자 열이 비면 시스템 메시지로 본다.
- TXT(PC판): `--- YYYY년 M월 D일 ---` 날짜 줄이 기준 날짜를 정하고, `[이름] [오전|오후 h:mm] 본문` 줄이 메시지가 된다. 패턴에 안 맞는 줄은 직전 메시지의 이어지는 줄로 붙인다. 초대/퇴장 같은 시스템 줄은 시각이 없어서 직전에 본 시각을 쓴다.
- 날짜는 모두 로컬 타임존 `Date`다.
- `ChatMessage.system === true`인 메시지는 통계(`computeStats`)에서 제외되지만 프롬프트 로그에는 포함된다.
