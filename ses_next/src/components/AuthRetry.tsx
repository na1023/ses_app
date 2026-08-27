"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * 「JWT issued at future」等の一時的な認証エラーが出た時に、
 * 自動でセッションを更新→ページ再読込して復旧するコンポーネント。
 * サーバー時刻/端末時刻の微小なズレでトークンが検証エラーになる問題に対処。
 */
export default function AuthRetry({ message }: { message: string }) {
  const [status, setStatus] = useState("セッションを更新しています…");

  useEffect(() => {
    (async () => {
      const sb = createClient();
      try {
        // refreshSession でトークンを再取得（clock skew の緩和）
        await sb.auth.refreshSession();
        setStatus("再接続します…");
        setTimeout(() => window.location.reload(), 500);
      } catch {
        // 更新も失敗した場合は、少し待って再読込を試みる
        setStatus("再読込を試みます…");
        setTimeout(() => window.location.reload(), 2500);
      }
    })();
  }, []);

  async function signOut() {
    const sb = createClient();
    try { await sb.auth.signOut(); } catch {}
    window.location.href = "/login";
  }

  return (
    <div className="mx-4 mt-8 card space-y-3 text-sm">
      <div className="font-bold">🔄 {status}</div>
      <p style={{ color: "var(--subtle)" }}>
        端末とサーバーの時刻ズレによる一時的な認証エラーが発生しました。自動で復旧を試みています。
      </p>
      <p className="text-xs" style={{ color: "var(--subtle)" }}>エラー詳細: {message}</p>
      <div className="flex gap-2">
        <button className="btn-primary" onClick={() => window.location.reload()}>今すぐ再読込</button>
        <button className="btn-ghost" onClick={signOut}>ログインし直す</button>
      </div>
    </div>
  );
}
