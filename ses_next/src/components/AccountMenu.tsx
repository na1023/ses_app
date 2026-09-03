"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { signOut } from "@/lib/actions";
import FullRefresh from "@/components/FullRefresh";

/** ヘッダー右上のアバターを押すと開くアカウントメニュー（全更新・ログアウト）。 */
export default function AccountMenu({ email }: { email: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, start] = useTransition();

  function logout() {
    start(async () => {
      await signOut();
      router.replace("/login");
      router.refresh();
    });
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold"
        style={{ background: "var(--accent)", color: "#fff" }}
        aria-label="アカウント"
      >
        {email.slice(0, 1).toUpperCase()}
      </button>
      {open ? (
        <div
          className="absolute right-0 z-40 mt-2 w-56 rounded-xl p-3 text-sm shadow-xl"
          style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}
        >
          <div className="mb-2 truncate text-xs" style={{ color: "var(--subtle)" }}>{email}</div>
          <div className="space-y-2">
            <FullRefresh onDone={() => setOpen(false)} />
            <button className="btn-ghost w-full" disabled={busy} onClick={logout}>
              {busy ? "…" : "ログアウト"}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
