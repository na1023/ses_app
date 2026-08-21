"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function PeriodPicker({ startInit, endInit }: { startInit: string; endInit: string }) {
  const router = useRouter();
  const params = useSearchParams();
  const [open, setOpen] = useState(false);
  const [s, setS] = useState(startInit);
  const [e, setE] = useState(endInit);

  const isActive = !!(params.get("start") && params.get("end"));

  function apply() {
    const p = new URLSearchParams(params.toString());
    p.set("start", s);
    p.set("end", e);
    router.push(`/settlement?${p.toString()}`);
    setOpen(false);
  }
  function clear() {
    const p = new URLSearchParams(params.toString());
    p.delete("start");
    p.delete("end");
    router.push(`/settlement${p.toString() ? "?" + p.toString() : ""}`);
    setOpen(false);
  }

  return (
    <>
      <button className="btn-ghost" onClick={() => setOpen(true)} style={isActive ? { borderColor: "var(--accent)", color: "var(--accent)" } : undefined}>
        {isActive ? "期間: 適用中" : "期間指定"}
      </button>
      {open ? (
        <div className="fixed inset-0 z-[60] flex items-end justify-center" style={{ background: "rgba(0,0,0,0.6)" }} onClick={() => setOpen(false)}>
          <div className="w-full max-w-xl rounded-t-2xl p-4 pb-8" style={{ background: "var(--surface)" }} onClick={(ev) => ev.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-base font-bold">期間で集計</h2>
              <button className="btn-ghost" onClick={() => setOpen(false)}>閉じる</button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="label">開始日</label><input type="date" className="field" value={s} onChange={(ev) => setS(ev.target.value)} /></div>
              <div><label className="label">終了日</label><input type="date" className="field" value={e} onChange={(ev) => setE(ev.target.value)} /></div>
            </div>
            <div className="mt-3 flex gap-2">
              <button className="btn-primary" onClick={apply}>この期間で表示</button>
              <button className="btn-ghost" onClick={clear}>解除</button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
