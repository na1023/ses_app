import { getCurrentUser } from "@/lib/actions";
import { listGrants, listAllDaily, LeaveGrant } from "@/lib/domain-actions";
import { DailyReport, parseNum } from "@/lib/constants";
import AppHeader from "@/components/AppHeader";
import LeaveClient from "./LeaveClient";

export const dynamic = "force-dynamic";

const CONSUME: Record<string, number> = { 有給: 1, 午前半休: 0.5, 午後半休: 0.5 };

export default async function LeavePage() {
  const user = await getCurrentUser();
  let grants: LeaveGrant[] = [];
  let daily: DailyReport[] = [];
  let err = "";
  try {
    [grants, daily] = await Promise.all([listGrants(), listAllDaily()]);
  } catch (e) {
    err = e instanceof Error ? e.message : String(e);
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // 有効付与（付与から2年以内）
  let grantedValid = 0;
  const soon: { grant: LeaveGrant; expire: Date; days: number }[] = [];
  grants.forEach((g) => {
    const days = parseNum(g.days) ?? 0;
    const gd = new Date(g.grant_date);
    if (Number.isNaN(gd.getTime())) return;
    const exp = new Date(gd);
    exp.setFullYear(exp.getFullYear() + 2);
    if (exp > today) {
      grantedValid += days;
      const daysToExp = Math.ceil((exp.getTime() - today.getTime()) / 86400000);
      if (daysToExp <= 120) soon.push({ grant: g, expire: exp, days });
    }
  });

  const consumed = daily.reduce((s, d) => s + (CONSUME[d.attendance_type] ?? 0), 0);
  const remaining = grantedValid - consumed;

  return (
    <div>
      <AppHeader title="有給休暇" subtitle="残日数と付与・消化の管理" email={user?.email} />
      {err ? (
        <div className="mx-4 mt-4 card text-sm" style={{ color: "#f87171" }}>読み込みエラー: {err}</div>
      ) : (
        <div className="px-4 pt-4">
          <div className="grid grid-cols-3 gap-2">
            <div className="metric"><div className="metric-label">有効付与</div><div className="metric-value">{grantedValid.toFixed(1)}<span className="metric-unit">日</span></div></div>
            <div className="metric"><div className="metric-label">消化</div><div className="metric-value">{consumed.toFixed(1)}<span className="metric-unit">日</span></div></div>
            <div className="metric"><div className="metric-label">残日数</div><div className="metric-value" style={{ color: remaining <= 3 ? "#f59e0b" : "#10b981" }}>{remaining.toFixed(1)}<span className="metric-unit">日</span></div></div>
          </div>

          {soon.length > 0 ? (
            <div className="mt-3 card" style={{ borderColor: "#78350f" }}>
              <div className="mb-1 text-sm font-bold" style={{ color: "#f59e0b" }}>失効が近い付与</div>
              {soon.map((s) => (
                <div key={s.grant.id} className="text-xs" style={{ color: "var(--muted)" }}>
                  {s.grant.grant_date} 付与の {s.days.toFixed(1)}日 → {s.expire.toISOString().slice(0, 10)} 失効
                </div>
              ))}
            </div>
          ) : null}

          <LeaveClient grants={grants} />
        </div>
      )}
    </div>
  );
}
