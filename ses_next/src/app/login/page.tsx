"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setMsg(null);
    if (!email || !password) {
      setMsg({ ok: false, text: "メールとパスワードを入力してください。" });
      return;
    }
    setBusy(true);
    const supabase = createClient();
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        // メール確認が無効なら即ログイン状態。有効なら確認メール送信。
        const { data } = await supabase.auth.getSession();
        if (data.session) {
          router.replace("/");
          router.refresh();
        } else {
          setMsg({
            ok: true,
            text: "確認メールを送信しました。メール内のリンクを開いてからログインしてください。",
          });
          setMode("login");
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        router.replace("/");
        router.refresh();
      }
    } catch (e) {
      const text = e instanceof Error ? e.message : String(e);
      setMsg({ ok: false, text: translate(text) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col justify-center px-6">
      <div className="mx-auto w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold">SES業務管理</h1>
          <p className="mt-1 text-sm" style={{ color: "var(--subtle)" }}>
            {mode === "login" ? "ログイン" : "新規アカウント作成"}
          </p>
        </div>

        <div className="card space-y-4">
          <div>
            <label className="label">メールアドレス</label>
            <input
              type="email"
              inputMode="email"
              autoComplete="email"
              className="field"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
            />
          </div>
          <div>
            <label className="label">パスワード</label>
            <input
              type="password"
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              className="field"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="6文字以上"
            />
          </div>

          {msg ? (
            <div
              className="rounded-xl px-3 py-2 text-sm"
              style={
                msg.ok
                  ? { background: "#052e16", color: "#4ade80" }
                  : { background: "#2d0707", color: "#f87171" }
              }
            >
              {msg.text}
            </div>
          ) : null}

          <button className="btn-primary" disabled={busy} onClick={submit}>
            {busy ? "処理中…" : mode === "login" ? "ログイン" : "アカウント作成"}
          </button>
        </div>

        <button
          className="mt-4 w-full text-center text-sm"
          style={{ color: "var(--accent)" }}
          onClick={() => {
            setMode(mode === "login" ? "signup" : "login");
            setMsg(null);
          }}
        >
          {mode === "login"
            ? "アカウントをお持ちでない方はこちら（新規登録）"
            : "すでにアカウントをお持ちの方はこちら（ログイン）"}
        </button>
      </div>
    </div>
  );
}

function translate(msg: string): string {
  if (/Invalid login credentials/i.test(msg))
    return "メールアドレスまたはパスワードが正しくありません。";
  if (/already registered/i.test(msg))
    return "このメールアドレスは既に登録されています。";
  if (/Password should be at least/i.test(msg))
    return "パスワードは6文字以上にしてください。";
  if (/Email not confirmed/i.test(msg))
    return "メール確認が未完了です。確認メールのリンクを開いてください。";
  return msg;
}
