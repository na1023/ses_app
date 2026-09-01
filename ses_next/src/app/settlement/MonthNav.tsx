"use client";

import { useRouter } from "next/navigation";
import { useTransition, useEffect } from "react";

function shift(ym: string, delta: number): string {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default function MonthNav({ ym, base = "/settlement" }: { ym: string; base?: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  // 前月・翌月を事前プリフェッチ（体感速度アップ）
  useEffect(() => {
    router.prefetch(`${base}?ym=${shift(ym, -1)}`);
    router.prefetch(`${base}?ym=${shift(ym, 1)}`);
  }, [ym, base, router]);

  const go = (v: string) => start(() => router.push(`${base}?ym=${v}`));
  const [y, m] = ym.split("-");

  return (
    <div className="flex min-w-0 items-center justify-center gap-1">
      <button
        aria-label="前の月"
        className="nav-btn"
        onClick={() => { navigator.vibrate?.(15); go(shift(ym, -1)); }}
        disabled={pending}
      >‹</button>
      <div className="flex-1 text-center">
        <div className="text-lg font-extrabold leading-tight" style={{ color: pending ? "var(--accent)" : "var(--text)" }}>
          {pending ? (
            <span className="inline-flex items-center gap-2">
              <span className="dot-load" />{y}/{Number(m)}
            </span>
          ) : (
            `${y}年${Number(m)}月`
          )}
        </div>
        <input
          type="month"
          className="text-xs opacity-70"
          style={{ background: "transparent", border: "none", color: "var(--subtle)", width: "100%", textAlign: "center" }}
          value={ym}
          disabled={pending}
          onChange={(e) => e.target.value && go(e.target.value)}
        />
      </div>
      <button
        aria-label="次の月"
        className="nav-btn"
        onClick={() => { navigator.vibrate?.(15); go(shift(ym, 1)); }}
        disabled={pending}
      >›</button>
    </div>
  );
}
