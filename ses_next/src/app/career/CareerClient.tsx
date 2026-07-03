"use client";

import { useState } from "react";
import { DailyReport } from "@/lib/constants";
import { generateCareer } from "@/lib/career";

function ago(days: number) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

export default function CareerClient({
  daily,
  companies,
}: {
  daily: DailyReport[];
  companies: string[];
}) {
  const [start, setStart] = useState(ago(90));
  const [end, setEnd] = useState(new Date().toISOString().slice(0, 10));
  const [company, setCompany] = useState("");
  const [out, setOut] = useState<{ md: string; text: string } | null>(null);
  const [view, setView] = useState<"md" | "text">("text");
  const [copied, setCopied] = useState(false);

  function run() {
    setOut(generateCareer({ daily, start, end, company }));
    setCopied(false);
  }
  function copy() {
    if (!out) return;
    navigator.clipboard?.writeText(view === "md" ? out.md : out.text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="px-4 pt-4">
      <div className="card space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label">開始日</label><input type="date" className="field" value={start} onChange={(e) => setStart(e.target.value)} /></div>
          <div><label className="label">終了日</label><input type="date" className="field" value={end} onChange={(e) => setEnd(e.target.value)} /></div>
        </div>
        <div>
          <label className="label">会社で絞り込み</label>
          <select className="field" value={company} onChange={(e) => setCompany(e.target.value)}>
            <option value="">すべて</option>
            {companies.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <button className="btn-primary" onClick={run}>職務経歴を生成する</button>
      </div>

      {out ? (
        <div className="mt-4">
          <div className="mb-2 flex items-center justify-between">
            <div className="seg" style={{ width: "auto" }}>
              <button data-active={view === "text"} onClick={() => setView("text")}>テキスト</button>
              <button data-active={view === "md"} onClick={() => setView("md")}>Markdown</button>
            </div>
            <button className="btn-ghost" onClick={copy}>{copied ? "コピー済" : "コピー"}</button>
          </div>
          <pre className="card whitespace-pre-wrap text-sm" style={{ lineHeight: 1.6 }}>
            {view === "md" ? out.md : out.text}
          </pre>
        </div>
      ) : null}
    </div>
  );
}
