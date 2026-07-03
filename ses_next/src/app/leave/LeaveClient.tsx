"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LeaveGrant, saveGrant, deleteGrant } from "@/lib/domain-actions";

export default function LeaveClient({ grants }: { grants: LeaveGrant[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [gDate, setGDate] = useState("");
  const [gDays, setGDays] = useState("10");
  const [gMemo, setGMemo] = useState("");
  const [busy, start] = useTransition();

  function add() {
    start(async () => {
      const res = await saveGrant({ grant_date: gDate, days: gDays, memo: gMemo });
      if (res.ok) { setOpen(false); setGDate(""); setGDays("10"); setGMemo(""); router.refresh(); }
      else alert(res.message);
    });
  }

  return (
    <div className="mt-4">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-bold" style={{ color: "var(--muted)" }}>付与履歴</h2>
        <button className="btn-ghost" onClick={() => setOpen(true)}>＋ 付与登録</button>
      </div>
      <ul className="space-y-2">
        {grants.map((g) => (
          <li key={g.id} className="card flex items-center justify-between py-2.5">
            <div>
              <span className="font-bold">{g.grant_date}</span>
              <span className="ml-2 text-sm" style={{ color: "var(--muted)" }}>{g.days}日</span>
              {g.memo ? <span className="ml-2 text-xs" style={{ color: "var(--subtle)" }}>{g.memo}</span> : null}
            </div>
            <button className="btn-ghost" style={{ color: "var(--red)" }}
              onClick={() => { if (confirm("削除しますか？")) start(async () => { await deleteGrant(g.id); router.refresh(); }); }}>削除</button>
          </li>
        ))}
        {grants.length === 0 ? <p className="text-sm" style={{ color: "var(--subtle)" }}>付与がありません。</p> : null}
      </ul>

      {open ? (
        <div className="fixed inset-0 z-[60] flex items-end justify-center" style={{ background: "rgba(0,0,0,0.6)" }} onClick={() => setOpen(false)}>
          <div className="w-full max-w-xl rounded-t-2xl p-4 pb-8" style={{ background: "var(--surface)" }} onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-base font-bold">有給を付与登録</h2>
              <button className="btn-ghost" onClick={() => setOpen(false)}>閉じる</button>
            </div>
            <div className="space-y-3">
              <div><label className="label">付与日</label><input type="date" className="field" value={gDate} onChange={(e) => setGDate(e.target.value)} /></div>
              <div><label className="label">付与日数</label><input type="number" inputMode="decimal" className="field" value={gDays} onChange={(e) => setGDays(e.target.value)} /></div>
              <div><label className="label">メモ</label><input className="field" value={gMemo} onChange={(e) => setGMemo(e.target.value)} placeholder="例: 入社1年付与" /></div>
              <button className="btn-primary" disabled={busy} onClick={add}>{busy ? "保存中…" : "登録する"}</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
