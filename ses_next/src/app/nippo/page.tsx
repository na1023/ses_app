import { listRecentDaily, getCurrentUser } from "@/lib/actions";
import { listProjects } from "@/lib/projects-actions";
import { Project } from "@/lib/constants";
import DailyManager from "./DailyManager";
import AppHeader from "@/components/AppHeader";

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
  let loadError = "";
  const user = await getCurrentUser();
  try {
    [reports, projects, holidays] = await Promise.all([
      listRecentDaily(60),
      listProjects(),
      getHolidays(),
    ]);
  } catch (e) {
    loadError = e instanceof Error ? e.message : String(e);
  }

  return (
    <div>
      <AppHeader title="日報" subtitle="今日の勤務をサクッと記録" email={user?.email} />
      <div className="px-4 pt-4">
        {loadError ? (
          <div className="card mb-4 text-sm" style={{ borderColor: "#7f1d1d", color: "#f87171" }}>
            データ接続エラー: {loadError}
          </div>
        ) : (
          <DailyManager projects={projects} reports={reports} holidays={holidays} />
        )}
      </div>
    </div>
  );
}
