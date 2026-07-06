import { getCurrentUser } from "@/lib/actions";
import { listAllDaily, listSalary } from "@/lib/domain-actions";
import { listProjects } from "@/lib/projects-actions";
import {
  parseSessions,
  hhmmToMin,
  countsAsWork,
  sessionsHours,
  parseNum,
} from "@/lib/constants";
import { INCOME_FIELDS, DEDUCTION_FIELDS } from "@/lib/salary";
import AppHeader from "@/components/AppHeader";

export const dynamic = "force-dynamic";

type Finding = { level: "error" | "warn" | "info"; where: string; message: string };

export default async function DiagnosticsPage() {
  const user = await getCurrentUser();
  const findings: Finding[] = [];
  let err = "";

  try {
    const [daily, projects, salary] = await Promise.all([
      listAllDaily(),
      listProjects(),
      listSalary(),
    ]);

    // 日報
    const dateCount = new Map<string, number>();
    const todayStr = new Date().toISOString().slice(0, 10);
    daily.forEach((d) => {
      dateCount.set(d.date, (dateCount.get(d.date) ?? 0) + 1);
      if (countsAsWork(d.attendance_type)) {
        const sess = parseSessions(d.work_sessions);
        const bad = sess.find((s) => {
          const a = hhmmToMin(s.start);
          const b = hhmmToMin(s.end);
          return a == null || b == null || b <= a;
        });
        if (sess.length && bad) findings.push({ level: "error", where: `日報 ${d.date}`, message: `勤務時間の時刻が不正です（${bad.start}〜${bad.end}）。` });
        if (!d.work_content || !d.work_content.trim()) findings.push({ level: "warn", where: `日報 ${d.date}`, message: "勤務日ですが業務内容が空です。" });
        // 実働と時刻の整合
        if (sess.length) {
          const brk = (hhmmToMin(d.break_time || "") ?? 0) / 60;
          const calc = Math.max(0, sessionsHours(sess) - brk);
          const stored = Number(d.work_hours) || 0;
          if (Math.abs(calc - stored) > 0.1) findings.push({ level: "warn", where: `日報 ${d.date}`, message: `実働時間が時刻と一致しません（記録 ${stored.toFixed(2)}h / 計算 ${calc.toFixed(2)}h）。` });
        }
      }
      if (d.date > todayStr) findings.push({ level: "info", where: `日報 ${d.date}`, message: "未来の日付の日報があります。" });
    });
    dateCount.forEach((n, date) => {
      if (n > 1) findings.push({ level: "warn", where: `日報 ${date}`, message: `同じ日付の日報が ${n} 件あります。` });
    });

    // 案件
    projects.forEach((p) => {
      const name = `${p.company} / ${p.project_name}`;
      const s = (p.start_date || "").trim();
      const e = (p.end_date || "").trim();
      const eIsDate = e && e !== "現在" && e !== "継続中" && e !== "継続";
      if (s && eIsDate && s > e) findings.push({ level: "error", where: `案件 ${name}`, message: `開始日(${s})が終了日(${e})より後です。` });
      const mn = parseNum(p.min_hours);
      const mx = parseNum(p.max_hours);
      if (mn !== null && mx !== null && mn > mx) findings.push({ level: "warn", where: `案件 ${name}`, message: `精算幅の下限(${mn})が上限(${mx})を超えています。` });
    });

    // 給与
    const numKeys = [...INCOME_FIELDS, ...DEDUCTION_FIELDS].map(([k]) => k);
    salary.forEach((r) => {
      numKeys.forEach((k) => {
        const v = (r as Record<string, string>)[k];
        if (v !== undefined && String(v).trim() !== "") {
          const cleaned = String(v).replace(/,/g, "").trim();
          if (Number.isNaN(Number(cleaned))) {
            findings.push({ level: "error", where: `給与 ${r.year_month}`, message: `「${k}」が数値ではありません（${v}）。` });
          }
        }
      });
    });
  } catch (e) {
    err = e instanceof Error ? e.message : String(e);
  }

  const order = { error: 0, warn: 1, info: 2 };
  findings.sort((a, b) => order[a.level] - order[b.level]);
  const nErr = findings.filter((f) => f.level === "error").length;
  const nWarn = findings.filter((f) => f.level === "warn").length;

  return (
    <div>
      <AppHeader title="エラー自動検出" subtitle="データの矛盾・異常をチェック" email={user?.email} />
      <div className="px-4 pt-4">
        {err ? (
          <div className="card text-sm" style={{ color: "#f87171" }}>読み込みエラー: {err}</div>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-2">
              <div className="metric"><div className="metric-label">検出</div><div className="metric-value">{findings.length}</div></div>
              <div className="metric"><div className="metric-label">エラー</div><div className="metric-value" style={{ color: nErr ? "#ef4444" : undefined }}>{nErr}</div></div>
              <div className="metric"><div className="metric-label">警告</div><div className="metric-value" style={{ color: nWarn ? "#f59e0b" : undefined }}>{nWarn}</div></div>
            </div>

            {findings.length === 0 ? (
              <div className="mt-4 card text-sm" style={{ color: "#10b981" }}>問題は検出されませんでした。データは健全です。</div>
            ) : (
              <ul className="mt-4 space-y-2">
                {findings.map((f, i) => {
                  const c = f.level === "error" ? "#ef4444" : f.level === "warn" ? "#f59e0b" : "#3b82f6";
                  return (
                    <li key={i} className="card" style={{ borderColor: c }}>
                      <div className="flex items-center gap-2">
                        <span className="badge" style={{ background: c + "22", color: c }}>{f.level === "error" ? "エラー" : f.level === "warn" ? "警告" : "情報"}</span>
                        <span className="text-xs" style={{ color: "var(--subtle)" }}>{f.where}</span>
                      </div>
                      <div className="mt-1 text-sm">{f.message}</div>
                    </li>
                  );
                })}
              </ul>
            )}
          </>
        )}
      </div>
    </div>
  );
}
