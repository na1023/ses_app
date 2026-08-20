"use client";

import { useEffect, useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import { getSettings, saveSettings } from "@/lib/settings-actions";
import { AppSettings, DEFAULT_SETTINGS, monthlyAvgStandardMinutes, hourlyWage, minutesLabel } from "@/lib/settings";

export default function SettingsPage() {
  const [theme, setTheme] = useState("dark");
  const [font, setFont] = useState("normal");

  // 業務設定
  const [biz, setBiz] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [stdH, setStdH] = useState(8);
  const [stdM, setStdM] = useState(0);
  const [bizMsg, setBizMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [bizBusy, startBiz] = useTransition();

  useEffect(() => {
    getSettings().then((s) => {
      setBiz(s);
      setStdH(Math.floor(s.standard_minutes / 60));
      setStdM(s.standard_minutes % 60);
    });
  }, []);

  function saveBiz() {
    const next: AppSettings = { ...biz, standard_minutes: stdH * 60 + stdM };
    startBiz(async () => {
      const res = await saveSettings(next);
      setBizMsg({ ok: res.ok, text: res.message });
      if (res.ok) setBiz(next);
    });
  }

  const preview = { ...biz, standard_minutes: stdH * 60 + stdM };
  const avgMin = monthlyAvgStandardMinutes(preview);
  const wage = hourlyWage(preview);
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setTheme(document.documentElement.dataset.theme || "dark");
    setFont(document.documentElement.dataset.font || "normal");
  }, []);

  function applyTheme(v: string) {
    setTheme(v);
    if (v === "dark") document.documentElement.removeAttribute("data-theme");
    else document.documentElement.dataset.theme = v;
    try { localStorage.setItem("theme", v); } catch {}
  }
  function applyFont(v: string) {
    setFont(v);
    if (v === "normal") document.documentElement.removeAttribute("data-font");
    else document.documentElement.dataset.font = v;
    try { localStorage.setItem("font", v); } catch {}
  }

  async function changePw() {
    setMsg(null);
    if (pw.length < 6) return setMsg({ ok: false, text: "パスワードは6文字以上にしてください。" });
    if (pw !== pw2) return setMsg({ ok: false, text: "確認用パスワードが一致しません。" });
    setBusy(true);
    const sb = createClient();
    const { error } = await sb.auth.updateUser({ password: pw });
    setBusy(false);
    if (error) setMsg({ ok: false, text: error.message });
    else { setMsg({ ok: true, text: "パスワードを変更しました。" }); setPw(""); setPw2(""); }
  }

  const Seg = ({ value, cur, on, children }: { value: string; cur: string; on: (v: string) => void; children: React.ReactNode }) => (
    <button className="chip" data-active={cur === value} style={cur === value ? { background: "var(--accent)" } : undefined} onClick={() => on(value)}>{children}</button>
  );

  return (
    <div>
      <header className="app-header px-4 py-3">
        <h1 className="text-lg font-bold">設定</h1>
        <p className="text-xs" style={{ color: "var(--subtle)" }}>表示・アカウント</p>
      </header>
      <div className="space-y-4 px-4 pt-4">
        {/* 業務設定 */}
        <div className="card space-y-3">
          <div className="label">締め日</div>
          <div className="flex gap-2">
            <Seg value="month_end" cur={biz.closing_type} on={(v) => setBiz({ ...biz, closing_type: v as AppSettings["closing_type"] })}>月末締め</Seg>
            <Seg value="day_15" cur={biz.closing_type} on={(v) => setBiz({ ...biz, closing_type: v as AppSettings["closing_type"] })}>15日締め</Seg>
          </div>

          <div className="label" style={{ marginTop: "0.5rem" }}>自社の定時（1日の所定労働時間）</div>
          <div className="flex items-center gap-2">
            <input type="number" className="field" style={{ maxWidth: 90 }} value={stdH} min={0} max={24} onChange={(e) => setStdH(Math.max(0, Math.min(24, parseInt(e.target.value) || 0)))} />
            <span className="text-sm" style={{ color: "var(--subtle)" }}>時間</span>
            <input type="number" className="field" style={{ maxWidth: 90 }} value={stdM} min={0} max={59} onChange={(e) => setStdM(Math.max(0, Math.min(59, parseInt(e.target.value) || 0)))} />
            <span className="text-sm" style={{ color: "var(--subtle)" }}>分</span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="label">年間所定労働日数</div>
              <input type="number" className="field" value={biz.annual_work_days} onChange={(e) => setBiz({ ...biz, annual_work_days: parseInt(e.target.value) || 0 })} />
            </div>
            <div>
              <div className="label">月額基本給（円）</div>
              <input type="number" className="field" value={biz.base_salary} onChange={(e) => setBiz({ ...biz, base_salary: parseInt(e.target.value) || 0 })} placeholder="時給算出の基礎" />
            </div>
          </div>
          <div>
            <div className="label">固定手当（円・予想給与に加算／任意）</div>
            <input type="number" className="field" value={biz.fixed_allowance} onChange={(e) => setBiz({ ...biz, fixed_allowance: parseInt(e.target.value) || 0 })} />
          </div>

          <div className="rounded-xl px-3 py-2 text-xs" style={{ background: "var(--surface-2)", color: "var(--muted)" }}>
            月平均所定労働時間：<b>{minutesLabel(avgMin)}</b>　／　時給：<b>¥{Math.round(wage).toLocaleString()}/h</b>
          </div>

          {bizMsg ? (
            <div className="rounded-xl px-3 py-2 text-sm" style={bizMsg.ok ? { background: "#052e16", color: "#4ade80" } : { background: "#2d0707", color: "#f87171" }}>{bizMsg.text}</div>
          ) : null}
          <button className="btn-primary" disabled={bizBusy} onClick={saveBiz}>{bizBusy ? "保存中…" : "業務設定を保存"}</button>
        </div>

        <div className="card">
          <div className="label">テーマ</div>
          <div className="flex gap-2">
            <Seg value="dark" cur={theme} on={applyTheme}>ダーク</Seg>
            <Seg value="light" cur={theme} on={applyTheme}>ライト</Seg>
          </div>
        </div>

        <div className="card">
          <div className="label">文字サイズ</div>
          <div className="flex gap-2">
            <Seg value="normal" cur={font} on={applyFont}>標準</Seg>
            <Seg value="large" cur={font} on={applyFont}>大</Seg>
            <Seg value="xlarge" cur={font} on={applyFont}>特大</Seg>
          </div>
        </div>

        <div className="card space-y-3">
          <div className="label">パスワード変更</div>
          <input type="password" className="field" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="新しいパスワード（6文字以上）" autoComplete="new-password" />
          <input type="password" className="field" value={pw2} onChange={(e) => setPw2(e.target.value)} placeholder="確認用" autoComplete="new-password" />
          {msg ? (
            <div className="rounded-xl px-3 py-2 text-sm" style={msg.ok ? { background: "#052e16", color: "#4ade80" } : { background: "#2d0707", color: "#f87171" }}>{msg.text}</div>
          ) : null}
          <button className="btn-primary" disabled={busy} onClick={changePw}>{busy ? "変更中…" : "変更する"}</button>
        </div>
      </div>
    </div>
  );
}
