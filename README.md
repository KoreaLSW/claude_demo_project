# claude_demo_project

카카오톡 채팅방 대화를 올리면 멤버 활동 통계, 요약, 주요 토픽·이슈, 방장 할 일(액션 아이템)을 정리해 주는 MVP입니다.

## 실행

```bash
npm install
npm run dev   # http://localhost:3000
```

AI 분석에는 Claude API 키가 필요합니다. `.env`에 `ANTHROPIC_API_KEY=sk-ant-...`를 넣고 개발 서버를 재시작하세요. 키가 없어도 통계는 볼 수 있습니다.

## 입력 파일

- 카카오톡 CSV 내보내기 (`Date, User, Message`)
- 카카오톡 PC TXT 내보내기 (`[이름] [오후 3:02] 메시지`)

테스트용 샘플은 `test-data/`에 있습니다.

## 구조

- `src/app/page.tsx` — 업로드, 통계, 분석 결과 화면
- `src/app/api/analyze/route.ts` — Claude API 호출 (구조화 출력)
- `src/lib/chat.ts` — 파일 파싱, 통계 계산
- `src/lib/schema.ts` — 분석 결과 스키마 (zod)
