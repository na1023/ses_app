"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Project,
  PROJECT_STATUSES,
  STATUS_COLOR,
  effectiveStatus,
  scheduledHours,
} from "@/lib/constants";
import { saveProject, deleteProject } from "@/lib/projects-actions";

const EMPTY = {
  id: "",
  company: "",
  project_name: "",
  status: "参画中",
  start_date: "",
  end_date: "",
  min_hours: "",
  max_hours: "",
  standard_hours: "8",
  work_start: "",
  work_end: "",
  work_break: "01:00",
  memo: "",
};

export default function ProjectsClient({ projects }: { projects: Project[] }) {
  const router = useRouter();
  const [form, setForm] = useState<typeof EMPTY | null>(null);
  const [filter, setFilter] = useState<string[]>(["参画前", "参画中"]);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, start] = useTransition();

  const shown = projects.filter((p) =>
    filter.length ? filter.includes(effectiveStatus(p.status, p.end_date)) : true
  );

  function openNew() {
    setForm({ ...EMPTY });
    setMsg(null);
  }
  function openEdit(p: Project) {
    setForm({
      id: p.id,
      company: p.company,
      project_name: p.project_name,
      status: p.status || "参画中",
      start_date: p.start_date || "",
      end_date: p.end_date || "",
      min_hours: p.min_hours || "",
      max_hours: p.max_hours || "",
      standard_hours: p.standard_hours || "8",
      work_start: p.work_start || "",
      work_end: p.work_end || "",
      work_break: p.work_break || "01:00",
      memo: p.memo || "",
    });
    setMsg(null);
  }

  function submit() {
    if (!form) return;
    start(async () => {
      const res = await saveProject(form);
      setMsg({ ok: res.ok, text: res.message });
      if (res.ok) {
        setForm(null);
        router.refresh();
      }
    });
  }

  function remove(id: string) {
    if (!confirm("この案件を削除しますか？")) return;
    start(async () => {
      await deleteProject(id);
      router.refresh();
    });
  }

  return (
    <div className="px-4 pt-4">
      {/* フィルタ + 追加 */}
      <div className="mb-3 flex items-center gap-2">
        <div className="flex flex-1 flex-wrap gap-1.5">
          {PROJECT_STATUSES.map((s) => {
            const on = filter.includes(s);
            return (
              <button
                key={s}
                className="chip"
                data-active={on}
                style={on ? { background: STATUS_COLOR[s] } : undefined}
                onClick={() =>
                  setFilter((f) =>
                    f.includes(s) ? f.filter((x) => x !== s) : [...f, s]
                  )
                }
              >
                {s}
              </button>
            );
          })}
        </div>
        <button className="btn-ghost whitespace-nowrap" onClick={openNew}>
          ＋ 新規
        </button>
      </div>

      {/* 一覧 */}
      {shown.length === 0 ? (
        <p className="mt-6 text-center text-sm" style={{ color: "var(--subtle)" }}>
          該当する案件がありません。
        </p>
      ) : (
        <ul className="space-y-2">
          {shown.map((p) => {
            const est = effectiveStatus(p.status, p.end_date);
            const color = STATUS_COLOR[est] ?? "#64748b";
            const band =
              p.min_hours || p.max_hours
                ? `精算 ${p.min_hours || "—"}〜${p.max_hours || "—"}h`
                : "";
            return (
              <li key={p.id} className="card">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        className="badge"
                        style={{ background: color + "22", color }}
                      >
                        {est}
                      </span>
                      <span className="truncate font-bold">{p.company}</span>
                    </div>
                    <div className="mt-0.5 truncate text-sm" style={{ color: "var(--muted)" }}>
                      {p.project_name}
                    </div>
                    <div className="mt-1 text-xs" style={{ color: "var(--subtle)" }}>
                      {[
                        (p.start_date || p.end_date) &&
                          `${p.start_date || "—"}〜${p.end_date || "—"}`,
                        band,
                      ]
                        .filter(Boolean)
                        .join("  |  ")}
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <button className="btn-ghost" onClick={() => openEdit(p)}>
                      編集
                    </button>
                    <button
                      className="btn-ghost"
                      style={{ color: "var(--red)" }}
                      onClick={() => remove(p.id)}
                    >
                      削除
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {/* フォーム（モーダル風） */}
      {form ? (
        <div
          className="fixed inset-0 z-[60] flex items-end justify-center"
          style={{ background: "rgba(0,0,0,0.6)" }}
          onClick={() => setForm(null)}
        >
          <div
            className="w-full max-w-xl rounded-t-2xl p-4 pb-8"
            style={{ background: "var(--surface)", maxHeight: "92vh", overflowY: "auto" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-base font-bold">
                {form.id ? "案件を編集" : "新規案件"}
              </h2>
              <button className="btn-ghost" onClick={() => setForm(null)}>
                閉じる
              </button>
            </div>

            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">会社名 *</label>
                  <input
                    className="field"
                    value={form.company}
                    onChange={(e) => setForm({ ...form, company: e.target.value })}
                    placeholder="株式会社〇〇"
                  />
                </div>
                <div>
                  <label className="label">案件名 *</label>
                  <input
                    className="field"
                    value={form.project_name}
                    onChange={(e) => setForm({ ...form, project_name: e.target.value })}
                    placeholder="〇〇開発"
                  />
                </div>
              </div>

              <div>
                <label className="label">ステータス</label>
                <div className="flex gap-2">
                  {PROJECT_STATUSES.map((s) => (
                    <button
                      key={s}
                      className="chip"
                      data-active={form.status === s}
                      style={form.status === s ? { background: STATUS_COLOR[s] } : undefined}
                      onClick={() => setForm({ ...form, status: s })}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">開始日</label>
                  <input
                    type="date"
                    className="field"
                    value={form.start_date}
                    onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                  />
                </div>
                <div>
                  <label className="label">終了日</label>
                  {form.end_date === "現在" ? (
                    <div className="flex items-center gap-2">
                      <div className="field flex-1" style={{ color: "var(--green)" }}>
                        現在（継続中）
                      </div>
                      <button
                        className="btn-ghost"
                        onClick={() => setForm({ ...form, end_date: "" })}
                      >
                        日付
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <input
                        type="date"
                        className="field flex-1"
                        value={form.end_date}
                        onChange={(e) => setForm({ ...form, end_date: e.target.value })}
                      />
                      <button
                        className="btn-ghost whitespace-nowrap"
                        onClick={() => setForm({ ...form, end_date: "現在" })}
                      >
                        現在
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="label">精算幅（月間の下限・上限時間）</label>
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      inputMode="decimal"
                      className="field"
                      value={form.min_hours}
                      onChange={(e) => setForm({ ...form, min_hours: e.target.value })}
                      placeholder="下限 140"
                    />
                    <span className="text-sm" style={{ color: "var(--subtle)" }}>h</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      inputMode="decimal"
                      className="field"
                      value={form.max_hours}
                      onChange={(e) => setForm({ ...form, max_hours: e.target.value })}
                      placeholder="上限 180"
                    />
                    <span className="text-sm" style={{ color: "var(--subtle)" }}>h</span>
                  </div>
                </div>
                <p className="mt-1 text-xs" style={{ color: "var(--subtle)" }}>
                  現場ごとの精算基準。空欄なら精算判定なし。
                </p>
              </div>

              <div>
                <label className="label">就業時間（現場の定時）</label>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <div className="mb-1 text-xs" style={{ color: "var(--subtle)" }}>開始</div>
                    <input
                      type="time"
                      className="field"
                      value={form.work_start}
                      onChange={(e) => setForm({ ...form, work_start: e.target.value })}
                    />
                  </div>
                  <div>
                    <div className="mb-1 text-xs" style={{ color: "var(--subtle)" }}>終了</div>
                    <input
                      type="time"
                      className="field"
                      value={form.work_end}
                      onChange={(e) => setForm({ ...form, work_end: e.target.value })}
                    />
                  </div>
                  <div>
                    <div className="mb-1 text-xs" style={{ color: "var(--subtle)" }}>休憩</div>
                    <input
                      type="time"
                      className="field"
                      value={form.work_break}
                      onChange={(e) => setForm({ ...form, work_break: e.target.value })}
                    />
                  </div>
                </div>
                <p className="mt-1 text-xs" style={{ color: "var(--subtle)" }}>
                  {(() => {
                    const s = scheduledHours(form);
                    return s !== null
                      ? `定時 ${s.toFixed(2)}h／日。残業は8h超、就業時間超過はこの定時超で算出します。`
                      : "例 8:50〜17:10・休憩1:00。設定すると就業時間超過を算出します。";
                  })()}
                </p>
              </div>

              <div>
                <label className="label">メモ</label>
                <textarea
                  className="field"
                  rows={2}
                  value={form.memo}
                  onChange={(e) => setForm({ ...form, memo: e.target.value })}
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

              <button className="btn-primary" disabled={busy} onClick={submit}>
                {busy ? "保存中…" : form.id ? "更新する" : "登録する"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
