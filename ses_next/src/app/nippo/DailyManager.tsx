"use client";

import { useMemo, useState, useTransition } from "react";
import {
  ATTENDANCE_OPTIONS,
  ATT_COLOR,
  LATE_EARLY_TYPES,
  countsAsWork,
  hhmmToMin,
  Project,
  DailyReport,
  WorkSession,
  calcWorkHours,
  sessionsHours,
  parseSessions,
  hoursLabel,
} from "@/lib/constants";
import { createDaily, updateDaily, deleteDaily, DailyInput } from "@/lib/actions";
import TimeInput from "@/components/TimeInput";
import Calendar from "@/components/Calendar";

function todayStr() {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

// 指定日に参画期間内か（開始<=日付<=終了）。終了案件でも、その日が参画期間内なら表示する。
function activeOn(p: Project, date: string): boolean {
  const s = (p.start_date || "").trim();
  const e = (p.end_date || "").trim();
  if (s && date < s) return false;
  if (e && e !== "現在" && e !== "継続中" && e !== "継続" && date > e) return false;
  return true;
}

type FormState = {
  id?: string;
  date: string;
  att: string;
  company: string;
  project: string;
  sessions: WorkSession[];
  breakTime: string;
  lateEarly: string;
  isReturn: boolean;
  returnStart: string;
  returnEnd: string;
  content: string;
  remarks: string;
};

function emptyForm(): FormState {
  return {
    date: todayStr(),
    att: "出社",
    company: "",
    project: "",
    sessions: [{ start: "09:00", end: "18:00" }],
    breakTime: "01:00",
    lateEarly: "",
    isReturn: false,
    returnStart: "18:00",
    returnEnd: "20:00",
    content: "",
    remarks: "",
  };
}

function fromReport(r: DailyReport): FormState {
  const sess = parseSessions(r.work_sessions);
  return {
    id: r.id,
    date: r.date,
    att: r.attendance_type || "出社",
    company: r.company || "",
    project: r.project_name || "",
    sessions: sess.length ? sess : r.start_time && r.end_time ? [{ start: r.start_time, end: r.end_time }] : [{ start: "09:00", end: "18:00" }],
    breakTime: r.break_time || "00:00",
    lateEarly: r.late_early_time && r.late_early_time !== "0" ? r.late_early_time : "",
    isReturn: !!r.return_office_hours && r.return_office_hours !== "0",
    returnStart: "18:00",
    returnEnd: "20:00",
    content: r.work_content || "",
    remarks: r.remarks || "",
  };
}

export default function DailyManager({
  projects,
  reports,
  holidays,
}: {
  projects: Project[];
  reports: DailyReport[];
  holidays: Record<string, string>;
}) {
  const [list, setList] = useState<DailyReport[]>(reports);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [edit, setEdit] = useState<FormState | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, start] = useTransition();

  const existingDates = useMemo(() => new Set(list.map((r) => r.date)), [list]);
  const reportedMap = useMemo(() => {
    const m: Record<string, string> = {};
    list.forEach((r) => { m[r.date] = r.attendance_type; });
    return m;
  }, [list]);

  const sortByDate = (a: DailyReport[]) => [...a].sort((x, y) => (x.date < y.date ? 1 : -1));

  function toInput(f: FormState): DailyInput {
    const officeH = f.isReturn ? calcWorkHours(f.returnStart, f.returnEnd, "00:00") : 0;
    return {
      id: f.id,
      date: f.date,
      company: f.company,
      project_name: f.project,
      attendance_type: f.att,
      sessions: f.sessions,
      break_time: f.breakTime,
      late_early_time: LATE_EARLY_TYPES.has(f.att) ? f.lateEarly : "0",
      return_office_hours: f.isReturn ? String(Math.round(officeH * 100) / 100) : "0",
      work_content: f.content,
      remarks: f.remarks,
    };
  }

  function submitCreate() {
    setMsg(null);
    start(async () => {
      const res = await createDaily(toInput(form));
      setMsg({ ok: res.ok, text: res.message });
      if (res.ok && res.row) {
        setList((prev) => sortByDate([res.row!, ...prev.filter((r) => r.id !== res.row!.id)]));
        setForm({ ...emptyForm(), date: form.date });
      }
    });
  }
  function submitEdit() {
    if (!edit?.id) return;
    start(async () => {
      const res = await updateDaily(edit.id!, toInput(edit));
      if (res.ok && res.row) {
        setList((prev) => sortByDate(prev.map((r) => (r.id === res.row!.id ? res.row! : r))));
        setEdit(null);
      } else alert(res.message);
    });
  }
  function remove(id: string) {
    if (!confirm("この日報を削除しますか？")) return;
    setList((prev) => prev.filter((r) => r.id !== id)); // 楽観的に即時反映
    start(async () => {
      await deleteDaily(id);
    });
  }

  return (
    <>
      <Calendar
        reported={reportedMap}
        holidays={holidays}
        onPick={(d) => setForm((p) => ({ ...p, date: d }))}
      />
      <Fields
        f={form}
        setF={setForm}
        projects={projects}
        dupWarn={existingDates.has(form.date)}
      />
      {msg ? (
        <div className="mt-3 rounded-xl px-3 py-2 text-sm" style={msg.ok ? { background: "#052e16", color: "#4ade80" } : { background: "#2d0707", color: "#f87171" }}>
          {msg.text}
        </div>
      ) : null}
      <button className="btn-primary mt-3" disabled={busy} onClick={submitCreate}>
        {busy ? "登録中…" : "日報を登録する"}
      </button>

      {/* 直近の日報 */}
      <section className="mt-7">
        <h2 className="mb-2 text-sm font-bold" style={{ color: "var(--muted)" }}>直近の日報</h2>
        {list.length === 0 ? (
          <p className="text-sm" style={{ color: "var(--subtle)" }}>まだ登録がありません。</p>
        ) : (
          <ul className="space-y-2">
            {list.map((r) => {
              const wh = Number(r.work_hours) || 0;
              const color = ATT_COLOR[r.attendance_type] ?? "#94a3b8";
              return (
                <li key={r.id} className="card">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold">{r.date}</span>
                        <span className="badge" style={{ background: color + "22", color }}>{r.attendance_type}</span>
                      </div>
                      <div className="mt-0.5 text-xs" style={{ color: "var(--subtle)" }}>
                        {[r.company && `${r.company}${r.project_name ? " / " + r.project_name : ""}`, wh > 0 && `実働 ${hoursLabel(wh)}h`].filter(Boolean).join("  |  ")}
                      </div>
                      {r.work_content ? <div className="mt-1 text-xs" style={{ color: "var(--muted)" }}>{r.work_content.slice(0, 60)}</div> : null}
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <button className="btn-ghost" onClick={() => setEdit(fromReport(r))}>編集</button>
                      <button className="btn-ghost" style={{ color: "var(--red)" }} onClick={() => remove(r.id)}>削除</button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* 編集モーダル */}
      {edit ? (
        <div className="fixed inset-0 z-[60] flex items-end justify-center" style={{ background: "rgba(0,0,0,0.6)" }} onClick={() => setEdit(null)}>
          <div className="w-full max-w-xl rounded-t-2xl p-4 pb-8" style={{ background: "var(--surface)", maxHeight: "92vh", overflowY: "auto" }} onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-base font-bold">日報を編集</h2>
              <button className="btn-ghost" onClick={() => setEdit(null)}>閉じる</button>
            </div>
            <Fields f={edit} setF={(v) => setEdit(typeof v === "function" ? v(edit) : v)} projects={projects} dupWarn={false} />
            <button className="btn-primary mt-3" disabled={busy} onClick={submitEdit}>{busy ? "更新中…" : "更新する"}</button>
          </div>
        </div>
      ) : null}
    </>
  );
}

// ============================================================
// フィールド群（作成・編集で共通）
// ============================================================
function Fields({
  f,
  setF,
  projects,
  dupWarn,
}: {
  f: FormState;
  setF: (v: FormState | ((p: FormState) => FormState)) => void;
  projects: Project[];
  dupWarn: boolean;
}) {
  const needsTime = countsAsWork(f.att);
  const isLate = LATE_EARLY_TYPES.has(f.att);
  const set = (patch: Partial<FormState>) => setF((p) => ({ ...p, ...patch }));

  const active = projects.filter((p) => activeOn(p, f.date));
  const companies = Array.from(new Set(active.map((p) => p.company))).sort();
  const projOptions = active.filter((p) => p.company === f.company).map((p) => p.project_name);

  const breakH = (hhmmToMin(f.breakTime || "") ?? 0) / 60;
  const siteH = needsTime
    ? Math.max(0, sessionsHours(f.sessions.filter((s) => s.start && s.end)) - breakH)
    : 0;
  const officeH = f.isReturn ? calcWorkHours(f.returnStart, f.returnEnd, "00:00") : 0;

  return (
    <div className="card space-y-4">
      {/* 日付 */}
      <div>
        <label className="label">日付</label>
        <input type="date" className="field" value={f.date} onChange={(e) => set({ date: e.target.value })} />
        {dupWarn ? (
          <p className="mt-1 text-xs" style={{ color: "#f59e0b" }}>⚠ この日付の日報は既に登録されています。</p>
        ) : null}
      </div>

      {/* 勤怠区分 */}
      <div>
        <label className="label">勤怠区分</label>
        <div className="flex flex-wrap gap-2">
          {ATTENDANCE_OPTIONS.map((o) => (
            <button key={o} type="button" className="chip" data-active={f.att === o}
              style={f.att === o ? { background: ATT_COLOR[o] } : undefined}
              onClick={() => set({ att: o })}>{o}</button>
          ))}
        </div>
      </div>

      {needsTime ? (
        <>
          {/* 会社・案件（指定日に参画中の案件から） */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">会社名</label>
              <select className="field" value={f.company} onChange={(e) => set({ company: e.target.value, project: "" })}>
                <option value="">選択</option>
                {companies.map((c) => <option key={c} value={c}>{c}</option>)}
                {f.company && !companies.includes(f.company) ? <option value={f.company}>{f.company}</option> : null}
              </select>
            </div>
            <div>
              <label className="label">案件名</label>
              <select className="field" value={f.project} onChange={(e) => set({ project: e.target.value })}>
                <option value="">選択</option>
                {projOptions.map((p) => <option key={p} value={p}>{p}</option>)}
                {f.project && !projOptions.includes(f.project) ? <option value={f.project}>{f.project}</option> : null}
              </select>
            </div>
          </div>
          {companies.length === 0 ? (
            <p className="text-xs" style={{ color: "var(--subtle)" }}>この日に参画中の案件がありません。「案件」タブで参画期間を確認してください。</p>
          ) : null}

          {/* 勤務時間（複数可） */}
          <div>
            <label className="label">勤務時間（出勤・退勤／間を空けて複数可）</label>
            <div className="space-y-2">
              {f.sessions.map((s, i) => (
                <div key={i} className="flex items-center gap-2">
                  <TimeInput value={s.start} onChange={(v) => set({ sessions: f.sessions.map((x, j) => (j === i ? { ...x, start: v } : x)) })} placeholder="09:00" />
                  <span style={{ color: "var(--subtle)" }}>〜</span>
                  <TimeInput value={s.end} onChange={(v) => set({ sessions: f.sessions.map((x, j) => (j === i ? { ...x, end: v } : x)) })} placeholder="18:00" />
                  {f.sessions.length > 1 ? (
                    <button className="btn-ghost" style={{ minHeight: "auto", padding: "0.4rem 0.6rem" }} onClick={() => set({ sessions: f.sessions.filter((_, j) => j !== i) })}>×</button>
                  ) : null}
                </div>
              ))}
              <button className="btn-ghost" onClick={() => set({ sessions: [...f.sessions, { start: "", end: "" }] })}>＋ 時間帯を追加</button>
            </div>
          </div>

          {/* 休憩 */}
          <div>
            <label className="label">休憩時間</label>
            <div className="flex items-center gap-2">
              <div style={{ maxWidth: 140 }}>
                <TimeInput value={f.breakTime} onChange={(v) => set({ breakTime: v })} placeholder="01:00" />
              </div>
              <span className="text-xs" style={{ color: "var(--subtle)" }}>実働から差し引きます（休憩なしは 00:00）</span>
            </div>
          </div>

          <div className="rounded-xl px-3 py-2 text-sm" style={{ background: "#0c1a2e", color: "#60a5fa" }}>
            実働（自動）: <b>{hoursLabel(siteH)}h</b>
            {f.isReturn ? <> ＋ 帰社 <b>{officeH.toFixed(2)}h</b> ＝ <b>{hoursLabel(siteH + officeH)}h</b></> : null}
          </div>

          {/* 帰社日 */}
          <div className="rounded-xl p-3" style={{ border: "1px solid var(--border)" }}>
            <label className="flex items-center justify-between">
              <span className="text-sm font-semibold">帰社日（自社に戻って勤務）</span>
              <input type="checkbox" className="h-5 w-5" checked={f.isReturn} onChange={(e) => set({ isReturn: e.target.checked })} />
            </label>
            {f.isReturn ? (
              <div className="mt-3 grid grid-cols-2 gap-3">
                <div><div className="mb-1 text-xs" style={{ color: "var(--subtle)" }}>帰社 開始</div><TimeInput value={f.returnStart} onChange={(v) => set({ returnStart: v })} placeholder="18:00" /></div>
                <div><div className="mb-1 text-xs" style={{ color: "var(--subtle)" }}>帰社 終了</div><TimeInput value={f.returnEnd} onChange={(v) => set({ returnEnd: v })} placeholder="20:00" /></div>
              </div>
            ) : null}
          </div>

          {isLate ? (
            <div>
              <label className="label">{f.att}時間 (h)</label>
              <input type="number" inputMode="decimal" step="0.25" min="0" className="field" value={f.lateEarly} onChange={(e) => set({ lateEarly: e.target.value })} placeholder="例: 1.5" />
            </div>
          ) : null}

          <div>
            <label className="label">業務内容</label>
            <textarea className="field" rows={3} value={f.content} onChange={(e) => set({ content: e.target.value })} placeholder="本日行った作業・対応内容" />
          </div>
        </>
      ) : (
        <p className="text-sm" style={{ color: "var(--subtle)" }}>「{f.att}」は時刻・業務内容の入力は不要です。必要なら備考のみどうぞ。</p>
      )}

      <div>
        <label className="label">備考</label>
        <textarea className="field" rows={2} value={f.remarks} onChange={(e) => set({ remarks: e.target.value })} placeholder="特記事項など" />
      </div>
    </div>
  );
}
