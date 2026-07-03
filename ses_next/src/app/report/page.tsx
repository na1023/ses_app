import { getCurrentUser } from "@/lib/actions";
import { listAllDaily } from "@/lib/domain-actions";
import { DailyReport, WORK_TYPES, ATT_COLOR, parseNum } from "@/lib/constants";
import AppHeader from "@/components/AppHeader";
import MonthNav from "../settlement/MonthNav";

export const dynamic = "force-dynamic";

function currentYm() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default async function ReportPage({ searchParams }: { searchParams: { ym?: string } }) {
  const user = await getCurrentUser();
  const ym = searchParams.ym || currentYm();

  let daily: DailyReport[] = [];
  let err = "";
  try {
    daily = await listAllDaily();
  } catch (e) {
    err = e instanceof Error ? e.message : String(e);
  }

  const month = daily.filter((d) => String(d.date).startsWith(ym));
  const workRows = month.filter((d) => WORK_TYPES.has(d.attendance_type));
  const siteHours = workRows.reduce((s, d) => s + (Number(d.work_hours) || 0), 0);
  const officeHours = workRows.reduce((s, d) => s + (parseNum(d.return_office_hours) ?? 0), 0);
  const total = siteHours + officeHours;
  const workDays = new Set(workRows.map((d) => d.date)).size;
  const avg = workDays ? total / workDays : 0;

  // 勤怠区分別
  const attMap = new Map<string, number>();
  month.forEach((d) => attMap.set(d.attendance_type, (attMap.get(d.attendance_type) ?? 0) + 1));
  const attList = Array.from(attMap.entries()).sort((a, b) => b[1] - a[1]);

  // 案件別稼働
  const projMap = new Map<string, number>();
  workRows.forEach((d) => {
    const key = `${d.company} / ${d.project_name}`;
    projMap.set(key, (projMap.get(key) ?? 0) + (Number(d.work_hours) || 0));
  });
  const projList = Array.from(projMap.entries()).sort((a, b) => b[1] - a[1]);
  const maxProj = projList.length ? projList[0][1] : 1;

  return (
    <div>
      <AppHeader title="レポート" subtitle="月次の稼働サマリー" email={user?.email} />
      <div className="px-4 pt-4">
        <MonthNav ym={ym} base="/report" />

        {err ? (
          <div className="mt-4 card text-sm" style={{ color: "#f87171" }}>読み込みエラー: {err}</div>
        ) : (
          <>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <div className="metric"><div className="metric-label">総勤務時間</div><div className="metric-value">{total.toFixed(1)}<span className="metric-unit">h</span></div></div>
              <div className="metric"><div className="metric-label">勤務日数</div><div className="metric-value">{workDays}<span className="metric-unit">日</span></div></div>
              <div className="metric"><div className="metric-label">1日平均</div><div className="metric-value">{avg.toFixed(1)}<span className="metric-unit">h</span></div></div>
              <div className="metric"><div className="metric-label">うち帰社</div><div className="metric-value">{officeHours.toFixed(1)}<span className="metric-unit">h</span></div></div>
            </div>

            <h2 className="mb-2 mt-6 text-sm font-bold" style={{ color: "var(--muted)" }}>勤怠区分別</h2>
            {attList.length === 0 ? (
              <p className="text-sm" style={{ color: "var(--subtle)" }}>この月のデータはありません。</p>
            ) : (
              <div className="card">
                {attList.map(([k, v]) => (
                  <div key={k} className="flex items-center justify-between border-b py-1.5 last:border-0" style={{ borderColor: "var(--border)" }}>
                    <span className="flex items-center gap-2 text-sm">
                      <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: ATT_COLOR[k] ?? "#64748b" }} />
                      {k}
                    </span>
                    <span className="text-sm font-bold">{v}日</span>
                  </div>
                ))}
              </div>
            )}

            {projList.length > 0 ? (
              <>
                <h2 className="mb-2 mt-6 text-sm font-bold" style={{ color: "var(--muted)" }}>案件別稼働</h2>
                <div className="card space-y-2.5">
                  {projList.map(([k, v]) => (
                    <div key={k}>
                      <div className="mb-1 flex items-center justify-between text-sm">
                        <span className="truncate pr-2">{k}</span>
                        <span className="shrink-0 font-bold">{v.toFixed(1)}h</span>
                      </div>
                      <div className="bar-track">
                        <div className="bar-fill" style={{ width: `${(v / maxProj) * 100}%`, background: "#3b82f6" }} />
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
