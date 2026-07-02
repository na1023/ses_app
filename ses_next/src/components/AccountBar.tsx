"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { signOut } from "@/lib/actions";

export default function AccountBar({ email }: { email: string }) {
  const router = useRouter();
  const [busy, start] = useTransition();

  function logout() {
    start(async () => {
      await signOut();
      router.replace("/login");
      router.refresh();
    });
  }

  return (
    <div className="mb-3 flex items-center justify-between text-xs">
      <span style={{ color: "var(--subtle)" }}>{email}</span>
      <button
        onClick={logout}
        disabled={busy}
        className="rounded-lg px-3 py-1 font-semibold"
        style={{ border: "1px solid var(--border)", color: "var(--muted)" }}
      >
        {busy ? "…" : "ログアウト"}
      </button>
    </div>
  );
}
