"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { signOut } from "@/lib/actions";

export default function AppHeader({
  title,
  subtitle,
  email,
}: {
  title: string;
  subtitle?: string;
  email?: string;
}) {
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
    <header className="app-header px-4 py-3">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold leading-tight">{title}</h1>
          {subtitle ? (
            <p className="text-xs" style={{ color: "var(--subtle)" }}>
              {subtitle}
            </p>
          ) : null}
        </div>
        {email ? (
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
                <div className="mb-2 truncate text-xs" style={{ color: "var(--subtle)" }}>
                  {email}
                </div>
                <button className="btn-ghost w-full" disabled={busy} onClick={logout}>
                  {busy ? "…" : "ログアウト"}
                </button>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </header>
  );
}
