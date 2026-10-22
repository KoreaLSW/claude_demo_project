# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## 프로젝트 개요

카카오톡 채팅방 내보내기 파일(CSV/TXT)을 올리면 멤버 활동 통계와 Claude 기반 분석(요약, 토픽, 이슈, 방장 할 일)을 보여 주는 Next.js MVP. UI 문구·프롬프트·에러 메시지는 모두 한국어다.

스택: Next.js 16.4 (App Router, Turbopack) · React 19 · Tailwind CSS v4 · TypeScript · zod v4 · `@anthropic-ai/sdk` · papaparse

## 명령어

```bash
npm run dev                          # 개발 서버 (http://localhost:3000)
npm run build                        # 프로덕션 빌드
npm run lint                         # ESLint (eslint-config-next core-web-vitals + typescript)
npx next typegen && npx tsc --noEmit # 타입 체크 (LayoutProps 등 Next 생성 타입이 필요)
```

테스트 러너는 아직 없다. 파서 동작은 `test-data/`의 샘플 파일을 업로드해 확인한다.

AI 분석에는 `.env`의 `ANTHROPIC_API_KEY`가 필요하다(`.env.example` 참고). 키를 바꾸면 dev 서버를 재시작해야 한다. 키가 없어도 통계 화면은 동작한다.

## 아키텍처

데이터 흐름, 분석 스키마의 역할, 파서 동작은 `architecture.md`에 정리되어 있다.

@architecture.md

## 스타일링

- Tailwind v4를 PostCSS가 아니라 `next.config.ts`의 Turbopack 로더(`@tailwindcss/turbopack`)로 처리한다.
- 색은 `src/app/globals.css`의 CSS 변수 → `@theme inline` 토큰으로 정의되어 있다: `bg-background`, `bg-surface`, `text-secondary`, `text-muted`, `border-hairline`, `border-baseline`, `bg-series` 등. 하드코딩 색 대신 이 토큰을 쓴다. 다크 모드는 `prefers-color-scheme`로 변수 값만 바뀐다.
- 차트(멤버별 막대, 시간대별 막대)는 라이브러리 없이 `div`와 인라인 `style`로 그린다.

## 기타

- `next.config.ts`에서 `cacheComponents`와 `partialPrefetching`이 켜져 있다. 서버 컴포넌트·데이터 페칭·캐싱 코드를 추가할 때는 `node_modules/next/dist/docs/`의 관련 가이드(예: `01-app/01-getting-started/08-caching.md`, `01-app/02-guides/adopting-partial-prefetching.md`)를 먼저 읽는다.
- 경로 별칭: `@/*` → `src/*`.
- `AGENTS.md`는 `next dev`가 다시 써 넣는 파일이다. 직접 수정하지 말고 변경이 생기면 함께 커밋한다.
