import { getCurrentUser } from "@/lib/actions";
import { getSettlement, SettlementResult } from "@/lib/projects-actions";
import AppHeader from "@/components/AppHeader";
import MonthNav from "./MonthNav";

export const dynamic = "force-dynamic";

function currentYm(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

const STATE_META: Record<string, { label: string; color: string }> = {
  ok: { label: "適正", color: "#10b981" },
  short: { label: "不足", color: "#ef4444" },
  over: { label: "超過", color: "#f59e0b" },
  none: { label: "基準なし", color: "#64748b" },
};

export default async function SettlementPage({
  searchParams,
}: {
  searchParams: { ym?: string };
}) {
  const user = await getCurrentUser();
  const ym = searchParams.ym || currentYm();

  let data: SettlementResult | null = null;
  let loadError = "";
  try {
    data = await getSettlement(ym);
  } catch (e) {
    loadError = e instanceof Error ? e.message : String(e);
  }

  return (
    <div>
      <AppHeader title="精算・稼働" subtitle="案件ごとの過不足と月間稼働" email={user?.email} />

      <div className="px-4 pt-4">
        <MonthNav ym={ym} />

        {loadError ? (
          <div className="mt-4 card text-sm" style={{ color: "#f87171" }}>
            読み込みエラー: {loadError}
          </div>
        ) : data ? (
          <>
            {/* 月間サマリー */}
            <div className="mt-4 grid grid-cols-2 gap-2">
              <div className="metric">
                <div className="metric-label">当月の総勤務時間</div>
                <div className="metric-value">
                  {data.totalWorked.toFixed(1)}
                  <span className="metric-unit">h</span>
                </div>
              </div>
              <div className="metric">
                <div className="metric-label">勤務日数</div>
                <div className="metric-value">
                  {data.workDays}
                  <span className="metric-unit">日</span>
                </div>
              </div>
            </div>

            {/* 案件ごとの精算 */}
            <h2 className="mb-2 mt-6 text-sm font-bold" style={{ color: "var(--muted)" }}>
              案件ごとの精算状況
            </h2>

            {data.rows.length === 0 ? (
              <p className="text-sm" style={{ color: "var(--subtle)" }}>
                案件が登録されていません。「案件」タブで登録してください。
              </p>
            ) : (
              <ul className="space-y-2">
                {data.rows.map((r) => {
                  const meta = STATE_META[r.state];
                  const hasBand = r.min !== null || r.max !== null;
                  // 進捗バー（上限を100%基準、無ければ下限基準）
                  const base = r.max ?? r.min ?? 0;
                  const pct =
                    base > 0 ? Math.min(100, (r.worked / base) * 100) : 0;
                  const barColor =
                    r.state === "short"
                      ? "#ef4444"
                      : r.state === "over"
                      ? "#f59e0b"
                      : "#10b981";
                  return (
                    <li key={r.project_id} className="card">
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <div className="truncate font-bold">
                            {r.company}
                          </div>
                          <div
                            className="truncate text-xs"
                            style={{ color: "var(--subtle)" }}
                          >
                            {r.project_name}
                          </div>
                        </div>
                        <span
                          className="badge shrink-0"
                          style={{ background: meta.color + "22", color: meta.color }}
                        >
                          {meta.label}
                        </span>
                      </div>

                      <div className="mt-2 flex items-end justify-between">
                        <div>
                          <span className="text-2xl font-extrabold">
                            {r.worked.toFixed(1)}
                          </span>
                          <span className="text-sm" style={{ color: "var(--muted)" }}>
                            {" "}
                            h 稼働
                          </span>
                        </div>
                        <div className="text-right text-xs" style={{ color: "var(--subtle)" }}>
                          精算幅 {r.min ?? "—"}〜{r.max ?? "—"} h
                        </div>
                      </div>

                      {hasBand ? (
                        <>
                          <div className="mt-2 bar-track">
                            <div
                              className="bar-fill"
                              style={{ width: `${pct}%`, background: barColor }}
                            />
                          </div>
                          <div className="mt-1.5 text-sm font-semibold" style={{ color: meta.color }}>
                            {r.state === "short"
                              ? `下限まで あと ${r.shortage.toFixed(1)} h 不足`
                              : r.state === "over"
                              ? `上限を ${r.excess.toFixed(1)} h 超過`
                              : "精算幅の範囲内（適正）"}
                          </div>
                        </>
                      ) : (
                        <div className="mt-1.5 text-xs" style={{ color: "var(--subtle)" }}>
                          精算幅が未設定です（案件編集で下限・上限を設定できます）
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </>
        ) : null}
      </div>
    </div>
  );
}
