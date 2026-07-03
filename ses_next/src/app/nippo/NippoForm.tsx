"use client";

import { useState, useTransition } from "react";
import {
  ATTENDANCE_OPTIONS,
  ATT_COLOR,
  WORK_TYPES,
  LATE_EARLY_TYPES,
  calcWorkHours,
} from "@/lib/constants";
import { createDaily } from "@/lib/actions";

function todayStr() {
  const d = new Date();
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 10);
}

export default function NippoForm({ companies }: { companies: string[] }) {
  const [date, setDate] = useState(todayStr());
  const [att, setAtt] = useState<string>("出社");
  const [company, setCompany] = useState("");
  const [project, setProject] = useState("");
  const [start, setStart] = useState("09:00");
  const [end, setEnd] = useState("18:00");
  const [brk, setBrk] = useState("01:00");
  const [lateEarly, setLateEarly] = useState("");
  const [isReturnDay, setIsReturnDay] = useState(false);
  const [returnStart, setReturnStart] = useState("18:00");
  const [returnEnd, setReturnEnd] = useState("20:00");
  const [content, setContent] = useState("");
  const [remarks, setRemarks] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const isWork = WORK_TYPES.has(att);
  const isLate = LATE_EARLY_TYPES.has(att);
  const siteH = isWork ? calcWorkHours(start, end, brk) : 0;
  const officeH = isReturnDay ? calcWorkHours(returnStart, returnEnd, "00:00") : 0;
  const dayTotal = siteH + officeH; // その日の勤務時間

  function submit() {
    setMsg(null);
    startTransition(async () => {
      const res = await createDaily({
        date,
        company,
        project_name: project,
        attendance_type: att,
        start_time: start,
        end_time: end,
        break_time: brk,
        late_early_time: lateEarly,
        return_office_hours: isReturnDay ? String(Math.round(officeH * 100) / 100) : "0",
        work_content: content,
        remarks,
      });
      setMsg({ ok: res.ok, text: res.message });
      if (res.ok) {
        setContent("");
        setRemarks("");
        setLateEarly("");
        setIsReturnDay(false);
      }
    });
  }

  return (
    <div className="card space-y-4">
      {/* 日付 */}
      <div>
        <label className="label">日付</label>
        <input
          type="date"
          className="field"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
      </div>

      {/* 勤怠区分チップ */}
      <div>
        <label className="label">勤怠区分</label>
        <div className="flex flex-wrap gap-2">
          {ATTENDANCE_OPTIONS.map((o) => {
            const active = att === o;
            const color = ATT_COLOR[o];
            return (
              <button
                key={o}
                type="button"
                className="chip"
                data-active={active}
                style={active ? { background: color } : undefined}
                onClick={() => setAtt(o)}
              >
                {o}
              </button>
            );
          })}
        </div>
      </div>

      {isWork ? (
        <>
          {/* 会社・案件 */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">会社名</label>
              <input
                className="field"
                list="company-list"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                placeholder="株式会社〇〇"
              />
              <datalist id="company-list">
                {companies.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </div>
            <div>
              <label className="label">案件名</label>
              <input
                className="field"
                value={project}
                onChange={(e) => setProject(e.target.value)}
                placeholder="〇〇開発"
              />
            </div>
          </div>

          {/* 時刻 */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="label">出社</label>
              <input type="time" className="field" value={start} onChange={(e) => setStart(e.target.value)} />
            </div>
            <div>
              <label className="label">退勤</label>
              <input type="time" className="field" value={end} onChange={(e) => setEnd(e.target.value)} />
            </div>
            <div>
              <label className="label">休憩</label>
              <input type="time" className="field" value={brk} onChange={(e) => setBrk(e.target.value)} />
            </div>
          </div>

          <div
            className="rounded-xl px-3 py-2 text-sm"
            style={{ background: "#0c1a2e", color: "#60a5fa" }}
          >
            現場稼働（自動）: <b>{siteH.toFixed(2)} h</b>
            {isReturnDay ? (
              <>
                {" ＋ 帰社 "}
                <b>{officeH.toFixed(2)} h</b>
                {" ＝ この日の勤務 "}
                <b>{dayTotal.toFixed(2)} h</b>
              </>
            ) : null}
          </div>

          {/* 帰社日 */}
          <div className="rounded-xl p-3" style={{ border: "1px solid var(--border)" }}>
            <label className="flex items-center justify-between">
              <span className="text-sm font-semibold">帰社日（自社に戻って勤務）</span>
              <input
                type="checkbox"
                className="h-5 w-5"
                checked={isReturnDay}
                onChange={(e) => setIsReturnDay(e.target.checked)}
              />
            </label>
            {isReturnDay ? (
              <div className="mt-3">
                <label className="label">帰社（自社での勤務時間）</label>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div className="mb-1 text-xs" style={{ color: "var(--subtle)" }}>開始</div>
                    <input type="time" className="field" value={returnStart} onChange={(e) => setReturnStart(e.target.value)} />
                  </div>
                  <div>
                    <div className="mb-1 text-xs" style={{ color: "var(--subtle)" }}>終了</div>
                    <input type="time" className="field" value={returnEnd} onChange={(e) => setReturnEnd(e.target.value)} />
                  </div>
                </div>
                <p className="mt-1 text-xs" style={{ color: "var(--subtle)" }}>
                  帰社 {officeH.toFixed(2)}h。現場は早退し退勤時刻は現場を出た時刻に。帰社分は現場の稼働に含めず、この日の勤務時間として加算します。
                </p>
              </div>
            ) : null}
          </div>

          {isLate ? (
            <div>
              <label className="label">
                {att}時間 (h)
              </label>
              <input
                type="number"
                inputMode="decimal"
                step="0.25"
                min="0"
                max="12"
                className="field"
                value={lateEarly}
                onChange={(e) => setLateEarly(e.target.value)}
                placeholder="例: 1.5"
              />
            </div>
          ) : null}

          <div>
            <label className="label">業務内容</label>
            <textarea
              className="field"
              rows={3}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="本日行った作業・対応内容"
            />
          </div>
        </>
      ) : (
        <p className="text-sm" style={{ color: "var(--subtle)" }}>
          「{att}」は時刻・業務内容の入力は不要です。必要なら備考のみどうぞ。
        </p>
      )}

      <div>
        <label className="label">備考</label>
        <textarea
          className="field"
          rows={2}
          value={remarks}
          onChange={(e) => setRemarks(e.target.value)}
          placeholder="特記事項・翌日の予定など"
        />
      </div>

      {msg ? (
        <div
          className="rounded-xl px-3 py-2 text-sm"
          style={
            msg.ok
              ? { background: "#052e16", color: "#4ade80" }
              : { background: "#2d0707", color: "#f87171" }
          }
        >
          {msg.text}
        </div>
      ) : null}

      <button className="btn-primary" disabled={pending} onClick={submit}>
        {pending ? "登録中…" : "日報を登録する"}
      </button>
    </div>
  );
}
