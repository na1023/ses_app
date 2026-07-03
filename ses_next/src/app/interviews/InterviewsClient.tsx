"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Interview,
  Todo,
  saveInterview,
  deleteInterview,
  saveTodo,
  deleteTodo,
  setTodoProgress,
} from "@/lib/domain-actions";

const IV_STATUS = ["結果待ち", "通過", "不通過", "辞退", "不明"];
const IV_COLOR: Record<string, string> = {
  結果待ち: "#f59e0b", 通過: "#10b981", 不通過: "#ef4444", 辞退: "#64748b", 不明: "#64748b",
};
const PROG = ["未着手", "進行中", "完了"];
const PROG_COLOR: Record<string, string> = { 未着手: "#64748b", 進行中: "#3b82f6", 完了: "#10b981" };

export default function InterviewsClient({
  interviews,
  todos,
}: {
  interviews: Interview[];
  todos: Todo[];
}) {
  const router = useRouter();
  const [tab, setTab] = useState<"iv" | "td">("iv");
  const [busy, start] = useTransition();

  // 面談フォーム
  const [ivForm, setIvForm] = useState<Partial<Interview> | null>(null);
  // ToDoフォーム
  const [tdForm, setTdForm] = useState<Partial<Todo> | null>(null);

  function saveIv() {
    if (!ivForm) return;
    start(async () => {
      const res = await saveInterview(ivForm);
      if (res.ok) { setIvForm(null); router.refresh(); }
      else alert(res.message);
    });
  }
  function saveTd() {
    if (!tdForm) return;
    start(async () => {
      const res = await saveTodo(tdForm);
      if (res.ok) { setTdForm(null); router.refresh(); }
      else alert(res.message);
    });
  }

  return (
    <div className="px-4 pt-4">
      <div className="seg mb-4">
        <button data-active={tab === "iv"} onClick={() => setTab("iv")}>面談</button>
        <button data-active={tab === "td"} onClick={() => setTab("td")}>ToDo</button>
      </div>

      {/* ===== 面談 ===== */}
      {tab === "iv" ? (
        <>
          <button className="btn-ghost mb-3" onClick={() => setIvForm({ status: "結果待ち" })}>＋ 面談を追加</button>
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
                    <button className="btn-ghost" onClick={() => setIvForm(r)}>編集</button>
                    <button className="btn-ghost" style={{ color: "var(--red)" }} onClick={() => start(async () => { await deleteInterview(r.id); router.refresh(); })}>削除</button>
                  </div>
                </div>
              </li>
            ))}
            {interviews.length === 0 ? <p className="text-sm" style={{ color: "var(--subtle)" }}>面談がありません。</p> : null}
          </ul>
        </>
      ) : null}

      {/* ===== ToDo ===== */}
      {tab === "td" ? (
        <>
          <button className="btn-ghost mb-3" onClick={() => setTdForm({ progress: "未着手" })}>＋ ToDoを追加</button>
          <ul className="space-y-2">
            {todos.map((r) => (
              <li key={r.id} className="card">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-bold">{r.task}</div>
                    <div className="text-xs" style={{ color: "var(--subtle)" }}>
                      {[r.company, r.project_name, r.due_date && `期限 ${r.due_date}`].filter(Boolean).join(" / ")}
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <button
                      className="badge"
                      style={{ background: (PROG_COLOR[r.progress] ?? "#64748b") + "22", color: PROG_COLOR[r.progress] ?? "#64748b" }}
                      onClick={() => start(async () => {
                        const next = PROG[(PROG.indexOf(r.progress) + 1) % PROG.length];
                        await setTodoProgress(r.id, next); router.refresh();
                      })}
                    >{r.progress || "未着手"} ↻</button>
                    <div className="flex gap-1">
                      <button className="btn-ghost" onClick={() => setTdForm(r)}>編集</button>
                      <button className="btn-ghost" style={{ color: "var(--red)" }} onClick={() => start(async () => { await deleteTodo(r.id); router.refresh(); })}>削除</button>
                    </div>
                  </div>
                </div>
              </li>
            ))}
            {todos.length === 0 ? <p className="text-sm" style={{ color: "var(--subtle)" }}>ToDoがありません。</p> : null}
          </ul>
        </>
      ) : null}

      {/* ===== 面談フォーム（モーダル） ===== */}
      {ivForm ? (
        <Modal title={ivForm.id ? "面談を編集" : "面談を追加"} onClose={() => setIvForm(null)} onSave={saveIv} busy={busy}>
          <Grid2>
            <Field label="会社名 *"><input className="field" value={ivForm.company ?? ""} onChange={(e) => setIvForm({ ...ivForm, company: e.target.value })} /></Field>
            <Field label="案件名"><input className="field" value={ivForm.project_name ?? ""} onChange={(e) => setIvForm({ ...ivForm, project_name: e.target.value })} /></Field>
          </Grid2>
          <Grid2>
            <Field label="面談日"><input type="date" className="field" value={ivForm.interview_date ?? ""} onChange={(e) => setIvForm({ ...ivForm, interview_date: e.target.value })} /></Field>
            <Field label="ステータス">
              <select className="field" value={ivForm.status ?? "結果待ち"} onChange={(e) => setIvForm({ ...ivForm, status: e.target.value })}>
                {IV_STATUS.map((s) => <option key={s}>{s}</option>)}
              </select>
            </Field>
          </Grid2>
          <Field label="業務内容"><textarea className="field" rows={2} value={ivForm.work_content ?? ""} onChange={(e) => setIvForm({ ...ivForm, work_content: e.target.value })} /></Field>
          <Field label="メモ"><input className="field" value={ivForm.memo ?? ""} onChange={(e) => setIvForm({ ...ivForm, memo: e.target.value })} /></Field>
        </Modal>
      ) : null}

      {/* ===== ToDoフォーム（モーダル） ===== */}
      {tdForm ? (
        <Modal title={tdForm.id ? "ToDoを編集" : "ToDoを追加"} onClose={() => setTdForm(null)} onSave={saveTd} busy={busy}>
          <Field label="タスク内容 *"><input className="field" value={tdForm.task ?? ""} onChange={(e) => setTdForm({ ...tdForm, task: e.target.value })} /></Field>
          <Grid2>
            <Field label="会社名"><input className="field" value={tdForm.company ?? ""} onChange={(e) => setTdForm({ ...tdForm, company: e.target.value })} /></Field>
            <Field label="案件名"><input className="field" value={tdForm.project_name ?? ""} onChange={(e) => setTdForm({ ...tdForm, project_name: e.target.value })} /></Field>
          </Grid2>
          <Grid2>
            <Field label="期限"><input type="date" className="field" value={tdForm.due_date ?? ""} onChange={(e) => setTdForm({ ...tdForm, due_date: e.target.value })} /></Field>
            <Field label="進捗">
              <select className="field" value={tdForm.progress ?? "未着手"} onChange={(e) => setTdForm({ ...tdForm, progress: e.target.value })}>
                {PROG.map((s) => <option key={s}>{s}</option>)}
              </select>
            </Field>
          </Grid2>
        </Modal>
      ) : null}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label className="label">{label}</label>{children}</div>;
}
function Grid2({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-3">{children}</div>;
}
function Modal({ title, onClose, onSave, busy, children }: {
  title: string; onClose: () => void; onSave: () => void; busy: boolean; children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center" style={{ background: "rgba(0,0,0,0.6)" }} onClick={onClose}>
      <div className="w-full max-w-xl rounded-t-2xl p-4 pb-8" style={{ background: "var(--surface)", maxHeight: "92vh", overflowY: "auto" }} onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-bold">{title}</h2>
          <button className="btn-ghost" onClick={onClose}>閉じる</button>
        </div>
        <div className="space-y-3">
          {children}
          <button className="btn-primary" disabled={busy} onClick={onSave}>{busy ? "保存中…" : "保存する"}</button>
        </div>
      </div>
    </div>
  );
}
