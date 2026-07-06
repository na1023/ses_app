"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function SettingsPage() {
  const [theme, setTheme] = useState("dark");
  const [font, setFont] = useState("normal");
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
