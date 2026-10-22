# API 라우트

`src/app/api/` 아래 Route Handler에 대한 지침. 전체 구조는 루트 `CLAUDE.md`를 본다.

## `POST /api/analyze` (`analyze/route.ts`)

클라이언트가 파싱한 대화 로그를 Claude로 분석해 `AnalysisSchema`(`src/lib/schema.ts`) 형태의 JSON을 돌려준다.

- 요청: `{ log: string }`. `log`는 `src/lib/chat.ts`의 `toPromptLog()` 출력(`[YYYY-MM-DD HH:mm] 닉네임: 메시지`, 시스템 알림은 `(알림) …`)이며, 라우트가 `<chat_log>` 태그로 감싸 user 메시지로 보낸다.
- 성공 응답: `response.parsed_output`을 그대로 `Response.json()`으로 반환.
- 실패 응답: `error()` 헬퍼로 `{ error: "<한국어 메시지>" }` + status. `page.tsx`가 `data.error`를 그대로 화면에 표시하므로, 새 에러 경로를 추가할 때도 이 형태와 사용자에게 보여 줄 수 있는 한국어 문구를 지킨다.

| 상황 | status |
| --- | --- |
| `ANTHROPIC_API_KEY` 없음 | 500 |
| 요청 JSON 파싱 실패, `log`가 비어 있음 | 400 |
| `stop_reason === "refusal"` | 422 |
| `parsed_output` 없음 (예: `max_tokens`로 잘림) | 502 |
| `Anthropic.AuthenticationError` | 401 |
| `Anthropic.RateLimitError` | 429 |
| `Anthropic.BadRequestError` (크레딧 부족, 너무 긴 대화 등) | 400 |
| 그 외 `Anthropic.APIError` | 502 |
| 기타 예외 | 500 |

SDK 에러 클래스는 상속 관계라서 구체적인 클래스(`AuthenticationError` 등)를 `APIError`보다 먼저 검사해야 한다.

## Claude 호출 설정

- `client.beta.messages.parse()` + `betaZodOutputFormat(AnalysisSchema)`로 구조화 출력을 받는다. `new Anthropic()`은 `process.env.ANTHROPIC_API_KEY`를 자동으로 읽는다.
- 모델 `claude-opus-5-5`(`MODEL` 상수), `max_tokens: 16000`, `output_config.effort: "medium"`.
- `betas: ["server-side-fallback-2026-07-01"]` + `fallbacks: "default"`: 안전 분류기가 거절하면 서버가 다른 모델로 자동 재시도한다. 그래도 거절되면 `stop_reason`이 `"refusal"`로 온다.

## `SYSTEM_PROMPT`와 스키마의 결합

`SYSTEM_PROMPT`에는 `AnalysisSchema`의 필드별 작성 지침(summary/topics/issues/action_items, priority, evidence)과 입력 로그 형식 설명이 들어 있다. 다음 중 하나를 바꾸면 프롬프트도 함께 고친다.

- `src/lib/schema.ts`의 필드·enum
- `toPromptLog()`의 줄 형식
