import { listRecentDaily, getCurrentUser } from "@/lib/actions";
import { listProjects } from "@/lib/projects-actions";
import { getSettlement } from "@/lib/projects-actions";
import { Project, countsAsWork } from "@/lib/constants";
import { isAuthClockError } from "@/lib/auth-error";
import DailyManager from "./DailyManager";
import AppHeader from "@/components/AppHeader";
import AuthRetry from "@/components/AuthRetry";
import WorkBalanceCard from "@/components/WorkBalanceCard";

export const dynamic = "force-dynamic";

async function getHolidays(): Promise<Record<string, string>> {
  try {
    const res = await fetch("https://holidays-jp.github.io/api/v1/date.json", {
      next: { revalidate: 86400 },
    });
    if (!res.ok) return {};
    return (await res.json()) as Record<string, string>;
  } catch {
    return {};
  }
}

export default async function NippoPage() {
  let reports: Awaited<ReturnType<typeof listRecentDaily>> = [];
  let projects: Project[] = [];
  let holidays: Record<string, string> = {};
  let settlement: Awaited<ReturnType<typeof getSettlement>> | null = null;
  let loadError = "";
  const user = await getCurrentUser();
  const now = new Date();
  const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  try {
    [reports, projects, holidays, settlement] = await Promise.all([
      listRecentDaily(60),
      listProjects(),
      getHolidays(),
      getSettlement(ym),
    ]);
  } catch (e) {
    loadError = e instanceof Error ? e.message : String(e);
  }

  // 連続勤務日数（今月）— ワークバランス用
  const monthWork = reports.filter((d) => String(d.date).startsWith(ym) && countsAsWork(d.attendance_type));
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

  return (
    <div>
      <AppHeader title="日報" subtitle="今日の勤務をサクッと記録" email={user?.email} />
      <div className="px-4 pt-4">
        {loadError ? (
          isAuthClockError(loadError) ? (
            <AuthRetry message={loadError} />
          ) : (
            <div className="card mb-4 text-sm" style={{ borderColor: "#7f1d1d", color: "#f87171" }}>
              データ接続エラー: {loadError}
            </div>
          )
        ) : (
          <>
            <div className="mb-3"><WorkBalanceCard overtime={overtime} maxRun={maxRun} /></div>
            <DailyManager projects={projects} reports={reports} holidays={holidays} />
          </>
        )}
      </div>
    </div>
  );
}
