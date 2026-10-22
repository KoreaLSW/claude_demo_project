import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { AnalysisSchema } from "@/lib/schema";

const MODEL = "claude-opus-5-5";

const SYSTEM_PROMPT = `당신은 온라인 커뮤니티 방장을 돕는 분석가입니다. <chat_log>에는 방장이 운영하는 단체 채팅방의 대화가 "[날짜 시각] 닉네임: 메시지" 형식으로 들어 있습니다. "(알림)"으로 표시된 줄은 입장·퇴장 같은 시스템 알림입니다.

방장이 이 결과만 읽고도 채팅방 상황을 파악하고 바로 움직일 수 있게 분석해 주세요.
- summary: 기간 동안 무슨 일이 있었는지 2~4문단으로 요약합니다.
- topics: 많이 오간 주제를 중요한 순서로 정리합니다.
- issues: 방장이 알아야 할 문제를 찾습니다. 멤버 간 갈등, 불만, 아무도 답하지 않은 질문, 광고·도배 같은 규칙 위반이 해당합니다. 없으면 빈 배열로 둡니다.
- action_items: 방장이 직접 할 수 있는 구체적인 일입니다(공지 올리기, 질문에 답하기, 갈등 중재, 규칙 안내, 다시 초대하기 등). 급한 정도에 따라 priority를 정하고, evidence에는 근거가 된 메시지를 짧게 그대로 인용합니다.

모든 내용은 한국어로 씁니다. 대화에 없는 사실은 지어내지 말고, 멤버는 대화에 나온 닉네임 그대로 부릅니다. "사진", "이모티콘", "삭제된 메시지입니다." 같은 줄은 내용이 없는 자리표시자이므로 분석에 크게 반영하지 않습니다.`;

function error(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

export async function POST(request: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return error(
      "ANTHROPIC_API_KEY가 설정되지 않았습니다. 프로젝트 루트의 .env 파일에 키를 넣고 개발 서버를 재시작해 주세요.",
      500,
    );
  }

  let log: string | undefined;
  try {
    ({ log } = await request.json());
  } catch {
    return error("요청 형식이 올바르지 않습니다.", 400);
  }
  if (!log?.trim()) return error("분석할 대화가 없습니다.", 400);

  const client = new Anthropic();
  try {
    const response = await client.beta.messages.parse({
      model: MODEL,
      max_tokens: 16000,
      // 안전 분류기가 거절하면 서버가 다른 모델로 자동 재시도한다.
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: {
        effort: "medium",
        format: betaZodOutputFormat(AnalysisSchema),
      },
      system: SYSTEM_PROMPT,
      messages: [
        { role: "user", content: `<chat_log>\n${log}\n</chat_log>` },
      ],
    });

    if (response.stop_reason === "refusal") {
      return error("Claude가 이 대화의 분석을 거절했습니다.", 422);
    }
    if (!response.parsed_output) {
      return error(
        `분석 결과를 읽지 못했습니다 (stop_reason: ${response.stop_reason}).`,
        502,
      );
    }
    return Response.json(response.parsed_output);
  } catch (e) {
    console.error(e);
    if (e instanceof Anthropic.AuthenticationError) {
      return error("API 키가 올바르지 않습니다. .env의 ANTHROPIC_API_KEY를 확인해 주세요.", 401);
    }
    if (e instanceof Anthropic.RateLimitError) {
      return error("요청이 많아 잠시 제한되었습니다. 잠시 후 다시 시도해 주세요.", 429);
    }
    if (e instanceof Anthropic.BadRequestError) {
      // 크레딧 부족, 대화가 너무 긴 경우 등
      return error(`요청이 거부되었습니다: ${e.message}`, 400);
    }
    if (e instanceof Anthropic.APIError) {
      return error(`Claude API 오류 (${e.status}): ${e.message}`, 502);
    }
    return error(`분석 중 오류가 발생했습니다: ${(e as Error).message}`, 500);
  }
}
