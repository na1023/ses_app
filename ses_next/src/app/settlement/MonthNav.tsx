"use client";

import { useRouter } from "next/navigation";

function shift(ym: string, delta: number): string {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default function MonthNav({ ym }: { ym: string }) {
  const router = useRouter();
  const go = (v: string) => router.push(`/settlement?ym=${v}`);
  const [y, m] = ym.split("-");

  return (
    <div className="flex items-center justify-center gap-3">
      <button className="btn-ghost" onClick={() => go(shift(ym, -1))}>
        ‹
      </button>
      <input
        type="month"
        className="field text-center"
        style={{ width: "auto" }}
        value={ym}
        onChange={(e) => e.target.value && go(e.target.value)}
      />
      <span className="text-sm font-bold" style={{ minWidth: 72, textAlign: "center" }}>
        {y}年{Number(m)}月
      </span>
      <button className="btn-ghost" onClick={() => go(shift(ym, 1))}>
        ›
      </button>
    </div>
  );
}
