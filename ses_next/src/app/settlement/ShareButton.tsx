"use client";

import { useMemo, useState } from "react";

export type ShareData = {
  periodLabel: string;
  totalWorked: number;
  workDays: number;
  overtime: number;
  scheduleOver: number;
  payMin: { innerOtMin: number; outerOtMin: number; nightMin: number };
  weeks: { start: string; end: string; hours: number; ot: number; days: number }[];
  rows: { company: string; project: string; worked: number; min: number | null; max: number | null; state: string }[];
  days: {
    date: string; company: string; project: string; att: string;
    site: number; office: number; total: number; ot: number;
    start: string; end: string; brk: string;
    officeStart: string; officeEnd: string;
    lateEarly: number; content: string; remarks: string;
  }[];
};

const md = (s: string) => { const [, m, d] = s.split("-"); return `${Number(m)}/${Number(d)}`; };
const hm = (min: number) => {
  if (min <= 0) return "0";
  const h = Math.floor(min / 60), m = Math.round(min % 60);
  return m === 0 ? `${h}時間` : `${h}時間${m}分`;
};

type Fmt = "text" | "table" | "csv";

// ============================================================
// 選択キー
// ============================================================
const SUMMARY_FIELDS = [
  { key: "total_hours", label: "総勤務時間" },
  { key: "work_days", label: "勤務日数" },
  { key: "overtime", label: "残業(8h超)" },
  { key: "schedule_over", label: "就業時間超過" },
];
const OT_FIELDS = [
  { key: "inner", label: "法定内残業" },
  { key: "outer", label: "法定外残業" },
  { key: "night", label: "深夜労働" },
];
const DAY_FIELDS = [
  { key: "date", label: "日付" },
  { key: "att", label: "勤怠区分" },
  { key: "company", label: "会社名" },
  { key: "project", label: "案件名" },
  { key: "hours", label: "勤務時間" },
  { key: "time", label: "出退勤+休憩" },
  { key: "office", label: "帰社時刻" },
  { key: "late_early", label: "遅刻/早退時間" },
  { key: "ot", label: "残業時間" },
  { key: "sitebreak", label: "現場+帰社の内訳" },
  { key: "content", label: "業務内容" },
  { key: "remarks", label: "備考" },
];

export default function ShareButton({ data }: { data: ShareData }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [fmt, setFmt] = useState<Fmt>("text");
  const [showSection, setShowSection] = useState<Record<string, boolean>>({
    summary: true, otbreak: false, weeks: false, projects: true, days: false,
  });

  // サブ選択（各項目のON/OFF）
  const [summarySel, setSummarySel] = useState<Record<string, boolean>>({ total_hours: true, work_days: true, overtime: true, schedule_over: false });
  const [otSel, setOtSel] = useState<Record<string, boolean>>({ inner: true, outer: true, night: true });
  const [daySel, setDaySel] = useState<Record<string, boolean>>({ date: true, att: true, company: true, project: true, hours: true, time: true, office: false, late_early: false, ot: false, sitebreak: false, content: false, remarks: false });
  // 各週・各案件を個別に選択
  const [weekSel, setWeekSel] = useState<Record<string, boolean>>(() => Object.fromEntries(data.weeks.map((w) => [w.start, true])));
  const [projSel, setProjSel] = useState<Record<string, boolean>>(() => Object.fromEntries(data.rows.map((r, i) => [`${i}_${r.company}_${r.project}`, true])));

  function selectAll(on: boolean) {
    setShowSection({ summary: on, otbreak: on, weeks: on, projects: on, days: on });
    setSummarySel(Object.fromEntries(SUMMARY_FIELDS.map((f) => [f.key, on])));
    setOtSel(Object.fromEntries(OT_FIELDS.map((f) => [f.key, on])));
    setDaySel(Object.fromEntries(DAY_FIELDS.map((f) => [f.key, on])));
    setWeekSel(Object.fromEntries(data.weeks.map((w) => [w.start, on])));
    setProjSel(Object.fromEntries(data.rows.map((r, i) => [`${i}_${r.company}_${r.project}`, on])));
  }

  // ==================== テキスト生成 ====================
  const buildText = useMemo(() => (): string => {
    const L: string[] = [`【稼働レポート】${data.periodLabel}`];
    if (showSection.summary) {
      const parts: string[] = [];
      if (summarySel.total_hours) parts.push(`総勤務 ${data.totalWorked.toFixed(2)}h`);
      if (summarySel.work_days) parts.push(`${data.workDays}日`);
      if (summarySel.overtime) parts.push(`残業 ${data.overtime.toFixed(2)}h`);
      if (summarySel.schedule_over) parts.push(`就業時間超過 ${data.scheduleOver.toFixed(2)}h`);
      if (parts.length) L.push("■ サマリ " + parts.join(" / "));
    }
    if (showSection.otbreak) {
      const parts: string[] = [];
      if (otSel.inner) parts.push(`法定内${hm(data.payMin.innerOtMin)}`);
      if (otSel.outer) parts.push(`法定外${hm(data.payMin.outerOtMin)}`);
      if (otSel.night) parts.push(`深夜${hm(data.payMin.nightMin)}`);
      if (parts.length) L.push("■ 残業内訳 " + parts.join(" / "));
    }
    if (showSection.weeks) {
      const ws = data.weeks.filter((w) => weekSel[w.start]);
      if (ws.length) {
        L.push("■ 週別");
        ws.forEach((w) => L.push(`  ${md(w.start)}〜${md(w.end)} ${w.hours.toFixed(2)}h${w.ot > 0 ? `（残業${w.ot.toFixed(2)}h）` : ""} ${w.days}日`));
      }
    }
    if (showSection.projects) {
      const ps = data.rows.filter((r, i) => projSel[`${i}_${r.company}_${r.project}`]);
      if (ps.length) {
        L.push("■ 案件別");
        ps.forEach((r) => L.push(`  ${r.company} / ${r.project} … ${r.worked.toFixed(2)}h（精算${r.min ?? "—"}〜${r.max ?? "—"}・${r.state}）`));
      }
    }
    if (showSection.days) {
      const anyDay = DAY_FIELDS.some((f) => daySel[f.key]);
      if (anyDay && data.days.length) {
        L.push("■ 日別内訳");
        data.days.forEach((d) => {
          const parts: string[] = [];
          if (daySel.date) parts.push(d.date);
          if (daySel.att && d.att) parts.push(`(${d.att})`);
          if (daySel.company && d.company) parts.push(d.company);
          if (daySel.project && d.project) parts.push(daySel.company && d.company ? "/" + d.project : d.project);
          if (daySel.time && d.start && d.end) parts.push(`${d.start}〜${d.end}${d.brk ? " 休" + d.brk : ""}`);
          if (daySel.hours) parts.push(`勤務${d.total.toFixed(2)}h`);
          if (daySel.sitebreak && d.office > 0) parts.push(`(現場${d.site.toFixed(2)}+帰社${d.office.toFixed(2)})`);
          if (daySel.office && d.officeStart && d.officeEnd) parts.push(`帰社${d.officeStart}〜${d.officeEnd}`);
          if (daySel.late_early && d.lateEarly > 0) parts.push(`遅早${d.lateEarly.toFixed(2)}h`);
          if (daySel.ot && d.ot > 0) parts.push(`残業${d.ot.toFixed(2)}h`);
          if (daySel.content && d.content) parts.push(`｜${d.content.replace(/\n/g, " ")}`);
          if (daySel.remarks && d.remarks) parts.push(`※${d.remarks.replace(/\n/g, " ")}`);
          if (parts.length) L.push("  " + parts.join(" "));
        });
      }
    }
    return L.join("\n");
  }, [showSection, summarySel, otSel, weekSel, projSel, daySel, data]);

  // ==================== テーブル/CSV ====================
  const buildTable = useMemo(() => (): { header: string; rows: string[][] } => {
    // 日別が主体：日別選択のフィールドで列を組む。無ければ簡易サマリ列。
    const cols: { key: string; label: string; get: (d: ShareData["days"][number]) => string }[] = [];
    if (daySel.date) cols.push({ key: "date", label: "日付", get: (d) => d.date });
    if (daySel.att) cols.push({ key: "att", label: "勤怠", get: (d) => d.att });
    if (daySel.company) cols.push({ key: "company", label: "会社", get: (d) => d.company });
    if (daySel.project) cols.push({ key: "project", label: "案件", get: (d) => d.project });
    if (daySel.time) cols.push({ key: "time", label: "出退勤", get: (d) => d.start && d.end ? `${d.start}〜${d.end}` : "" });
    if (daySel.time) cols.push({ key: "brk", label: "休憩", get: (d) => d.brk || "" });
    if (daySel.office) cols.push({ key: "office_time", label: "帰社", get: (d) => d.officeStart && d.officeEnd ? `${d.officeStart}〜${d.officeEnd}` : "" });
    if (daySel.hours) cols.push({ key: "hours", label: "勤務(h)", get: (d) => d.total.toFixed(2) });
    if (daySel.sitebreak) cols.push({ key: "site", label: "現場(h)", get: (d) => d.site.toFixed(2) });
    if (daySel.sitebreak) cols.push({ key: "office_h", label: "帰社(h)", get: (d) => d.office.toFixed(2) });
    if (daySel.late_early) cols.push({ key: "late", label: "遅早(h)", get: (d) => d.lateEarly > 0 ? d.lateEarly.toFixed(2) : "" });
    if (daySel.ot) cols.push({ key: "ot", label: "残業(h)", get: (d) => d.ot > 0 ? d.ot.toFixed(2) : "" });
    if (daySel.content) cols.push({ key: "content", label: "業務内容", get: (d) => d.content });
    if (daySel.remarks) cols.push({ key: "remarks", label: "備考", get: (d) => d.remarks });
    return {
      header: cols.map((c) => c.label).join(fmt === "csv" ? "," : "\t"),
      rows: data.days.map((d) => cols.map((c) => (c.get(d) || "").replace(/[\n,]/g, " "))),
    };
  }, [daySel, fmt, data.days]);

  function outputText(): string {
    if (fmt === "text") return buildText();
    const { header, rows } = buildTable();
    if (!header || !rows.length) return buildText(); // 日別未選択ならテキスト
    const sep = fmt === "csv" ? "," : "\t";
    const head = `【稼働レポート】${data.periodLabel}\n${header}`;
    return head + "\n" + rows.map((r) => r.join(sep)).join("\n");
  }

  async function doShare() {
    const text = outputText();
    try {
      if (navigator.share) await navigator.share({ title: "稼働レポート", text });
      else {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }
    } catch { /* cancel */ }
  }
  async function doCopy() {
    await navigator.clipboard.writeText(outputText());
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  // 個別サブ項目UIヘルパー
  const Chip = ({ on, onToggle, children }: { on: boolean; onToggle: () => void; children: React.ReactNode }) => (
    <button className="chip" data-active={on} style={on ? { background: "var(--accent)" } : undefined} onClick={onToggle}>{children}</button>
  );

  return (
    <>
      <button className="btn-ghost" onClick={() => setOpen(true)}>共有</button>
      {open ? (
        <div className="fixed inset-0 z-[60] flex items-end justify-center" style={{ background: "rgba(0,0,0,0.6)" }} onClick={() => setOpen(false)}>
          <div className="w-full max-w-xl rounded-t-2xl p-4 pb-8" style={{ background: "var(--surface)", maxHeight: "92vh", overflowY: "auto" }} onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-base font-bold">共有する項目を選択</h2>
              <button className="btn-ghost" onClick={() => setOpen(false)}>閉じる</button>
            </div>

            {/* 一括操作＆フォーマット */}
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <button className="btn-ghost" onClick={() => selectAll(true)}>全選択</button>
              <button className="btn-ghost" onClick={() => selectAll(false)}>全解除</button>
              <div className="ml-auto flex gap-1">
                <Chip on={fmt === "text"} onToggle={() => setFmt("text")}>テキスト</Chip>
                <Chip on={fmt === "table"} onToggle={() => setFmt("table")}>テーブル</Chip>
                <Chip on={fmt === "csv"} onToggle={() => setFmt("csv")}>CSV</Chip>
              </div>
            </div>

            {/* サマリ（各項目個別） */}
            <div className="card mb-2">
              <label className="mb-1 flex items-center justify-between">
                <span className="text-sm font-bold">サマリ</span>
                <input type="checkbox" className="h-5 w-5" checked={showSection.summary} onChange={(e) => setShowSection({ ...showSection, summary: e.target.checked })} />
              </label>
              {showSection.summary ? (
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {SUMMARY_FIELDS.map((f) => <Chip key={f.key} on={!!summarySel[f.key]} onToggle={() => setSummarySel({ ...summarySel, [f.key]: !summarySel[f.key] })}>{f.label}</Chip>)}
                </div>
              ) : null}
            </div>

            {/* 残業内訳 */}
            <div className="card mb-2">
              <label className="mb-1 flex items-center justify-between">
                <span className="text-sm font-bold">残業内訳</span>
                <input type="checkbox" className="h-5 w-5" checked={showSection.otbreak} onChange={(e) => setShowSection({ ...showSection, otbreak: e.target.checked })} />
              </label>
              {showSection.otbreak ? (
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {OT_FIELDS.map((f) => <Chip key={f.key} on={!!otSel[f.key]} onToggle={() => setOtSel({ ...otSel, [f.key]: !otSel[f.key] })}>{f.label}</Chip>)}
                </div>
              ) : null}
            </div>

            {/* 週別（各週個別） */}
            <div className="card mb-2">
              <label className="mb-1 flex items-center justify-between">
                <span className="text-sm font-bold">週別集計</span>
                <input type="checkbox" className="h-5 w-5" checked={showSection.weeks} onChange={(e) => setShowSection({ ...showSection, weeks: e.target.checked })} />
              </label>
              {showSection.weeks && data.weeks.length ? (
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {data.weeks.map((w) => <Chip key={w.start} on={!!weekSel[w.start]} onToggle={() => setWeekSel({ ...weekSel, [w.start]: !weekSel[w.start] })}>{md(w.start)}〜{md(w.end)}</Chip>)}
                </div>
              ) : null}
            </div>

            {/* 案件別（各案件個別） */}
            <div className="card mb-2">
              <label className="mb-1 flex items-center justify-between">
                <span className="text-sm font-bold">案件別 精算</span>
                <input type="checkbox" className="h-5 w-5" checked={showSection.projects} onChange={(e) => setShowSection({ ...showSection, projects: e.target.checked })} />
              </label>
              {showSection.projects && data.rows.length ? (
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {data.rows.map((r, i) => {
                    const k = `${i}_${r.company}_${r.project}`;
                    return <Chip key={k} on={!!projSel[k]} onToggle={() => setProjSel({ ...projSel, [k]: !projSel[k] })}>{r.company}／{r.project}</Chip>;
                  })}
                </div>
              ) : null}
            </div>

            {/* 日別内訳 */}
            <div className="card mb-2">
              <label className="mb-1 flex items-center justify-between">
                <span className="text-sm font-bold">日別内訳</span>
                <input type="checkbox" className="h-5 w-5" checked={showSection.days} onChange={(e) => setShowSection({ ...showSection, days: e.target.checked })} />
              </label>
              {showSection.days ? (
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {DAY_FIELDS.map((f) => <Chip key={f.key} on={!!daySel[f.key]} onToggle={() => setDaySel({ ...daySel, [f.key]: !daySel[f.key] })}>{f.label}</Chip>)}
                </div>
              ) : null}
            </div>

            {/* プレビュー */}
            <div className="mt-3">
              <div className="label">プレビュー（{fmt === "text" ? "テキスト" : fmt === "table" ? "テーブル(タブ区切り)" : "CSV"}）</div>
              <pre className="card overflow-x-auto whitespace-pre text-xs" style={{ lineHeight: 1.6 }}>{outputText()}</pre>
            </div>

            <div className="mt-3 flex gap-2">
              <button className="btn-primary" onClick={doShare}>共有する</button>
              <button className="btn-ghost" onClick={doCopy}>{copied ? "コピー済" : "コピー"}</button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
