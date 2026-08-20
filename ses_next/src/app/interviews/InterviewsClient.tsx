"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Interview, saveInterview, deleteInterview } from "@/lib/domain-actions";

const IV_STATUS = ["結果待ち", "通過", "不通過", "辞退", "不明"];
const IV_COLOR: Record<string, string> = {
  結果待ち: "#f59e0b", 通過: "#10b981", 不通過: "#ef4444", 辞退: "#64748b", 不明: "#64748b",
};

export default function InterviewsClient({ interviews }: { interviews: Interview[] }) {
  const router = useRouter();
  const [busy, start] = useTransition();
  const [form, setForm] = useState<Partial<Interview> | null>(null);

  function save() {
    if (!form) return;
    start(async () => {
      const res = await saveInterview(form);
      if (res.ok) { setForm(null); router.refresh(); }
      else alert(res.message);
    });
  }

  return (
    <div className="px-4 pt-4">
      <button className="btn-ghost mb-3" onClick={() => setForm({ status: "結果待ち" })}>＋ 面談を追加</button>
      <ul className="space-y-2">
        {interviews.map((r) => (
          <li key={r.id} className="card">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="badge" style={{ background: (IV_COLOR[r.status] ?? "#64748b") + "22", color: IV_COLOR[r.status] ?? "#64748b" }}>{r.status || "—"}</span>
                  <span className="truncate font-bold">{r.company}</span>
                </div>
                <div className="truncate text-sm" style={{ color: "var(--muted)" }}>{r.project_name}</div>
                <div className="text-xs" style={{ color: "var(--subtle)" }}>{r.interview_date}</div>
                {r.work_content ? <div className="mt-1 text-xs" style={{ color: "var(--subtle)" }}>{r.work_content.slice(0, 60)}</div> : null}
              </div>
              <div className="flex shrink-0 gap-1">
                <button className="btn-ghost" onClick={() => setForm(r)}>編集</button>
                <button className="btn-ghost" style={{ color: "var(--red)" }} onClick={() => start(async () => { await deleteInterview(r.id); router.refresh(); })}>削除</button>
              </div>
            </div>
          </li>
        ))}
        {interviews.length === 0 ? <p className="text-sm" style={{ color: "var(--subtle)" }}>面談がありません。</p> : null}
      </ul>

      {form ? (
        <div className="fixed inset-0 z-[60] flex items-end justify-center" style={{ background: "rgba(0,0,0,0.6)" }} onClick={() => setForm(null)}>
          <div className="w-full max-w-xl rounded-t-2xl p-4 pb-8" style={{ background: "var(--surface)", maxHeight: "92vh", overflowY: "auto" }} onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-base font-bold">{form.id ? "面談を編集" : "面談を追加"}</h2>
              <button className="btn-ghost" onClick={() => setForm(null)}>閉じる</button>
            </div>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label">会社名 *</label><input className="field" value={form.company ?? ""} onChange={(e) => setForm({ ...form, company: e.target.value })} /></div>
                <div><label className="label">案件名</label><input className="field" value={form.project_name ?? ""} onChange={(e) => setForm({ ...form, project_name: e.target.value })} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label">面談日</label><input type="date" className="field" value={form.interview_date ?? ""} onChange={(e) => setForm({ ...form, interview_date: e.target.value })} /></div>
                <div>
                  <label className="label">ステータス</label>
                  <select className="field" value={form.status ?? "結果待ち"} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                    {IV_STATUS.map((s) => <option key={s}>{s}</option>)}
                  </select>
                </div>
              </div>
              <div><label className="label">業務内容</label><textarea className="field" rows={2} value={form.work_content ?? ""} onChange={(e) => setForm({ ...form, work_content: e.target.value })} /></div>
              <div><label className="label">メモ</label><input className="field" value={form.memo ?? ""} onChange={(e) => setForm({ ...form, memo: e.target.value })} /></div>
              <button className="btn-primary" disabled={busy} onClick={save}>{busy ? "保存中…" : "保存する"}</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
