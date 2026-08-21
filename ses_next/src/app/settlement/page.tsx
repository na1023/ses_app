import { getCurrentUser } from "@/lib/actions";
import { getSettlement, SettlementResult } from "@/lib/projects-actions";
import { hm } from "@/lib/constants";
import AppHeader from "@/components/AppHeader";
import MonthNav from "./MonthNav";
import ReasonEditor from "./ReasonEditor";
import ShareButton, { ShareData } from "./ShareButton";
import ClosingSwitch from "./ClosingSwitch";
import PeriodPicker from "./PeriodPicker";

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
  searchParams: { ym?: string; start?: string; end?: string };
}) {
  const user = await getCurrentUser();
  const ym = searchParams.ym || currentYm();
  const customStart = searchParams.start || "";
  const customEnd = searchParams.end || "";

  let data: SettlementResult | null = null;
  let loadError = "";
  try {
    data = await getSettlement(ym, customStart && customEnd ? { customStart, customEnd } : undefined);
  } catch (e) {
    loadError = e instanceof Error ? e.message : String(e);
  }

  const shareData: ShareData | null = data
    ? {
        periodLabel: data.periodLabel,
        totalWorked: data.totalWorked,
        workDays: data.workDays,
        overtime: data.overtime,
        scheduleOver: data.scheduleOver,
        hourly: data.hourly,
        pay: { inner: data.pay.innerPay, outer: data.pay.outerPay, night: data.pay.nightPay, total: data.pay.total },
        weeks: data.weeks.map((w) => ({ start: w.start, end: w.end, hours: w.hours, ot: w.ot, days: w.days })),
        rows: data.rows.map((r) => ({
          company: r.company,
          project: r.project_name,
          worked: r.worked,
          min: r.min,
          max: r.max,
          state: STATE_META[r.state]?.label ?? "—",
        })),
        days: data.days,
      }
    : null;

  return (
    <div>
      <AppHeader title="精算・稼働" subtitle="案件ごとの過不足と月間稼働" email={user?.email} />

      <div className="px-4 pt-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0 flex-1"><MonthNav ym={ym} /></div>
          <div className="flex shrink-0 gap-2">
            <PeriodPicker startInit={customStart} endInit={customEnd} />
            {shareData ? <ShareButton data={shareData} /> : null}
          </div>
        </div>
        {data ? (
          <>
            <div className="mt-2"><ClosingSwitch current={data.closingType} /></div>
            <p className="mt-1 text-center text-xs" style={{ color: "var(--subtle)" }}>集計期間：{data.periodLabel}</p>
          </>
        ) : null}

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

            {/* 残業代（自社定時基準・1分単位） */}
            {data.hourly > 0 ? (
              <>
                <h2 className="mb-2 mt-6 text-sm font-bold" style={{ color: "var(--muted)" }}>残業代（法律に基づく概算）</h2>
                <div className="card">
                  <div className="flex items-center justify-between">
                    <span className="text-sm" style={{ color: "var(--subtle)" }}>時給（基本給 ÷ 月平均所定労働時間）</span>
                    <span className="font-bold shrink-0">¥{Math.round(data.hourly).toLocaleString()}/h</span>
                  </div>

                  {/* 残業区分の内訳（各種類を必ず表示） */}
                  <div className="mt-3 grid grid-cols-1 gap-2">
                    <div className="rounded-xl px-3 py-2" style={{ background: "var(--surface-2)" }}>
                      <div className="flex items-center justify-between text-xs" style={{ color: "var(--subtle)" }}>
                        <span>① 法定内残業（100%）</span>
                        <span>自社の所定 → 8時間まで</span>
                      </div>
                      <div className="mt-1 flex items-center justify-between">
                        <span className="text-sm">{data.pay.innerOtMin > 0 ? hm(data.pay.innerOtMin / 60) : "0"}</span>
                        <b>¥{Math.round(data.pay.innerPay).toLocaleString()}</b>
                      </div>
                    </div>
                    <div className="rounded-xl px-3 py-2" style={{ background: "var(--surface-2)" }}>
                      <div className="flex items-center justify-between text-xs" style={{ color: "var(--subtle)" }}>
                        <span>② 法定外残業（125%）</span>
                        <span>1日8時間超</span>
                      </div>
                      <div className="mt-1 flex items-center justify-between">
                        <span className="text-sm">{data.pay.outerOtMin > 0 ? hm(data.pay.outerOtMin / 60) : "0"}</span>
                        <b style={{ color: data.pay.outerOtMin > 0 ? "#f59e0b" : undefined }}>¥{Math.round(data.pay.outerPay).toLocaleString()}</b>
                      </div>
                    </div>
                    <div className="rounded-xl px-3 py-2" style={{ background: "var(--surface-2)" }}>
                      <div className="flex items-center justify-between text-xs" style={{ color: "var(--subtle)" }}>
                        <span>③ 深夜割増（+25%）</span>
                        <span>22:00〜翌5:00</span>
                      </div>
                      <div className="mt-1 flex items-center justify-between">
                        <span className="text-sm">{data.pay.nightMin > 0 ? hm(data.pay.nightMin / 60) : "0"}</span>
                        <b style={{ color: data.pay.nightMin > 0 ? "#6366f1" : undefined }}>¥{Math.round(data.pay.nightPay).toLocaleString()}</b>
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 flex items-center justify-between border-t pt-2 font-bold" style={{ borderColor: "var(--border)" }}>
                    <span>残業代合計</span>
                    <span className="text-lg" style={{ color: "#10b981" }}>¥{Math.round(data.pay.total).toLocaleString()}</span>
                  </div>
                  <p className="mt-2 text-xs" style={{ color: "var(--subtle)" }}>
                    ※ 労基法の割増率に基づき、自社の所定労働時間（設定）を基準に算出。案件先の就業時間は「就業時間超過」の判定にのみ使用します。
                    法定外×深夜は 125%+25% = 150% になります。
                  </p>
                </div>
              </>
            ) : (
              <>
                <h2 className="mb-2 mt-6 text-sm font-bold" style={{ color: "var(--muted)" }}>残業代（未計算）</h2>
                <div className="card text-sm" style={{ borderColor: "#78500f", background: "#3a2a06" }}>
                  <div className="font-bold" style={{ color: "#fbbf24" }}>残業代を計算するには以下が必要です：</div>
                  <ul className="mt-2 space-y-1 text-xs" style={{ color: "var(--muted)" }}>
                    <li>{data.baseSalary > 0 ? "✅" : "⬜"} 給与管理に直近月の <b>基本給</b>（{data.baseSalary > 0 ? `¥${data.baseSalary.toLocaleString()}` : "未登録"}）</li>
                    <li>{"⬜"} 設定で <b>自社の定時</b>（開始〜終了＋休憩）</li>
                  </ul>
                  <div className="mt-2 flex gap-2">
                    <a className="btn-ghost" href="/salary">給与管理へ</a>
                    <a className="btn-ghost" href="/settings">設定へ</a>
                  </div>
                </div>
              </>
            )}

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

            {/* 週別（勤務・残業）— 可視化強化：定時分と残業分の積み上げ表示 */}
            <h2 className="mb-2 mt-6 text-sm font-bold" style={{ color: "var(--muted)" }}>週別（勤務・残業）</h2>
            {data.weeks.length === 0 ? (
              <p className="text-sm" style={{ color: "var(--subtle)" }}>この期間のデータはありません。</p>
            ) : (
              <div className="card space-y-3">
                {(() => {
                  const maxH = Math.max(...data.weeks.map((w) => w.hours), 40);
                  const md = (s: string) => { const [, m, dd] = s.split("-"); return `${Number(m)}/${Number(dd)}`; };
                  return data.weeks.map((w) => {
                    const base = Math.max(0, w.hours - w.ot);
                    const basePct = Math.min(100, (base / maxH) * 100);
                    const otPct = Math.min(100 - basePct, (w.ot / maxH) * 100);
                    return (
                      <div key={w.start}>
                        <div className="mb-1 flex items-center justify-between text-sm">
                          <span className="font-semibold">{md(w.start)}〜{md(w.end)}</span>
                          <span style={{ color: "var(--muted)" }}>
                            {w.hours.toFixed(2)}h（{hm(w.hours)}）・{w.days}日
                            {w.ot > 0 ? <span style={{ color: "#f59e0b" }}>　残業 {w.ot.toFixed(2)}h（{hm(w.ot)}）</span> : null}
                          </span>
                        </div>
                        <div className="bar-track flex" style={{ overflow: "hidden" }}>
                          <div style={{ width: `${basePct}%`, background: "#3b82f6", height: "100%" }} />
                          <div style={{ width: `${otPct}%`, background: "#f59e0b", height: "100%" }} />
                        </div>
                      </div>
                    );
                  });
                })()}
                <div className="mt-1 flex gap-3 text-xs" style={{ color: "var(--subtle)" }}>
                  <span><span className="inline-block h-2 w-3 align-middle" style={{ background: "#3b82f6" }} /> 定時内</span>
                  <span><span className="inline-block h-2 w-3 align-middle" style={{ background: "#f59e0b" }} /> 残業(8h超)</span>
                </div>
              </div>
            )}
          </>
        ) : null}
      </div>
    </div>
  );
}
