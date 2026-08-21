"use client";

import { useState } from "react";

export type ShareData = {
  periodLabel: string;
  totalWorked: number;
  workDays: number;
  overtime: number;
  scheduleOver: number;
  hourly: number;
  pay: { inner: number; outer: number; night: number; total: number };
  weeks: { start: string; end: string; hours: number; ot: number; days: number }[];
  rows: { company: string; project: string; worked: number; min: number | null; max: number | null; state: string }[];
  days: { date: string; company: string; project: string; att: string; site: number; office: number; total: number; ot: number }[];
};

const ITEMS: { key: string; label: string }[] = [
  { key: "summary", label: "総勤務時間・勤務日数" },
  { key: "overtime", label: "残業・就業時間超過" },
  { key: "pay", label: "残業代（時給・内訳）" },
  { key: "weeks", label: "週別集計" },
  { key: "projects", label: "案件別 精算状況" },
  { key: "days", label: "日別内訳" },
];

// 日別内訳のサブ項目（個別ON/OFF可能）
const DAY_FIELDS: { key: string; label: string }[] = [
  { key: "date", label: "日付" },
  { key: "att", label: "勤怠区分" },
  { key: "company", label: "会社名" },
  { key: "project", label: "案件名" },
  { key: "total", label: "勤務時間" },
  { key: "sitebreak", label: "現場/帰社の内訳" },
  { key: "ot", label: "残業時間" },
];

const yen = (n: number) => "¥" + Math.round(n).toLocaleString();
const md = (s: string) => { const [, m, d] = s.split("-"); return `${Number(m)}/${Number(d)}`; };

export default function ShareButton({ data }: { data: ShareData }) {
  const [open, setOpen] = useState(false);
  const [sel, setSel] = useState<Record<string, boolean>>({
    summary: true, overtime: true, pay: true, weeks: false, projects: true, days: false,
  });
  // 日別内訳のサブ項目 選択状態（既定は全部ON）
  const [dayFields, setDayFields] = useState<Record<string, boolean>>({
    date: true, att: true, company: true, project: true, total: true, sitebreak: true, ot: true,
  });
  const [copied, setCopied] = useState(false);

  function buildText(): string {
    const L: string[] = [`【稼働レポート】${data.periodLabel}`];
    if (sel.summary) L.push(`■ 総勤務 ${data.totalWorked.toFixed(2)}h / ${data.workDays}日`);
    if (sel.overtime) L.push(`■ 残業(8h超) ${data.overtime.toFixed(2)}h ／ 就業時間超過 ${data.scheduleOver.toFixed(2)}h`);
    if (sel.pay && data.hourly > 0)
      L.push(`■ 残業代 ${yen(data.pay.total)}（法定内${yen(data.pay.inner)} / 法定外${yen(data.pay.outer)} / 深夜${yen(data.pay.night)}）時給${yen(data.hourly)}/h`);
    if (sel.weeks && data.weeks.length) {
      L.push("■ 週別");
      data.weeks.forEach((w) => L.push(`  ${md(w.start)}〜${md(w.end)} ${w.hours.toFixed(2)}h${w.ot > 0 ? `（残業${w.ot.toFixed(2)}h）` : ""} ${w.days}日`));
    }
    if (sel.projects && data.rows.length) {
      L.push("■ 案件別");
      data.rows.forEach((r) =>
        L.push(`  ${r.company} / ${r.project} … ${r.worked.toFixed(2)}h（精算${r.min ?? "—"}〜${r.max ?? "—"}・${r.state}）`)
      );
    }
    if (sel.days && data.days.length) {
      // サブ項目が1つでもONの時のみ出力
      const anyField = DAY_FIELDS.some((f) => dayFields[f.key]);
      if (anyField) {
        L.push("■ 日別内訳");
        data.days.forEach((d) => {
          const parts: string[] = [];
          if (dayFields.date) parts.push(d.date);
          if (dayFields.att && d.att) parts.push(`(${d.att})`);
          if (dayFields.company && d.company) parts.push(d.company);
          if (dayFields.project && d.project) parts.push(dayFields.company && d.company ? "/" + d.project : d.project);
          if (dayFields.total) parts.push(`勤務${d.total.toFixed(2)}h`);
          if (dayFields.sitebreak && d.office > 0) parts.push(`(現場${d.site.toFixed(2)}+帰社${d.office.toFixed(2)})`);
          if (dayFields.ot && d.ot > 0) parts.push(`残業${d.ot.toFixed(2)}h`);
          if (parts.length > 0) L.push("  " + parts.join(" "));
        });
      }
    }
    return L.join("\n");
  }

  async function doShare() {
    const text = buildText();
    try {
      if (navigator.share) {
        await navigator.share({ title: "稼働レポート", text });
      } else {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }
    } catch {
      /* キャンセル等は無視 */
    }
  }
  async function doCopy() {
    await navigator.clipboard.writeText(buildText());
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

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
            <div className="space-y-2">
              {ITEMS.map((it) => (
                <div key={it.key}>
                  <label className="card flex items-center justify-between py-2.5">
                    <span className="text-sm">{it.label}</span>
                    <input type="checkbox" className="h-5 w-5" checked={!!sel[it.key]} onChange={(e) => setSel({ ...sel, [it.key]: e.target.checked })} />
                  </label>
                  {/* 日別内訳を選択したときだけ、サブ項目のON/OFFを表示 */}
                  {it.key === "days" && sel.days ? (
                    <div className="mt-1 rounded-xl p-2" style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}>
                      <div className="mb-1 text-xs" style={{ color: "var(--subtle)" }}>日別で共有する項目</div>
                      <div className="flex flex-wrap gap-2">
                        {DAY_FIELDS.map((f) => {
                          const on = !!dayFields[f.key];
                          return (
                            <button
                              key={f.key}
                              type="button"
                              className="chip"
                              data-active={on}
                              style={on ? { background: "var(--accent)" } : undefined}
                              onClick={() => setDayFields({ ...dayFields, [f.key]: !on })}
                            >
                              {f.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>

            <div className="mt-3">
              <div className="label">プレビュー</div>
              <pre className="card whitespace-pre-wrap text-xs" style={{ lineHeight: 1.6 }}>{buildText()}</pre>
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
