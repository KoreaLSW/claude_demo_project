"use client";

import { useState } from "react";
import {
  computeStats,
  decodeFile,
  formatDate,
  parseChat,
  toPromptLog,
  type ChatMessage,
  type ChatStats,
} from "@/lib/chat";
import type { Analysis } from "@/lib/schema";

type Chat = { fileName: string; messages: ChatMessage[]; stats: ChatStats };
type ActionItem = Analysis["action_items"][number];
type Priority = ActionItem["priority"];

const PRIORITY: Record<Priority, { label: string; color: string; order: number }> = {
  high: { label: "높음", color: "#d03b3b", order: 0 },
  medium: { label: "보통", color: "#fab219", order: 1 },
  low: { label: "낮음", color: "var(--text-muted)", order: 2 },
};

const ISSUE_TYPE: Record<Analysis["issues"][number]["type"], string> = {
  conflict: "갈등",
  complaint: "불만",
  unanswered_question: "답변 없는 질문",
  rule_violation: "규칙 위반",
  other: "기타",
};

export default function Home() {
  const [chat, setChat] = useState<Chat | null>(null);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError("");
    setAnalysis(null);
    setChat(null);
    try {
      const messages = parseChat(decodeFile(await file.arrayBuffer()), file.name);
      setChat({ fileName: file.name, messages, stats: computeStats(messages) });
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function analyze() {
    if (!chat) return;
    setLoading(true);
    setError("");
    setAnalysis(null);
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ log: toPromptLog(chat.messages) }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? `분석에 실패했습니다 (${res.status})`);
      setAnalysis(data);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto w-full max-w-4xl space-y-8 px-4 py-10">
      <header>
        <h1 className="text-2xl font-semibold">채팅방 분석기</h1>
        <p className="mt-1 text-secondary">
          카카오톡에서 내보낸 대화(CSV 또는 TXT)를 올리면 요약과 방장 할 일을 정리해 드려요.
        </p>
      </header>

      <label className="block cursor-pointer rounded-xl border border-dashed border-baseline bg-surface p-6 text-center hover:border-series">
        <input type="file" accept=".csv,.txt" className="sr-only" onChange={handleFile} />
        <span className="font-medium">{chat ? chat.fileName : "대화 파일 선택"}</span>
        <span className="mt-1 block text-sm text-muted">
          {chat ? "다른 파일을 올리려면 클릭" : ".csv 또는 .txt"}
        </span>
      </label>

      {error && (
        <div
          role="alert"
          className="rounded-lg border border-red-300 bg-red-50 p-4 text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200"
        >
          {error}
        </div>
      )}

      {chat && <StatsView stats={chat.stats} />}

      {chat && (
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={analyze}
            disabled={loading}
            className="rounded-lg bg-foreground px-5 py-2.5 font-medium text-background disabled:opacity-50"
          >
            {loading ? "분석 중…" : analysis ? "다시 분석" : "AI 분석 시작"}
          </button>
          {loading && (
            <span className="text-sm text-muted">대화 양에 따라 1~2분 걸릴 수 있어요.</span>
          )}
        </div>
      )}

      {analysis && <AnalysisView analysis={analysis} />}
    </main>
  );
}

function StatsView({ stats }: { stats: ChatStats }) {
  const days =
    Math.round(
      (new Date(stats.end.toDateString()).getTime() -
        new Date(stats.start.toDateString()).getTime()) /
        86_400_000,
    ) + 1;

  return (
    <Section title="활동 통계">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatTile label="메시지" value={`${stats.total.toLocaleString()}개`} />
        <StatTile label="참여 멤버" value={`${stats.memberCount}명`} />
        <StatTile
          label="기간"
          value={`${days}일`}
          sub={`${formatDate(stats.start)} ~ ${formatDate(stats.end)}`}
        />
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <Card title="멤버별 메시지 (상위 10명)">
          <MemberBars data={stats.byMember.slice(0, 10)} />
        </Card>
        <Card title="시간대별 메시지">
          <HourColumns data={stats.byHour} />
        </Card>
      </div>
    </Section>
  );
}

function MemberBars({ data }: { data: ChatStats["byMember"] }) {
  const max = data[0]?.count ?? 1;
  return (
    <ul className="space-y-2">
      {data.map(({ user, count }) => (
        <li key={user} className="grid grid-cols-[5.5rem_1fr] items-center gap-3 text-sm">
          <span className="truncate text-secondary" title={user}>
            {user}
          </span>
          <div className="flex items-center gap-2">
            {/* 값 라벨 자리(2.5rem)를 남기고 막대 길이를 정한다 */}
            <div
              className="h-3 min-w-[2px] rounded-r bg-series"
              style={{ width: `calc((100% - 2.5rem) * ${count / max})` }}
            />
            <span className="tabular-nums text-secondary">{count}</span>
          </div>
        </li>
      ))}
    </ul>
  );
}

function HourColumns({ data }: { data: number[] }) {
  const max = Math.max(...data, 1);
  const peak = data.indexOf(Math.max(...data));
  return (
    <div>
      <div className="flex h-32 items-end gap-[2px] border-b border-baseline">
        {data.map((count, hour) => (
          <div
            key={hour}
            aria-label={`${hour}시 ${count}개`}
            className="group relative flex h-full flex-1 items-end justify-center"
          >
            <div
              className="w-full max-w-6 rounded-t bg-series"
              style={{ height: `${(count / max) * 100}%` }}
            />
            <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden -translate-x-1/2 whitespace-nowrap rounded bg-foreground px-2 py-1 text-xs text-background group-hover:block">
              {hour}시 · {count}개
            </div>
          </div>
        ))}
      </div>
      <div className="mt-1 flex text-xs tabular-nums text-muted">
        {data.map((_, hour) => (
          <span key={hour} className="flex-1 text-center">
            {hour % 6 === 0 ? hour : ""}
          </span>
        ))}
      </div>
      <p className="mt-2 text-sm text-secondary">
        가장 활발한 시간: {peak}시 ({data[peak]}개)
      </p>
    </div>
  );
}

function AnalysisView({ analysis }: { analysis: Analysis }) {
  const actions = [...analysis.action_items].sort(
    (a, b) => PRIORITY[a.priority].order - PRIORITY[b.priority].order,
  );
  return (
    <div className="space-y-8">
      <Section title={`방장 할 일 (${actions.length})`}>
        <ul className="space-y-3">
          {actions.map((item, i) => (
            <ActionItemCard key={i} item={item} />
          ))}
        </ul>
      </Section>

      <Section title="요약">
        <p className="whitespace-pre-line leading-7">{analysis.summary}</p>
      </Section>

      <Section title="주요 토픽">
        <ul className="space-y-3">
          {analysis.topics.map((t, i) => (
            <li key={i}>
              <p className="font-medium">{t.title}</p>
              <p className="text-sm text-secondary">{t.description}</p>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="이슈">
        {analysis.issues.length === 0 ? (
          <p className="text-muted">특별한 이슈가 없어요.</p>
        ) : (
          <ul className="space-y-3">
            {analysis.issues.map((issue, i) => (
              <li key={i} className="rounded-xl border border-hairline bg-surface p-4">
                <span className="rounded-full bg-hairline px-2 py-0.5 text-xs">
                  {ISSUE_TYPE[issue.type]}
                </span>
                <p className="mt-2">{issue.description}</p>
                {issue.members.length > 0 && (
                  <p className="mt-1 text-xs text-muted">관련 멤버: {issue.members.join(", ")}</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}

function ActionItemCard({ item }: { item: ActionItem }) {
  const [done, setDone] = useState(false);
  const priority = PRIORITY[item.priority];
  return (
    <li className="rounded-xl border border-hairline bg-surface p-4">
      <label className="flex cursor-pointer items-start gap-3">
        <input
          type="checkbox"
          checked={done}
          onChange={(e) => setDone(e.target.checked)}
          className="mt-1 size-4"
        />
        <div className="flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className={done ? "text-muted line-through" : "font-medium"}>{item.title}</span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-hairline px-2 py-0.5 text-xs text-secondary">
              <span className="size-2 rounded-full" style={{ backgroundColor: priority.color }} />
              {priority.label}
            </span>
          </div>
          <p className="text-sm text-secondary">{item.detail}</p>
          {item.related_members.length > 0 && (
            <p className="text-xs text-muted">관련 멤버: {item.related_members.join(", ")}</p>
          )}
        </div>
      </label>
      {item.evidence.length > 0 && (
        <details className="mt-2 pl-7 text-sm">
          <summary className="cursor-pointer text-muted">근거 메시지 {item.evidence.length}개</summary>
          <ul className="mt-2 space-y-1 border-l-2 border-hairline pl-3 text-secondary">
            {item.evidence.map((quote, i) => (
              <li key={i}>“{quote}”</li>
            ))}
          </ul>
        </details>
      )}
    </li>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold">{title}</h2>
      {children}
    </section>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-hairline bg-surface p-4">
      <h3 className="mb-3 text-sm font-medium text-secondary">{title}</h3>
      {children}
    </div>
  );
}

function StatTile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-hairline bg-surface p-4">
      <p className="text-sm text-secondary">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-muted">{sub}</p>}
    </div>
  );
}
