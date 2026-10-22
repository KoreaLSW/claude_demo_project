import { z } from "zod";

export const AnalysisSchema = z.object({
  summary: z.string().describe("기간 동안 있었던 일을 2~4문단으로 요약"),
  topics: z
    .array(z.object({ title: z.string(), description: z.string() }))
    .describe("많이 오간 주제, 중요한 순서"),
  issues: z
    .array(
      z.object({
        type: z.enum([
          "conflict",
          "complaint",
          "unanswered_question",
          "rule_violation",
          "other",
        ]),
        description: z.string(),
        members: z.array(z.string()),
      }),
    )
    .describe("방장이 알아야 할 문제. 없으면 빈 배열"),
  action_items: z.array(
    z.object({
      title: z.string(),
      detail: z.string(),
      priority: z.enum(["high", "medium", "low"]),
      related_members: z.array(z.string()),
      evidence: z
        .array(z.string())
        .describe("근거가 된 메시지를 짧게 그대로 인용"),
    }),
  ),
});

export type Analysis = z.infer<typeof AnalysisSchema>;
