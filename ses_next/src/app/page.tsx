import Link from "next/link";
import { getCurrentUser } from "@/lib/actions";
import { getSettlement } from "@/lib/projects-actions";
import { listAllDaily, listGrants, listInterviews } from "@/lib/domain-actions";
import { countsAsWork, parseNum, hm } from "@/lib/constants";
import AuthRetry from "@/components/AuthRetry";
import WorkBalanceCard from "@/components/WorkBalanceCard";
import AccountMenu from "@/components/AccountMenu";
import { isAuthClockError } from "@/lib/auth-error";

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
  let interviews: Awaited<ReturnType<typeof listInterviews>> = [];
  let holidays = new Set<string>();
  try {
    [settlement, daily, grants, interviews, holidays] = await Promise.all([
      getSettlement(ym),
      listAllDaily(),
      listGrants(),
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

  const waitingIv = interviews.filter((i) => i.status === "結果待ち");

  // 通知（残業/有給に加え、初期設定が未完了の場合の案内）
  const notes: { level: "danger" | "warn" | "info"; text: string }[] = [];
  (settlement?.warnings ?? []).forEach((w) => notes.push(w));
  if (soon.length > 0) notes.push({ level: "warn", text: `有給が失効間近です（${soon.join(" / ")}）。計画的に取得しましょう。` });

  const cM = (c: string) => ({ background: c + "12", borderColor: c });

  const hour = now.getHours();
  const greeting = hour < 5 ? "こんばんは" : hour < 11 ? "おはようございます" : hour < 18 ? "こんにちは" : "こんばんは";
  const todayStr = `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日（${["日","月","火","水","木","金","土"][now.getDay()]}）`;
  const enteredToday = daily.some((d) => d.date === `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`);

  return (
    <div>
      <header className="app-header px-4 py-3">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs" style={{ color: "var(--subtle)" }}>{todayStr}</div>
            <h1 className="text-xl font-extrabold">{greeting} 👋</h1>
          </div>
          {user?.email ? <AccountMenu email={user.email} /> : null}
        </div>
      </header>
      <div className="px-4 pt-4">
        {err ? (
          isAuthClockError(err) ? (
            <AuthRetry message={err} />
          ) : (
            <div className="card text-sm" style={{ color: "#f87171" }}>読み込みエラー: {err}</div>
          )
        ) : (
          <>
            {/* ヒーロー：今日の日報CTA */}
            <Link
              href="/nippo"
              className="block card card-hover"
              style={{
                background: enteredToday
                  ? "linear-gradient(135deg, rgba(16,185,129,0.18), rgba(16,185,129,0.05))"
                  : "linear-gradient(135deg, rgba(59,130,246,0.20), rgba(99,102,241,0.10))",
                borderColor: enteredToday ? "#10b981" : "var(--accent)",
              }}
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs" style={{ color: "var(--subtle)" }}>今日の日報</div>
                  <div className="mt-0.5 text-lg font-bold" style={{ color: enteredToday ? "#10b981" : "var(--accent)" }}>
                    {enteredToday ? "✅ 記入済み" : "📝 記入する"}
                  </div>
                </div>
                <div className="text-3xl">{enteredToday ? "🎉" : "▸"}</div>
              </div>
            </Link>

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

            {/* 今月のワークバランス */}
            <div className="mt-3"><WorkBalanceCard overtime={overtime} maxRun={maxRun} /></div>

            {/* メトリクス */}
            <h2 className="mt-5 mb-2 text-xs font-bold" style={{ color: "var(--subtle)" }}>今月のサマリー</h2>
            <div className="grid grid-cols-2 gap-2">
              <div className="metric"><div className="metric-label">総勤務</div><div className="metric-value">{(settlement?.totalWorked ?? 0).toFixed(2)}<span className="metric-unit">h</span></div><div className="text-xs" style={{ color: "var(--subtle)" }}>{hm(settlement?.totalWorked ?? 0)}</div></div>
              <div className="metric"><div className="metric-label">勤務日数</div><div className="metric-value">{settlement?.workDays ?? 0}<span className="metric-unit">日</span></div></div>
              <div className="metric"><div className="metric-label">残業</div><div className="metric-value" style={{ color: overtime > 0 ? "#f59e0b" : undefined }}>{overtime.toFixed(2)}<span className="metric-unit">h</span></div></div>
              <div className="metric"><div className="metric-label">有給残</div><div className="metric-value" style={{ color: leaveRemain <= 3 ? "#f59e0b" : "#10b981" }}>{leaveRemain.toFixed(1)}<span className="metric-unit">日</span></div></div>
            </div>

            {/* 未記入アラート */}
            {missing.length > 0 ? (
              <Link href="/nippo" className="mt-3 block card card-hover" style={cM("#f59e0b")}>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold" style={{ color: "#f59e0b" }}>📋 未記入の平日 {missing.length}日</span>
                  <span className="text-xs" style={{ color: "var(--subtle)" }}>日報へ ›</span>
                </div>
                <div className="mt-1 text-xs" style={{ color: "var(--muted)" }}>{missing.slice(-6).join("  ")}</div>
              </Link>
            ) : null}

            {/* 面談 */}
            {waitingIv.length > 0 ? (
              <Link href="/interviews" className="mt-3 block card card-hover">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold">💼 結果待ちの面談</span>
                  <span className="text-xs" style={{ color: "var(--subtle)" }}>{waitingIv.length}件 ›</span>
                </div>
              </Link>
            ) : null}

            {/* クイックリンク */}
            <h2 className="mt-5 mb-2 text-xs font-bold" style={{ color: "var(--subtle)" }}>ショートカット</h2>
            <div className="grid grid-cols-2 gap-2">
              <Link href="/settlement" className="card card-hover flex items-center gap-3" style={{ padding: "0.9rem" }}>
                <span className="text-2xl">📊</span>
                <div className="min-w-0">
                  <div className="text-sm font-bold">精算</div>
                  <div className="text-xs truncate" style={{ color: "var(--subtle)" }}>案件別の過不足</div>
                </div>
              </Link>
              <Link href="/report" className="card card-hover flex items-center gap-3" style={{ padding: "0.9rem" }}>
                <span className="text-2xl">📈</span>
                <div className="min-w-0">
                  <div className="text-sm font-bold">レポート</div>
                  <div className="text-xs truncate" style={{ color: "var(--subtle)" }}>月次の集計</div>
                </div>
              </Link>
              <Link href="/projects" className="card card-hover flex items-center gap-3" style={{ padding: "0.9rem" }}>
                <span className="text-2xl">📁</span>
                <div className="min-w-0">
                  <div className="text-sm font-bold">案件</div>
                  <div className="text-xs truncate" style={{ color: "var(--subtle)" }}>参画中の管理</div>
                </div>
              </Link>
              <Link href="/salary" className="card card-hover flex items-center gap-3" style={{ padding: "0.9rem" }}>
                <span className="text-2xl">💰</span>
                <div className="min-w-0">
                  <div className="text-sm font-bold">給与</div>
                  <div className="text-xs truncate" style={{ color: "var(--subtle)" }}>月収の記録</div>
                </div>
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
