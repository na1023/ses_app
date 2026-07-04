"use client";

import { useState } from "react";
import { ATT_COLOR } from "@/lib/constants";

const DOW = ["日", "月", "火", "水", "木", "金", "土"];

function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function Calendar({
  reported,
  holidays,
  onPick,
}: {
  reported: Record<string, string>; // date -> attendance_type
  holidays: Record<string, string>; // date -> 祝日名
  onPick?: (date: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const now = new Date();
  const [view, setView] = useState({ y: now.getFullYear(), m: now.getMonth() });

  const first = new Date(view.y, view.m, 1);
  const startPad = first.getDay(); // 0=日
  const daysInMonth = new Date(view.y, view.m + 1, 0).getDate();
  const todayStr = ymd(now);

  const cells: (number | null)[] = [];
  for (let i = 0; i < startPad; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  function shift(delta: number) {
    const nd = new Date(view.y, view.m + delta, 1);
    setView({ y: nd.getFullYear(), m: nd.getMonth() });
  }

  // 記入済み日数 / 平日
  const filledCount = Object.keys(reported).filter((k) => k.startsWith(`${view.y}-${String(view.m + 1).padStart(2, "0")}`)).length;

  return (
    <div className="mb-4">
      <button
        className="btn-ghost w-full"
        onClick={() => setOpen((v) => !v)}
        style={{ justifyContent: "center" }}
      >
        {open ? "▲ カレンダーを隠す" : "▼ カレンダーで記入状況を見る"}
      </button>

      {open ? (
        <div className="card mt-2">
          <div className="mb-2 flex items-center justify-between">
            <button className="btn-ghost" onClick={() => shift(-1)}>‹</button>
            <div className="text-sm font-bold">
              {view.y}年{view.m + 1}月
              <span className="ml-2 text-xs" style={{ color: "var(--subtle)" }}>記入 {filledCount}日</span>
            </div>
            <button className="btn-ghost" onClick={() => shift(1)}>›</button>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center">
            {DOW.map((d, i) => (
              <div key={d} className="py-1 text-xs font-bold" style={{ color: i === 0 ? "#f87171" : i === 6 ? "#60a5fa" : "var(--subtle)" }}>{d}</div>
            ))}
            {cells.map((d, idx) => {
              if (d === null) return <div key={idx} />;
              const ds = `${view.y}-${String(view.m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
              const att = reported[ds];
              const hol = holidays[ds];
              const dow = new Date(view.y, view.m, d).getDay();
              const isToday = ds === todayStr;
              const dateColor = hol || dow === 0 ? "#f87171" : dow === 6 ? "#60a5fa" : "var(--text)";
              return (
                <button
                  key={idx}
                  onClick={() => onPick?.(ds)}
                  className="flex flex-col items-center rounded-lg py-1.5"
                  style={{
                    background: att ? (ATT_COLOR[att] ?? "#3b82f6") + "22" : "transparent",
                    border: isToday ? "1px solid var(--accent)" : "1px solid transparent",
                  }}
                  title={hol ?? ""}
                >
                  <span className="text-sm" style={{ color: dateColor, fontWeight: isToday ? 700 : 400 }}>{d}</span>
                  {att ? (
                    <span className="mt-0.5 h-1.5 w-1.5 rounded-full" style={{ background: ATT_COLOR[att] ?? "#3b82f6" }} />
                  ) : (
                    <span className="mt-0.5 h-1.5 w-1.5 rounded-full" style={{ background: "transparent", border: "1px solid var(--border)" }} />
                  )}
                </button>
              );
            })}
          </div>

          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs" style={{ color: "var(--subtle)" }}>
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full" style={{ background: "#3b82f6" }} />記入済み</span>
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full border" style={{ borderColor: "var(--border)" }} />未記入</span>
            <span style={{ color: "#f87171" }}>■ 日曜・祝日</span>
          </div>
        </div>
      ) : null}
    </div>
  );
}
