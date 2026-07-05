import { getCurrentUser } from "@/lib/actions";
import { getSettlement, SettlementResult } from "@/lib/projects-actions";
import { hm } from "@/lib/constants";
import AppHeader from "@/components/AppHeader";
import MonthNav from "./MonthNav";
import ReasonEditor from "./ReasonEditor";

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
            {/* 労働基準法 警告 */}
            {data.warnings.length > 0 ? (
              <div className="mt-4 space-y-2">
                {data.warnings.map((w, i) => {
                  const c = w.level === "danger" ? "#ef4444" : w.level === "warn" ? "#f59e0b" : "#3b82f6";
                  return (
                    <div key={i} className="card text-sm" style={{ borderColor: c, background: c + "12" }}>
                      <span style={{ color: c, fontWeight: 700 }}>
                        {w.level === "danger" ? "⚠ 重大" : w.level === "warn" ? "⚠ 注意" : "ℹ 参考"}
                      </span>{" "}
                      <span style={{ color: "var(--text)" }}>{w.text}</span>
                    </div>
                  );
                })}
              </div>
            ) : null}

            {/* 月間サマリー */}
            <div className="mt-4 grid grid-cols-2 gap-2">
              <div className="metric">
                <div className="metric-label">総勤務時間</div>
                <div className="metric-value">
                  {data.totalWorked.toFixed(2)}
                  <span className="metric-unit">h</span>
                </div>
                <div className="text-xs" style={{ color: "var(--subtle)" }}>（{hm(data.totalWorked)}）</div>
              </div>
              <div className="metric">
                <div className="metric-label">勤務日数</div>
                <div className="metric-value">
                  {data.workDays}
                  <span className="metric-unit">日</span>
                </div>
              </div>
              <div className="metric">
                <div className="metric-label">残業（8h超）</div>
                <div className="metric-value" style={{ color: data.overtime > 0 ? "#f59e0b" : undefined }}>
                  {data.overtime.toFixed(2)}
                  <span className="metric-unit">h</span>
                </div>
                <div className="text-xs" style={{ color: "var(--subtle)" }}>（{hm(data.overtime)}）</div>
              </div>
              <div className="metric">
                <div className="metric-label">就業時間超過（定時超）</div>
                <div className="metric-value" style={{ color: data.scheduleOver > 0 ? "#6366f1" : undefined }}>
                  {data.scheduleOver.toFixed(2)}
                  <span className="metric-unit">h</span>
                </div>
                <div className="text-xs" style={{ color: "var(--subtle)" }}>（{hm(data.scheduleOver)}）</div>
              </div>
            </div>
            <p className="mt-1.5 text-xs" style={{ color: "var(--subtle)" }}>
              残業＝各日(現場＋帰社)が8hを超えた分。就業時間超過＝案件の定時を超えた分。
            </p>

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
                            {r.worked.toFixed(2)}
                          </span>
                          <span className="text-sm" style={{ color: "var(--muted)" }}>
                            {" "}h（{hm(r.worked)}）稼働
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
                              ? `下限まで あと ${r.shortage.toFixed(2)} h 不足`
                              : r.state === "over"
                              ? `上限を ${r.excess.toFixed(2)} h 超過`
                              : "精算幅の範囲内（適正）"}
                          </div>
                          {/* 現在ペース（月途中のみ） */}
                          {r.pace !== "done" && r.pace !== "none" && r.projected !== null ? (
                            (() => {
                              const pc =
                                r.pace === "behind" ? "#ef4444" : r.pace === "overpace" ? "#f59e0b" : "#10b981";
                              const label =
                                r.pace === "behind" ? "このままだと不足ペース" : r.pace === "overpace" ? "上限超過ペース" : "順調（足りるペース）";
                              return (
                                <div className="mt-1 text-xs" style={{ color: pc }}>
                                  現在ペース：月末見込み <b>{r.projected.toFixed(0)}h</b> → {label}
                                </div>
                              );
                            })()
                          ) : null}
                          {/* 下限割れ/上限超過の理由メモ */}
                          {r.state === "short" || r.state === "over" ? (
                            <ReasonEditor
                              projectId={r.project_id}
                              ym={data.ym}
                              initial={r.reason}
                              kind={r.state}
                            />
                          ) : null}
                        </>
                      ) : (
                        <div className="mt-1.5 text-xs" style={{ color: "var(--subtle)" }}>
                          精算幅が未設定です（案件編集で下限・上限を設定できます）
                        </div>
                      )}

                      {/* 残業・就業時間超過 */}
                      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 border-t pt-2 text-xs" style={{ borderColor: "var(--border)" }}>
                        <span style={{ color: "var(--subtle)" }}>
                          定時{" "}
                          <b style={{ color: "var(--muted)" }}>
                            {r.scheduled !== null ? `${r.scheduled.toFixed(2)}h` : "未設定"}
                          </b>
                        </span>
                        <span style={{ color: "var(--subtle)" }}>
                          残業(8h超){" "}
                          <b style={{ color: r.overtime > 0 ? "#f59e0b" : "var(--muted)" }}>
                            {r.overtime.toFixed(2)}h{r.overtime > 0 ? `（${hm(r.overtime)}）` : ""}
                          </b>
                        </span>
                        <span style={{ color: "var(--subtle)" }}>
                          就業超過{" "}
                          <b style={{ color: r.scheduleOver > 0 ? "#6366f1" : "var(--muted)" }}>
                            {r.scheduled !== null ? `${r.scheduleOver.toFixed(2)}h${r.scheduleOver > 0 ? `（${hm(r.scheduleOver)}）` : ""}` : "—"}
                          </b>
                        </span>
                      </div>
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
