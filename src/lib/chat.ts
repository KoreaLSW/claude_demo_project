import Papa from "papaparse";

export type ChatMessage = {
  date: Date;
  user: string;
  text: string;
  /** 입장·퇴장·초대 같은 시스템 알림 */
  system: boolean;
};

export type ChatStats = {
  total: number;
  memberCount: number;
  start: Date;
  end: Date;
  byMember: { user: string; count: number }[];
  /** 인덱스 = 시(0~23) */
  byHour: number[];
};

/** UTF-8로 먼저 읽고, 깨지면 EUC-KR(CP949)로 다시 읽는다. */
export function decodeFile(buf: ArrayBuffer): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(buf);
  } catch {
    return new TextDecoder("euc-kr").decode(buf);
  }
}

/** 카카오톡 CSV(Date, User, Message) 또는 PC판 TXT 내보내기를 읽는다. */
export function parseChat(text: string, fileName: string): ChatMessage[] {
  const messages = fileName.toLowerCase().endsWith(".csv")
    ? parseCsv(text)
    : parseTxt(text);
  if (!messages.some((m) => !m.system)) {
    throw new Error(
      "메시지를 하나도 찾지 못했습니다. 카카오톡에서 내보낸 CSV 또는 TXT 파일인지 확인해 주세요.",
    );
  }
  return messages;
}

// "2026-10-17 15:02:00", "2026. 10. 17. 오후 3:02", "2026/10/17 15:02" 등
const DATE_TIME_RE =
  /(\d{4})\s*[-./년]\s*(\d{1,2})\s*[-./월]\s*(\d{1,2})\s*[.일]?\s*(?:(오전|오후)\s*)?(\d{1,2}):(\d{2})(?::(\d{2}))?/;

function toHour24(hour: number, ampm?: string): number {
  if (ampm === "오전") return hour % 12;
  if (ampm === "오후") return (hour % 12) + 12;
  return hour;
}

function parseDateTime(s: string): Date | null {
  const m = DATE_TIME_RE.exec(s);
  if (!m) return null;
  const [, y, mo, d, ampm, h, mi, sec] = m;
  return new Date(+y, +mo - 1, +d, toHour24(+h, ampm), +mi, sec ? +sec : 0);
}

const COLUMN_KEYWORDS = {
  date: ["date", "날짜", "일시", "시간"],
  user: ["user", "name", "sender", "사용자", "이름", "보낸"],
  text: ["message", "text", "content", "메시지", "내용"],
};

/** 키워드로 열을 찾고, 못 찾으면 순서(날짜, 사용자, 메시지)로 고른다. */
function findColumn(
  fields: string[],
  keywords: string[],
  fallbackIndex: number,
): string | undefined {
  return (
    fields.find((f) => keywords.some((k) => f.toLowerCase().includes(k))) ??
    fields[fallbackIndex]
  );
}

function parseCsv(text: string): ChatMessage[] {
  const { data, meta } = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
  });
  const fields = meta.fields ?? [];
  const dateCol = findColumn(fields, COLUMN_KEYWORDS.date, 0);
  const userCol = findColumn(fields, COLUMN_KEYWORDS.user, 1);
  const textCol = findColumn(fields, COLUMN_KEYWORDS.text, 2);
  if (!dateCol || !userCol || !textCol) return [];

  const messages: ChatMessage[] = [];
  for (const row of data) {
    const date = parseDateTime(row[dateCol] ?? "");
    if (!date) continue;
    const user = (row[userCol] ?? "").trim();
    messages.push({
      date,
      user,
      text: (row[textCol] ?? "").trim(),
      system: user === "",
    });
  }
  return messages;
}

const DAY_LINE_RE = /^-+\s*(\d{4})년 (\d{1,2})월 (\d{1,2})일/;
const MESSAGE_LINE_RE = /^\[(.+?)\] \[(오전|오후) (\d{1,2}):(\d{2})\] (.*)$/;
const SYSTEM_LINE_RE =
  /님(이|을)\s.*(초대했습니다|나갔습니다|들어왔습니다|내보냈습니다)\.?$/;

function parseTxt(text: string): ChatMessage[] {
  const messages: ChatMessage[] = [];
  // 시스템 알림에는 시각이 없어서 그날 마지막으로 본 시각을 대신 쓴다.
  let clock: Date | null = null;
  let last: ChatMessage | null = null;

  for (const line of text.split(/\r?\n/)) {
    const day = DAY_LINE_RE.exec(line);
    if (day) {
      clock = new Date(+day[1], +day[2] - 1, +day[3]);
      last = null;
      continue;
    }
    if (!clock) continue; // 첫 날짜 줄 이전의 파일 머리말

    const msg = MESSAGE_LINE_RE.exec(line);
    if (msg) {
      const [, user, ampm, h, mi, body] = msg;
      clock = new Date(clock);
      clock.setHours(toHour24(+h, ampm), +mi);
      last = { date: clock, user, text: body, system: false };
      messages.push(last);
    } else if (SYSTEM_LINE_RE.test(line)) {
      last = null;
      messages.push({ date: clock, user: "", text: line.trim(), system: true });
    } else if (last) {
      last.text += "\n" + line; // 여러 줄 메시지의 이어지는 줄
    }
  }

  for (const m of messages) m.text = m.text.trim();
  return messages;
}

export function computeStats(messages: ChatMessage[]): ChatStats {
  const chats = messages.filter((m) => !m.system);
  const counts = new Map<string, number>();
  const byHour = Array<number>(24).fill(0);
  let start = chats[0].date;
  let end = chats[0].date;

  for (const m of chats) {
    counts.set(m.user, (counts.get(m.user) ?? 0) + 1);
    byHour[m.date.getHours()]++;
    if (m.date < start) start = m.date;
    if (m.date > end) end = m.date;
  }

  const byMember = [...counts]
    .map(([user, count]) => ({ user, count }))
    .sort((a, b) => b.count - a.count);

  return {
    total: chats.length,
    memberCount: counts.size,
    start,
    end,
    byMember,
    byHour,
  };
}

const pad = (n: number) => String(n).padStart(2, "0");

export function formatDate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function formatDateTime(d: Date): string {
  return `${formatDate(d)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Claude에 보낼 대화 로그. 원본 CSV보다 토큰이 적게 든다. */
export function toPromptLog(messages: ChatMessage[]): string {
  return messages
    .map(
      (m) =>
        `[${formatDateTime(m.date)}] ` +
        (m.system ? `(알림) ${m.text}` : `${m.user}: ${m.text}`),
    )
    .join("\n");
}
