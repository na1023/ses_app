"use client";

import { useRouter } from "next/navigation";

function shift(ym: string, delta: number): string {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default function MonthNav({ ym, base = "/settlement" }: { ym: string; base?: string }) {
  const router = useRouter();
  const go = (v: string) => router.push(`${base}?ym=${v}`);
  const [y, m] = ym.split("-");

  return (
    <div className="flex min-w-0 items-center justify-center gap-2">
      <button className="btn-ghost shrink-0" onClick={() => go(shift(ym, -1))}>‹</button>
      <input
        type="month"
        className="field text-center"
        style={{ maxWidth: 150, minWidth: 0 }}
        value={ym}
        onChange={(e) => e.target.value && go(e.target.value)}
      />
      <span className="shrink-0 text-sm font-bold" style={{ textAlign: "center" }}>{y}/{Number(m)}</span>
      <button className="btn-ghost shrink-0" onClick={() => go(shift(ym, 1))}>›</button>
    </div>
  );
}
