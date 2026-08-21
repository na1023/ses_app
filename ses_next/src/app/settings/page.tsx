"use client";

import { useEffect, useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import { getSettings, saveSettings } from "@/lib/settings-actions";
import { AppSettings, DEFAULT_SETTINGS, standardMinutesOf, minutesLabel } from "@/lib/settings";
import TimeInput from "@/components/TimeInput";

export default function SettingsPage() {
  const [theme, setTheme] = useState("dark");
  const [font, setFont] = useState("normal");

  const [biz, setBiz] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [bizMsg, setBizMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [bizBusy, startBiz] = useTransition();

  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [pwMsg, setPwMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pwBusy, setPwBusy] = useState(false);

  useEffect(() => {
    setTheme(document.documentElement.dataset.theme || "dark");
    setFont(document.documentElement.dataset.font || "normal");
    getSettings().then(setBiz).catch(() => {});
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

  function saveBiz() {
    startBiz(async () => {
      const res = await saveSettings(biz);
      setBizMsg({ ok: res.ok, text: res.message });
    });
  }

  async function changePw() {
    setPwMsg(null);
    if (pw.length < 6) return setPwMsg({ ok: false, text: "パスワードは6文字以上にしてください。" });
    if (pw !== pw2) return setPwMsg({ ok: false, text: "確認用パスワードが一致しません。" });
    setPwBusy(true);
    const sb = createClient();
    const { error } = await sb.auth.updateUser({ password: pw });
    setPwBusy(false);
    if (error) setPwMsg({ ok: false, text: error.message });
    else { setPwMsg({ ok: true, text: "パスワードを変更しました。" }); setPw(""); setPw2(""); }
  }

  const Seg = ({ value, cur, on, children }: { value: string; cur: string; on: (v: string) => void; children: React.ReactNode }) => (
    <button className="chip" data-active={cur === value} style={cur === value ? { background: "var(--accent)" } : undefined} onClick={() => on(value)}>{children}</button>
  );

  const stdMin = standardMinutesOf(biz);

  return (
    <div>
      <header className="app-header px-4 py-3">
        <h1 className="text-lg font-bold">設定</h1>
        <p className="text-xs" style={{ color: "var(--subtle)" }}>業務・表示・アカウント</p>
      </header>
      <div className="space-y-4 px-4 pt-4">
        {/* 業務設定 */}
        <div className="card space-y-3">
          <div className="label">締め日</div>
          <div className="flex gap-2">
            <Seg value="month_end" cur={biz.closing_type} on={(v) => setBiz({ ...biz, closing_type: v as AppSettings["closing_type"] })}>月末締め</Seg>
            <Seg value="day_15" cur={biz.closing_type} on={(v) => setBiz({ ...biz, closing_type: v as AppSettings["closing_type"] })}>15日締め</Seg>
          </div>

          <div className="label" style={{ marginTop: "0.5rem" }}>自社の定時（何時〜何時＋休憩）</div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <div className="mb-1 text-xs" style={{ color: "var(--subtle)" }}>開始</div>
              <TimeInput value={biz.work_start} onChange={(v) => setBiz({ ...biz, work_start: v })} placeholder="09:00" />
            </div>
            <div>
              <div className="mb-1 text-xs" style={{ color: "var(--subtle)" }}>終了</div>
              <TimeInput value={biz.work_end} onChange={(v) => setBiz({ ...biz, work_end: v })} placeholder="18:00" />
            </div>
            <div>
              <div className="mb-1 text-xs" style={{ color: "var(--subtle)" }}>休憩</div>
              <TimeInput value={biz.work_break} onChange={(v) => setBiz({ ...biz, work_break: v })} placeholder="01:00" />
            </div>
          </div>

          <div className="rounded-xl px-3 py-2 text-xs" style={{ background: "var(--surface-2)", color: "var(--muted)" }}>
            自社の定時：<b>{minutesLabel(stdMin)}／日</b>　※基本給は「給与管理」の直近月から自動取得します
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
          {pwMsg ? (
            <div className="rounded-xl px-3 py-2 text-sm" style={pwMsg.ok ? { background: "#052e16", color: "#4ade80" } : { background: "#2d0707", color: "#f87171" }}>{pwMsg.text}</div>
          ) : null}
          <button className="btn-primary" disabled={pwBusy} onClick={changePw}>{pwBusy ? "変更中…" : "変更する"}</button>
        </div>
      </div>
    </div>
  );
}
