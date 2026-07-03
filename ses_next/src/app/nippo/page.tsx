import { listRecentDaily, listCompanies, getCurrentUser } from "@/lib/actions";
import { ATT_COLOR, LATE_EARLY_TYPES } from "@/lib/constants";
import NippoForm from "./NippoForm";
import AppHeader from "@/components/AppHeader";

export const dynamic = "force-dynamic";

export default async function NippoPage() {
  let reports: Awaited<ReturnType<typeof listRecentDaily>> = [];
  let companies: string[] = [];
  let loadError = "";
  const user = await getCurrentUser();
  try {
    [reports, companies] = await Promise.all([
      listRecentDaily(30),
      listCompanies(),
    ]);
  } catch (e) {
    loadError = e instanceof Error ? e.message : String(e);
  }

  return (
    <div>
      <AppHeader title="日報" subtitle="今日の勤務をサクッと記録" email={user?.email} />
      <div className="px-4 pt-4">

      {loadError ? (
        <div
          className="card mb-4 text-sm"
          style={{ borderColor: "#7f1d1d", color: "#f87171" }}
        >
          データ接続エラー: {loadError}
          <div className="mt-1 text-xs" style={{ color: "var(--subtle)" }}>
            .env.local の SUPABASE_URL / SUPABASE_KEY を確認してください。
          </div>
        </div>
      ) : null}

      <NippoForm companies={companies} />

      <section className="mt-7">
        <h2 className="mb-2 text-sm font-bold" style={{ color: "var(--muted)" }}>
          直近の日報
        </h2>
        {reports.length === 0 ? (
          <p className="text-sm" style={{ color: "var(--subtle)" }}>
            まだ登録がありません。
          </p>
        ) : (
          <ul className="space-y-2">
            {reports.map((r) => {
              const wh = Number(r.work_hours) || 0;
              const let_ = parseFloat(r.late_early_time) || 0;
              const color = ATT_COLOR[r.attendance_type] ?? "#94a3b8";
              return (
                <li key={r.id} className="card">
                  <div className="flex items-center justify-between">
                    <span className="font-bold">{r.date}</span>
                    <span
                      className="rounded-full px-2 py-0.5 text-xs font-semibold"
                      style={{ background: color + "22", color }}
                    >
                      {r.attendance_type}
                    </span>
                  </div>
                  <div
                    className="mt-1 text-xs"
                    style={{ color: "var(--subtle)" }}
                  >
                    {[
                      r.company && `${r.company}${r.project_name ? " / " + r.project_name : ""}`,
                      r.start_time && r.end_time && `${r.start_time}〜${r.end_time}`,
                      wh > 0 && `実働 ${wh.toFixed(2)}h`,
                      let_ > 0 && LATE_EARLY_TYPES.has(r.attendance_type) && `遅刻/早退 ${let_.toFixed(2)}h`,
                    ]
                      .filter(Boolean)
                      .join("  |  ")}
                  </div>
                  {r.work_content ? (
                    <p className="mt-1 text-xs" style={{ color: "var(--muted)" }}>
                      {r.work_content.slice(0, 80)}
                      {r.work_content.length > 80 ? "…" : ""}
                    </p>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </section>
      </div>
    </div>
  );
}
