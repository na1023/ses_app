import Link from "next/link";
import { getCurrentUser } from "@/lib/actions";
import { getSettlement } from "@/lib/projects-actions";
import { listAllDaily, listGrants, listTodos, listInterviews } from "@/lib/domain-actions";
import { countsAsWork, monthWorkLevel, parseNum, hm } from "@/lib/constants";
import AppHeader from "@/components/AppHeader";

export const dynamic = "force-dynamic";

const CONSUME: Record<string, number> = { 有給: 1, 午前半休: 0.5, 午後半休: 0.5 };

async function getHolidaySet(): Promise<Set<string>> {
  try {
    const res = await fetch("https://holidays-jp.github.io/api/v1/date.json", { next: { revalidate: 86400 } });
    if (!res.ok) return new Set();
    return new Set(Object.keys((await res.json()) as Record<string, string>));
  } catch {
    return new Set();
  }
}

function ymd(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default async function HomePage() {
  const user = await getCurrentUser();
  const now = new Date();
  const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  let err = "";
  let settlement: Awaited<ReturnType<typeof getSettlement>> | null = null;
  let daily: Awaited<ReturnType<typeof listAllDaily>> = [];
  let grants: Awaited<ReturnType<typeof listGrants>> = [];
  let todos: Awaited<ReturnType<typeof listTodos>> = [];
  let interviews: Awaited<ReturnType<typeof listInterviews>> = [];
  let holidays = new Set<string>();
  try {
    [settlement, daily, grants, todos, interviews, holidays] = await Promise.all([
      getSettlement(ym),
      listAllDaily(),
      listGrants(),
      listTodos(),
      listInterviews(),
      getHolidaySet(),
    ]);
  } catch (e) {
    err = e instanceof Error ? e.message : String(e);
  }

  // 連続勤務日数（今月）
  const monthWork = daily.filter((d) => String(d.date).startsWith(ym) && countsAsWork(d.attendance_type));
  const dset = Array.from(new Set(monthWork.map((d) => d.date))).sort();
  let run = 0, maxRun = 0;
  let prev: Date | null = null;
  dset.forEach((ds) => {
    const cur = new Date(ds);
    if (prev && cur.getTime() - prev.getTime() === 86400000) run += 1;
    else run = 1;
    maxRun = Math.max(maxRun, run);
    prev = cur;
  });

  const overtime = settlement?.overtime ?? 0;
  const level = monthWorkLevel(overtime, maxRun);

  // 未記入（平日で日報が無い日）
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const entered = new Set(daily.map((d) => d.date));
  const missing: string[] = [];
  const dim = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  for (let day = 1; day <= dim; day++) {
    const dt = new Date(now.getFullYear(), now.getMonth(), day);
    if (dt > today) break;
    const w = dt.getDay();
    if (w === 0 || w === 6) continue;
    const s = ymd(dt);
    if (holidays.has(s)) continue;
    if (!entered.has(s)) missing.push(s);
  }

  // 有給
  let grantedValid = 0;
  const soon: string[] = [];
  grants.forEach((g) => {
    const days = parseNum(g.days) ?? 0;
    const gd = new Date(g.grant_date);
    if (Number.isNaN(gd.getTime())) return;
    const exp = new Date(gd);
    exp.setFullYear(exp.getFullYear() + 2);
    if (exp > today) {
      grantedValid += days;
      const toExp = Math.ceil((exp.getTime() - today.getTime()) / 86400000);
      if (toExp <= 60) soon.push(`${exp.toISOString().slice(0, 10)}（あと${toExp}日）`);
    }
  });
  const consumed = daily.reduce((s, d) => s + (CONSUME[d.attendance_type] ?? 0), 0);
  const leaveRemain = grantedValid - consumed;

  const openTodos = todos.filter((t) => t.progress !== "完了");
  const waitingIv = interviews.filter((i) => i.status === "結果待ち");

  // 通知
  const notes: { level: "danger" | "warn" | "info"; text: string }[] = [];
  (settlement?.warnings ?? []).forEach((w) => notes.push(w));
  if (soon.length > 0) notes.push({ level: "warn", text: `有給が失効間近です（${soon.join(" / ")}）。計画的に取得しましょう。` });

  const cM = (c: string) => ({ background: c + "12", borderColor: c });

  return (
    <div>
      <AppHeader title="ホーム" subtitle={`${now.getMonth() + 1}月のサマリー`} email={user?.email} />
      <div className="px-4 pt-4">
        {err ? (
          <div className="card text-sm" style={{ color: "#f87171" }}>読み込みエラー: {err}</div>
        ) : (
          <>
            {/* 今月のワークバランス */}
            <div className="card" style={{ background: level.color + "12", borderColor: level.color }}>
              <div className="text-xs" style={{ color: "var(--subtle)" }}>今月のワークバランス</div>
              <div className="mt-1 flex items-center justify-between">
                <div className="text-2xl font-extrabold" style={{ color: level.color }}>{level.emoji} {level.label}</div>
                <div className="text-right text-xs" style={{ color: "var(--muted)" }}>
                  残業 {overtime.toFixed(1)}h<br />最大連続 {maxRun}日
                </div>
              </div>
            </div>

            {/* 通知 */}
            {notes.length > 0 ? (
              <div className="mt-3 space-y-2">
                {notes.map((n, i) => {
                  const c = n.level === "danger" ? "#ef4444" : n.level === "warn" ? "#f59e0b" : "#3b82f6";
                  return (
                    <div key={i} className="card text-sm" style={cM(c)}>
                      <span style={{ color: c, fontWeight: 700 }}>{n.level === "danger" ? "⚠ 重大" : n.level === "warn" ? "⚠ 注意" : "ℹ"}</span>{" "}
                      <span>{n.text}</span>
                    </div>
                  );
                })}
              </div>
            ) : null}

            {/* メトリクス */}
            <div className="mt-3 grid grid-cols-2 gap-2">
              <div className="metric"><div className="metric-label">今月の総勤務</div><div className="metric-value">{(settlement?.totalWorked ?? 0).toFixed(1)}<span className="metric-unit">h</span></div><div className="text-xs" style={{ color: "var(--subtle)" }}>（{hm(settlement?.totalWorked ?? 0)}）</div></div>
              <div className="metric"><div className="metric-label">勤務日数</div><div className="metric-value">{settlement?.workDays ?? 0}<span className="metric-unit">日</span></div></div>
              <div className="metric"><div className="metric-label">今月の残業</div><div className="metric-value" style={{ color: overtime > 0 ? "#f59e0b" : undefined }}>{overtime.toFixed(1)}<span className="metric-unit">h</span></div></div>
              <div className="metric"><div className="metric-label">有給残</div><div className="metric-value" style={{ color: leaveRemain <= 3 ? "#f59e0b" : "#10b981" }}>{leaveRemain.toFixed(1)}<span className="metric-unit">日</span></div></div>
            </div>

            {/* 未記入アラート */}
            {missing.length > 0 ? (
              <Link href="/nippo" className="mt-3 block card card-hover" style={cM("#f59e0b")}>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold" style={{ color: "#f59e0b" }}>未記入の平日 {missing.length}日</span>
                  <span className="text-xs" style={{ color: "var(--subtle)" }}>日報へ ›</span>
                </div>
                <div className="mt-1 text-xs" style={{ color: "var(--muted)" }}>{missing.slice(-6).join("  ")}</div>
              </Link>
            ) : null}

            {/* 未完ToDo / 面談 */}
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Link href="/interviews" className="card card-hover">
                <div className="metric-label">未完ToDo</div>
                <div className="metric-value">{openTodos.length}<span className="metric-unit">件</span></div>
              </Link>
              <Link href="/interviews" className="card card-hover">
                <div className="metric-label">結果待ち面談</div>
                <div className="metric-value">{waitingIv.length}<span className="metric-unit">件</span></div>
              </Link>
            </div>

            {/* クイックリンク */}
            <div className="mt-4 grid grid-cols-3 gap-2">
              <Link href="/nippo" className="card card-hover text-center text-sm font-semibold">📝 日報</Link>
              <Link href="/settlement" className="card card-hover text-center text-sm font-semibold">📊 精算</Link>
              <Link href="/report" className="card card-hover text-center text-sm font-semibold">📈 レポート</Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
