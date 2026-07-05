"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveSettlementNote } from "@/lib/projects-actions";

export default function ReasonEditor({
  projectId,
  ym,
  initial,
  kind,
}: {
  projectId: string;
  ym: string;
  initial: string;
  kind: "short" | "over";
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(initial);
  const [busy, start] = useTransition();

  const label = kind === "short" ? "下限を下回った理由" : "上限を上回った理由";
  const placeholder =
    kind === "short"
      ? "例：月末が祝日続きで営業日が少なかった／体調不良で休んだ 等"
      : "例：リリース対応で残業が増えた／繁忙期対応 等";

  function save() {
    start(async () => {
      const res = await saveSettlementNote(projectId, ym, text);
      if (res.ok) {
        setEditing(false);
        router.refresh();
      } else alert(res.message);
    });
  }

  if (!editing) {
    return (
      <div className="mt-2 rounded-lg p-2" style={{ background: "#0f1420", border: "1px solid var(--border)" }}>
        <div className="mb-0.5 text-xs" style={{ color: "var(--subtle)" }}>{label}</div>
        {initial ? (
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm" style={{ color: "var(--text)" }}>{initial}</p>
            <button className="btn-ghost shrink-0" style={{ minHeight: "auto", padding: "0.3rem 0.6rem" }} onClick={() => setEditing(true)}>編集</button>
          </div>
        ) : (
          <button className="btn-ghost w-full" onClick={() => setEditing(true)}>＋ 理由を記入</button>
        )}
      </div>
    );
  }

  return (
    <div className="mt-2 rounded-lg p-2" style={{ background: "#0f1420", border: "1px solid var(--border)" }}>
      <div className="mb-1 text-xs" style={{ color: "var(--subtle)" }}>{label}</div>
      <textarea className="field" rows={2} value={text} onChange={(e) => setText(e.target.value)} placeholder={placeholder} />
      <div className="mt-2 flex gap-2">
        <button className="btn-primary" style={{ padding: "0.6rem" }} disabled={busy} onClick={save}>{busy ? "保存中…" : "保存"}</button>
        <button className="btn-ghost" onClick={() => { setText(initial); setEditing(false); }}>キャンセル</button>
      </div>
    </div>
  );
}
